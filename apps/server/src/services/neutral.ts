import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  ALL_HULLS,
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
  productionMult,
  resolveCombat,
  seededFrom,
  settleWreck,
  shieldHp,
  storageCap,
  alloyRate,
  crystalRate,
  buildingCost,
  type BuildingId,
  type Fleet,
  type HullId,
  type NeutralTier,
  type Resources,
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
    CORE: 0, REFINERY: 0, EXTRACTOR: 0, VAULT: 0, SHIPYARD: 0, DEUTERIUM_PLANT: 0,
  };
  for (const row of rows) if (row.type in levels) levels[row.type as BuildingId] = row.level;
  return levels;
}

/**
 * A NEUTRAL WORLD'S ECONOMY AT `now`, COMPUTED AND NEVER WRITTEN. D199.
 *
 * `advanceNeutralEconomy` writes it under a lock before a battle; a probe reads it
 * and writes nothing — the same arithmetic, so the report and the raid after it see
 * one world.
 */
export function neutralEconomyAt(
  world: typeof planets.$inferSelect,
  levels: Record<BuildingId, number>,
  orbitRows: readonly { type: string; level: number }[],
  now: Date,
): { alloy: number; crystal: number; shield: number } {
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
  return { alloy, crystal, shield };
}

const neutralOrbit = (tx: Tx, planetId: string) =>
  tx.select({ type: satellites.type, level: satellites.level }).from(satellites)
    .where(eq(satellites.planetId, planetId));

/** The same, read without a lock or a write — a probe looks, it does not tick. */
export async function neutralStanding(tx: Tx, world: typeof planets.$inferSelect, now: Date) {
  const [levels, orbitRows] = await Promise.all([neutralLevels(tx, world.id), neutralOrbit(tx, world.id)]);
  return neutralEconomyAt(world, levels, orbitRows, now);
}

export async function advanceNeutralEconomy(tx: Tx, planetId: string, now: Date) {
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (world?.kind !== 'NEUTRAL') return null;
  const levels = await neutralLevels(tx, planetId);
  const orbitRows = await neutralOrbit(tx, planetId);
  const { alloy, crystal, shield } = neutralEconomyAt(world, levels, orbitRows, now);
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
 * The wreck a caretaker fight makes: the raider's own dead, split by material.
 *
 * Only the attacker's losses — nothing a caretaker fields is left in orbit. What
 * the raider's collectors lift and what is left as a field is `settleWreck`'s
 * answer, taken once in `resolveNeutralBattle` so the report and the field are
 * the same remainder rather than the threshold being applied twice and drifting.
 */
const attackerWreck = (losses: Fleet): Resources => {
  const alloy = flyingMaterial(losses, 'alloy');
  const crystal = flyingMaterial(losses, 'crystal');
  const deuterium = flyingMaterial(losses, 'deuterium');
  const total = alloy + crystal + deuterium;
  if (total <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const wreck = total * DEBRIS.share;
  return {
    alloy: wreck * alloy / total,
    crystal: wreck * crystal / total,
    deuterium: wreck * deuterium / total,
  };
};

async function createAttackerDebris(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  field: Resources | null,
  now: Date,
): Promise<void> {
  if (!field) return;
  // The position is stored beside the anchor rather than resolved through it, so
  // every reader has one place to look whether or not there is a world here. D150.
  const [at] = await tx
    .select({ x: planets.x, y: planets.y, z: planets.z })
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId));
  await tx.insert(debrisFields).values({
    seasonId: mission.seasonId,
    planetId: mission.targetPlanetId,
    x: at?.x ?? 0,
    y: at?.y ?? 0,
    z: at?.z ?? 0,
    missionId: mission.id,
    alloy: field.alloy,
    crystal: field.crystal,
    deuterium: field.deuterium,
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
    { attacker: { tech: mission.tech ?? {} }, defender: { tech: {} } },
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
  /*
    THE RAIDER'S OWN WRECK, AND WHAT ITS COLLECTORS LIFT OF IT. D200.
    Settled once, here, so the report, the field and the return leg all read the
    same remainder — the collectors take first, the public field is what is left.
  */
  const { salvage, field: wreck } = settleWreck(
    attackerWreck(result.attackerLosses),
    result.attackerSurvivors,
  );
  const lifted = salvage.alloy + salvage.crystal + salvage.deuterium > 0;
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
    // Attacker losses only: nothing a caretaker fields is left in orbit. What the
    // collectors left of it — the same field `createAttackerDebris` writes.
    wreckValue: wreck ? wreck.alloy + wreck.crystal + wreck.deuterium : 0,
    salvage,
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
      ...(lifted
        ? {
            salvageAlloy: salvage.alloy,
            salvageCrystal: salvage.crystal,
            salvageDeuterium: salvage.deuterium,
          }
        : {}),
      unitsLost: fleetCount(result.attackerLosses),
      shipsHome: fleetCount(result.attackerSurvivors),
      // A caretaker world is outside the ladder: taking one moves nobody's score.
      dominion: 0,
    },
    at: clock.now(),
    refId: mission.id,
  });

  await createAttackerDebris(tx, mission, wreck, clock.now());
  await clearMissionUnits(tx, mission.originPlanetId, mission.id);
  if (fleetCount(result.attackerSurvivors) > 0) {
    const home = fleetTravelExact(
      mission.distance,
      result.attackerSurvivors,
      { boost: fleetSpeedMult(attackerOrbit), tech: mission.tech ?? {} },
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
      salvage: lifted ? salvage : null,
      tech: mission.tech,
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
    fleetTravelExact(
      mission.distance,
      fleet,
      { boost: fleetSpeedMult(attackerOrbit), tech: mission.tech ?? {} },
    ),
  );
  const [ret] = await tx.insert(missions).values({
    seasonId: mission.seasonId,
    kind: 'return',
    ownerPlayerId: mission.ownerPlayerId,
    originPlanetId: mission.targetPlanetId,
    targetPlanetId: mission.originPlanetId,
    fleet,
    loot: { alloy: 0, crystal: 0, deuterium: 0 },
    tech: mission.tech,
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

/**
 * A CARETAKER WORLD RE-ARMS FOR FREE. D209, owner instruction.
 *
 * The garrison and the dome are topped back up to the template at every tick, and
 * neither is paid for: D209's garrisons cost more than a caretaker's stores can ever
 * hold (tier 2 ~20k alloy against a ~13k store), so a world that paid for its guard
 * would never be whole again after its first defeat. Buildings still rebuild out of
 * the stores — they only ever fall to a strike — and a building shortfall no longer
 * holds the guard back.
 *
 * AN OPEN CLAIM IS WAITED OUT, like a recovery. A claim opens only when the guard
 * has fallen, and the race it starts is for an unguarded world; re-arming it under
 * the settlers would be a fight nobody launched.
 */
export async function reinforceNeutral(
  tx: Tx,
  planetId: string,
  now: Date,
): Promise<Date | null> {
  // Acquisition/combat lock the world before its neutral state. Reversing that
  // order here deadlocks overlapping arrivals; wait on the world without holding
  // the state a settlement must update/delete.
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (world?.kind !== 'NEUTRAL') return null;
  const [state] = await tx.select().from(neutralPlanetState)
    .where(eq(neutralPlanetState.planetId, planetId)).for('update');
  if (!state) return null;
  const tier = state.tier as NeutralTier;
  const template = MULTI_WORLD.neutral[tier];
  if (template.reinforcementMinutes === null) return null;
  const waitUntil = [world.recoveryUntil, state.claimUntil]
    .filter((until): until is Date => until !== null && until > now)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (waitUntil) {
    await tx.update(neutralPlanetState)
      .set({ nextReinforcementAt: waitUntil })
      .where(eq(neutralPlanetState.planetId, planetId));
    return waitUntil;
  }

  const advanced = await advanceNeutralEconomy(tx, planetId, now);
  if (!advanced) return null;
  let alloy = advanced.alloy;
  let crystal = advanced.crystal;
  let deuterium = world.deuterium;
  const order: BuildingId[] = ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'];
  let infrastructureShort = false;
  for (const type of order) {
    if (infrastructureShort) break;
    let level = advanced.levels[type];
    const target = template.buildings[type];
    while (level < target) {
      const cost = buildingCost(type, level);
      if (alloy < cost.alloy || crystal < cost.crystal || deuterium < cost.deuterium) {
        infrastructureShort = true;
        break;
      }
      alloy -= cost.alloy;
      crystal -= cost.crystal;
      deuterium -= cost.deuterium;
      level++;
      await tx.update(buildings).set({ level })
        .where(and(eq(buildings.planetId, planetId), eq(buildings.type, type)));
    }
  }

  // The dome, to the template's own level and at no charge.
  const domeTarget: number = template.instruments.AEGIS;
  if (domeTarget > 0) {
    const [aegis] = await tx.select().from(satellites)
      .where(and(eq(satellites.planetId, planetId), eq(satellites.type, 'AEGIS')));
    if ((aegis?.level ?? 0) < domeTarget) {
      await tx.insert(satellites).values({ planetId, slot: 0, type: 'AEGIS', level: domeTarget })
        .onConflictDoUpdate({
          target: [satellites.planetId, satellites.slot],
          set: { type: 'AEGIS', level: domeTarget },
        });
    }
  }

  // The guard, to the template's own roster and at no charge. Never past it.
  const current = await neutralFleet(tx, planetId);
  const targets = { ...template.fleet, ...template.ground } as Fleet;
  for (const hull of ALL_HULLS) {
    const want = targets[hull] ?? 0;
    if ((current[hull] ?? 0) < want) current[hull] = want;
  }
  await setNeutralFleet(tx, planetId, current);
  await tx.update(planets).set({
    alloy,
    crystal,
    deuterium,
    // A free, whole dome means its charge too. In particular, a reinforcement
    // delayed to the end of the 27-minute claim has regenerated only a fraction
    // of its wall naturally; returning the guard with that sliver would make the
    // server weaker than both the owner rule and the simulator's template fight.
    shield: shieldHp(domeTarget),
  }).where(eq(planets.id, planetId));
  const next = addMinutes(now, template.reinforcementMinutes);
  await tx.update(neutralPlanetState).set({ nextReinforcementAt: next })
    .where(eq(neutralPlanetState.planetId, planetId));
  return next;
}
