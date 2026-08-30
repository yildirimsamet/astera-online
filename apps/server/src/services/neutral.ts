import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  DEBRIS,
  HULLS,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  SHIELD,
  computeLoot,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeedMult,
  fleetTravelExact,
  garrisonOf,
  instrumentCost,
  productionMult,
  resolveCombat,
  seededFrom,
  shieldHp,
  storageCap,
  alloyRate,
  crystalRate,
  upgradeCost,
  type BuildingId,
  type Fleet,
  type HullId,
  type NeutralTier,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import {
  battleReports,
  buildings,
  debrisFields,
  missions,
  neutralPlanetState,
  planets,
  satellites,
  units,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { clearMissionUnits, fleetOfMission } from './mission.js';
import { recordGalaxyEvent } from './chronicle.js';
import { notify } from './notifications.js';
import { orbitOf, recomputePlayerWealth, saveResources, setUnits } from './planet.js';
import { safeHomePlanet } from './ownership.js';

const EMPTY_VAULT = { alloy: 0, crystal: 0, deuterium: 0 };

async function neutralLevels(tx: Tx, planetId: string) {
  const rows = await tx.select().from(buildings).where(eq(buildings.planetId, planetId));
  const levels = {
    CORE: 0, REFINERY: 0, EXTRACTOR: 0, VAULT: 0, SHIPYARD: 0, HANGAR: 0, DEUTERIUM_PLANT: 0,
  };
  for (const row of rows) if (row.type in levels) levels[row.type as BuildingId] = row.level;
  return levels;
}

export async function advanceNeutralEconomy(tx: Tx, planetId: string, now: Date) {
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (world?.kind !== 'NEUTRAL') return null;
  const levels = await neutralLevels(tx, planetId);
  const orbitRows = await tx.select({ type: satellites.type, level: satellites.level }).from(satellites)
    .where(eq(satellites.planetId, planetId));
  const orbit = orbitRows.map((row) => row.type)
    .filter((type): type is 'FOUNDRY' => type === 'FOUNDRY');
  const elapsedHours = Math.max(0, now.getTime() - world.lastTickAt.getTime()) / 3_600_000;
  const alloyPerHour = alloyRate(levels.REFINERY) * productionMult(orbit);
  const crystalPerHour = crystalRate(levels.EXTRACTOR) * productionMult(orbit);
  const alloy = Math.min(storageCap(alloyPerHour, levels.VAULT), world.alloy + elapsedHours * alloyPerHour);
  const crystal = Math.min(
    storageCap(crystalPerHour, levels.VAULT),
    world.crystal + elapsedHours * crystalPerHour,
  );
  const aegisLevel = orbitRows.find((row) => row.type === 'AEGIS')?.level ?? 0;
  const maxShield = shieldHp(aegisLevel);
  const shield = maxShield > 0
    ? Math.min(maxShield, world.shield + maxShield * SHIELD.regenPerHour * elapsedHours)
    : 0;
  await tx.update(planets).set({ alloy, crystal, shield, lastTickAt: now })
    .where(eq(planets.id, planetId));
  return { ...world, alloy, crystal, shield, levels };
}

async function neutralFleet(tx: Tx, planetId: string): Promise<Fleet> {
  const rows = await tx.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  return Object.fromEntries(rows.filter((row) => row.count > 0).map((row) => [row.hull, row.count]));
}

async function setNeutralFleet(tx: Tx, planetId: string, fleet: Fleet): Promise<void> {
  for (const [hull, count] of fleetEntries(fleet)) {
    await tx.insert(units).values({
      planetId,
      ownerPlayerId: null,
      hull,
      location: 'home',
      count,
    }).onConflictDoUpdate({
      target: [units.planetId, units.hull, units.location],
      set: { ownerPlayerId: null, count },
    });
  }
  const alive = new Set(fleetEntries(fleet).filter(([, count]) => count > 0).map(([hull]) => hull));
  const absent = (Object.keys(HULLS) as HullId[]).filter((hull) => !alive.has(hull));
  if (absent.length > 0) {
    await tx.delete(units).where(and(
      eq(units.planetId, planetId),
      eq(units.location, 'home'),
      inArray(units.hull, absent),
    ));
  }
}

const flyingMaterial = (fleet: Fleet, key: 'alloy' | 'crystal' | 'deuterium') =>
  fleetEntries(fleet)
    .filter(([hull]) => !HULLS[hull].ground)
    .reduce((sum, [hull, count]) => sum + HULLS[hull][key] * count, 0);

/**
 * What a field made of these losses would be worth, or zero if none is created.
 *
 * The battle report carries the same figure and is written BEFORE the field, so
 * the threshold lives here rather than being applied twice and drifting. A report
 * that claims wreckage nobody can go and collect is worse than one that says none.
 */
const attackerWreckValue = (losses: Fleet): number => {
  const total = flyingMaterial(losses, 'alloy')
    + flyingMaterial(losses, 'crystal')
    + flyingMaterial(losses, 'deuterium');
  const wreck = total * DEBRIS.share;
  return wreck < DEBRIS.minimum || total <= 0 ? 0 : wreck;
};

async function createAttackerDebris(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  losses: Fleet,
  now: Date,
): Promise<void> {
  const alloy = flyingMaterial(losses, 'alloy');
  const crystal = flyingMaterial(losses, 'crystal');
  const deuterium = flyingMaterial(losses, 'deuterium');
  const total = alloy + crystal + deuterium;
  const wreck = attackerWreckValue(losses);
  if (wreck === 0) return;
  await tx.insert(debrisFields).values({
    seasonId: mission.seasonId,
    planetId: mission.targetPlanetId,
    missionId: mission.id,
    alloy: wreck * alloy / total,
    crystal: wreck * crystal / total,
    deuterium: wreck * deuterium / total,
    createdAt: now,
  });
}

export async function resolveNeutralBattle(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  clock: Clock,
): Promise<void> {
  const neutral = await advanceNeutralEconomy(tx, mission.targetPlanetId, clock.now());
  if (!neutral) throw new Error('neutral mission target changed before resolution');
  const attackerHomeId = await safeHomePlanet(tx, mission.ownerPlayerId, mission.originPlanetId);
  const attackerOrbit = await orbitOf(tx, attackerHomeId);
  const attackingFleet = await fleetOfMission(tx, mission.originPlanetId, mission.id);
  if (fleetCount(attackingFleet) === 0) return;
  // Through the same definition the player battle uses, so a craft can never be
  // spared on one path and pulled into the line on the other. A neutral world has
  // no mining craft today; the shared call is what keeps that true if it ever does.
  const defenders = garrisonOf(await neutralFleet(tx, mission.targetPlanetId), {});
  const result = resolveCombat(
    attackingFleet, defenders, neutral.shield, seededFrom(mission.id),
    // A caretaker world researches nothing; the raider's doctrines still count. T9.
    { attacker: mission.tech ?? {}, defender: {} },
  );
  await setNeutralFleet(tx, mission.targetPlanetId, result.defenderSurvivors);
  const loot = computeLoot(
    { alloy: neutral.alloy, crystal: neutral.crystal, deuterium: neutral.deuterium },
    { alloy: 0, crystal: 0, deuterium: 0 },
    EMPTY_VAULT,
    result.grade,
    /*
      THE FROZEN LADDERS, LIKE THE COMBAT THREE LINES ABOVE. D137.

      This re-read them live, so a commander who finished Cargo Holds mid-flight
      carried more home from a caretaker world than from a player — and more than
      the launch preview had quoted them, which computes off launch-time tech. The
      player path has always used the snapshot; this one disagreed with the rule,
      with the other path, and with its own combat call.
    */
    fleetCargo(result.attackerSurvivors, mission.tech ?? {}),
  );
  const uncappedLoot = computeLoot(
    { alloy: neutral.alloy, crystal: neutral.crystal, deuterium: neutral.deuterium },
    { alloy: 0, crystal: 0, deuterium: 0 },
    EMPTY_VAULT,
    result.grade,
    Number.MAX_SAFE_INTEGER,
  );
  const cargoLimited =
    uncappedLoot.alloy + uncappedLoot.crystal + uncappedLoot.deuterium
    > loot.alloy + loot.crystal + loot.deuterium;
  await saveResources(tx, mission.targetPlanetId, {
    alloy: neutral.alloy - loot.fromStock.alloy,
    crystal: neutral.crystal - loot.fromStock.crystal,
    deuterium: neutral.deuterium - loot.fromStock.deuterium,
    shield: result.shieldLeft,
  });
  if (result.grade === 'DECISIVE') {
    /**
     * A CLOSED WINDOW REOPENS; A LIVE ONE IS NEVER EXTENDED. D112.
     *
     * The guard used to be `claim_until IS NULL`, and nothing anywhere puts an
     * EXPIRED claim back to null — so a world whose thirty minutes ran out was
     * un-settleable for the rest of the season, and the only thing that could
     * undo it was a Death Star landing on it. Fifty-one neutral worlds went out
     * one at a time, each one still raidable and no longer worth taking.
     *
     * The second half of the guard is the half that always mattered and is kept
     * exactly: a raid landing while the window is OPEN must not push its end back,
     * or a commander with a spare squadron holds a claim open indefinitely and
     * nobody else's Haulers ever beat theirs.
     */
    // One instant, read once: the window's end and the test for "already closed"
    // have to be the same NOW, or a claim expiring between two reads is judged
    // against one clock and dated from another.
    const now = clock.now();
    const claimUntil = addMinutes(now, SETTLEMENT_CLAIM_MINUTES);
    const opened = await tx.update(neutralPlanetState)
      .set({ claimUntil })
      .where(and(
        eq(neutralPlanetState.planetId, neutral.id),
        or(
          isNull(neutralPlanetState.claimUntil),
          lte(neutralPlanetState.claimUntil, now),
        ),
      ))
      .returning({ planetId: neutralPlanetState.planetId, tier: neutralPlanetState.tier });
    if (opened[0]) {
      await recordGalaxyEvent(tx, {
        seasonId: mission.seasonId,
        kind: 'neutral_claim',
        refId: mission.id,
        subjectPlanetId: neutral.id,
        payload: {
          planetName: neutral.name,
          tier: opened[0].tier,
          claimUntil: claimUntil.toISOString(),
        },
        occurredAt: clock.now(),
      });
    }
  }
  await tx.insert(battleReports).values({
    seasonId: mission.seasonId,
    missionId: mission.id,
    attackerPlayerId: mission.ownerPlayerId,
    defenderPlayerId: null,
    targetPlanetId: neutral.id,
    targetKind: 'NEUTRAL',
    grade: result.grade,
    rounds: result.rounds,
    loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    // The rosters that met. The garrison is the caretaker's, so nothing here is
    // anybody's private board — but the reader is still only ever shown its own.
    attackerFleet: attackingFleet,
    defenderFleet: defenders,
    /*
      A NEUTRAL WORLD SALVAGES NOTHING AND HAS NO WORKS TO KNOCK OUT.
      `setNeutralFleet` writes the survivors and stops; there is no owner to
      rebuild a gun and no production to disrupt, so both stay at their defaults
      rather than carrying a figure the caretaker never received.
    */
    // Attacker losses only: nothing a caretaker fields is left in orbit. See
    // `createAttackerDebris`, which is priced on exactly this list.
    wreckValue: attackerWreckValue(result.attackerLosses),
    cargoLimited,
    shieldAbsorbed: result.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0),
    dominionSwing: 0,
    createdAt: clock.now(),
  });
  /**
   * THE RAIDER IS TOLD. D121a.
   *
   * A neutral battle wrote a report and notified nobody, so the closing link of
   * the loop existed only for a commander who thought to go and look for it: no
   * badge on the beacon, no row in Signals, and — since D121 gave every kind of
   * news a door — no way in to the report either. Fifty-one of the worlds on the
   * disc are caretaker worlds and the whole colonisation path runs through
   * raiding them, so this was most of the early game happening in silence.
   *
   * The same `raid_result` kind and the same payload shape as a PvP raid, because
   * it is the same event to the player who launched it. There is nobody on the
   * other side to tell — which is the one difference, and it is the definition of
   * a neutral world rather than a gap.
   */
  await notify(tx, {
    playerId: mission.ownerPlayerId,
    kind: 'raid_result',
    payload: {
      grade: result.grade,
      targetPlanetId: neutral.id,
      targetPlanetName: neutral.name,
      lootAlloy: loot.alloy,
      lootCrystal: loot.crystal,
      lootDeuterium: loot.deuterium,
      unitsLost: fleetCount(result.attackerLosses),
      shipsHome: fleetCount(result.attackerSurvivors),
      // A caretaker world is outside the ladder: taking one moves nobody's score.
      dominion: 0,
    },
    at: clock.now(),
    refId: mission.id,
  });

  await createAttackerDebris(tx, mission, result.attackerLosses, clock.now());
  await clearMissionUnits(tx, mission.originPlanetId, mission.id);
  if (fleetCount(result.attackerSurvivors) > 0) {
    const home = fleetTravelExact(
      mission.distance,
      result.attackerSurvivors,
      fleetSpeedMult(attackerOrbit),
    );
    const arriveAt = addMinutes(clock.now(), home);
    const [returnMission] = await tx.insert(missions).values({
      seasonId: mission.seasonId,
      kind: 'return',
      ownerPlayerId: mission.ownerPlayerId,
      originPlanetId: mission.targetPlanetId,
      targetPlanetId: mission.originPlanetId,
      fleet: result.attackerSurvivors,
      loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
      distance: mission.distance,
      departAt: clock.now(),
      arriveAt,
    }).returning();
    if (!returnMission) throw new Error('neutral return insert returned no row');
    await setUnits(
      tx,
      mission.originPlanetId,
      result.attackerSurvivors,
      returnMission.id,
      mission.ownerPlayerId,
    );
    await schedule(tx, {
      seasonId: mission.seasonId,
      kind: 'mission_arrival',
      refId: returnMission.id,
      resolveAt: arriveAt,
    });
  }
  await recomputePlayerWealth(tx, mission.ownerPlayerId);
  await publishShard(tx, mission.seasonId, 'world');
}

/** A recovery/protection boundary invalidates combat, but never deletes the committed fleet. */
export async function returnAttackUntouched(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  clock: Clock,
): Promise<void> {
  const attackerHomeId = await safeHomePlanet(tx, mission.ownerPlayerId, mission.originPlanetId);
  const attackerOrbit = await orbitOf(tx, attackerHomeId);
  const fleet = await fleetOfMission(tx, mission.originPlanetId, mission.id);
  await clearMissionUnits(tx, mission.originPlanetId, mission.id);
  if (fleetCount(fleet) === 0) return;
  const arriveAt = addMinutes(
    clock.now(),
    fleetTravelExact(mission.distance, fleet, fleetSpeedMult(attackerOrbit)),
  );
  const [ret] = await tx.insert(missions).values({
    seasonId: mission.seasonId,
    kind: 'return',
    ownerPlayerId: mission.ownerPlayerId,
    originPlanetId: mission.targetPlanetId,
    targetPlanetId: mission.originPlanetId,
    fleet,
    loot: { alloy: 0, crystal: 0, deuterium: 0 },
    distance: mission.distance,
    departAt: clock.now(),
    arriveAt,
  }).returning();
  if (!ret) throw new Error('peaceful return insert returned no row');
  await setUnits(tx, mission.originPlanetId, fleet, ret.id, mission.ownerPlayerId);
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'mission_arrival',
    refId: ret.id,
    resolveAt: arriveAt,
  });
}

export async function reinforceNeutral(
  tx: Tx,
  planetId: string,
  now: Date,
): Promise<Date | null> {
  const [state] = await tx.select().from(neutralPlanetState)
    .where(eq(neutralPlanetState.planetId, planetId)).for('update');
  if (!state) return null;
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (world?.kind !== 'NEUTRAL') return null;
  const tier = state.tier as NeutralTier;
  const template = MULTI_WORLD.neutral[tier];
  if (template.reinforcementMinutes === null) return null;
  if (world.recoveryUntil && world.recoveryUntil > now) {
    await tx.update(neutralPlanetState)
      .set({ nextReinforcementAt: world.recoveryUntil })
      .where(eq(neutralPlanetState.planetId, planetId));
    return world.recoveryUntil;
  }

  const advanced = await advanceNeutralEconomy(tx, planetId, now);
  if (!advanced) return null;
  let alloy = advanced.alloy;
  let crystal = advanced.crystal;
  let deuterium = world.deuterium;
  const order: BuildingId[] = ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'];
  let reinforcementBlocked = false;
  for (const type of order) {
    let level = advanced.levels[type];
    const target = template.buildings[type];
    while (level < target) {
      const cost = upgradeCost(level);
      if (alloy < cost.alloy || crystal < cost.crystal || deuterium < cost.deuterium) {
        reinforcementBlocked = true;
        break;
      }
      alloy -= cost.alloy;
      crystal -= cost.crystal;
      deuterium -= cost.deuterium;
      level++;
      await tx.update(buildings).set({ level })
        .where(and(eq(buildings.planetId, planetId), eq(buildings.type, type)));
    }
    if (reinforcementBlocked) break;
  }
  if (tier === 3 && !reinforcementBlocked) {
    const [aegis] = await tx.select().from(satellites)
      .where(and(eq(satellites.planetId, planetId), eq(satellites.type, 'AEGIS')));
    let level = aegis?.level ?? 0;
    while (level < 3) {
      const cost = instrumentCost('AEGIS', level);
      if (alloy < cost.alloy || crystal < cost.crystal || deuterium < cost.deuterium) {
        reinforcementBlocked = true;
        break;
      }
      alloy -= cost.alloy;
      crystal -= cost.crystal;
      deuterium -= cost.deuterium;
      level++;
      await tx.insert(satellites).values({ planetId, slot: 0, type: 'AEGIS', level })
        .onConflictDoUpdate({
          target: [satellites.planetId, satellites.slot],
          set: { type: 'AEGIS', level },
        });
    }
  }

  const current = await neutralFleet(tx, planetId);
  const targets = { ...template.fleet, ...template.ground } as Fleet;
  const tie: HullId[] = ['WASP', 'LANCE', 'BULWARK', 'THORN', 'BASTION'];
  while (!reinforcementBlocked) {
    const missing = tie.filter((hull) => (current[hull] ?? 0) < (targets[hull] ?? 0));
    if (missing.length === 0) break;
    missing.sort((a, b) =>
      ((current[a] ?? 0) / Math.max(1, targets[a] ?? 0))
      - ((current[b] ?? 0) / Math.max(1, targets[b] ?? 0))
      || tie.indexOf(a) - tie.indexOf(b));
    const hull = missing[0]!;
    const spec = HULLS[hull];
    if (alloy < spec.alloy || crystal < spec.crystal || deuterium < spec.deuterium) break;
    alloy -= spec.alloy;
    crystal -= spec.crystal;
    deuterium -= spec.deuterium;
    current[hull] = (current[hull] ?? 0) + 1;
  }
  await setNeutralFleet(tx, planetId, current);
  await tx.update(planets).set({ alloy, crystal, deuterium }).where(eq(planets.id, planetId));
  const next = addMinutes(now, template.reinforcementMinutes);
  await tx.update(neutralPlanetState).set({ nextReinforcementAt: next })
    .where(eq(neutralPlanetState.planetId, planetId));
  return next;
}
