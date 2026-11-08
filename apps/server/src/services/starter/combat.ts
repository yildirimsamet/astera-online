import {
  MULTI_WORLD, STARTER, STARTER_PVP_BALANCE, activeBattleFleet, battleDebrisOf, canTakePart, cargoWasLimited, computeLoot, fleetCargo, fleetCount, fleetEntries,
  garrisonOf, moduleStage, normalizeHpDamage, outpostHaul, partsVisible, recoveryUntilAfter, seededFrom, starterBattle, vaultProtects, vesselAegisHp, vesselEconomyInput, vesselHull,
  type BattleResult, type Fleet, type Resources, type StarterBattleRecord, type VesselFact,
} from '@astera/rules';
import { and, desc, eq } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Tx } from '../../db/client.js';
import { starterSites, vesselBattleReports, vesselMissions, vesselNotifications } from '../../db/schema.js';
import { publish, publishShard } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { buildBattleReplay, prepareBattleReplay } from '../battleReplay.js';
import { attackAnswer, readHome, turnBack, writeHome } from './fleet.js';
import { progressOf, type LockedVessel, type VesselRow } from './vessel.js';
import { inShips, mayTakePart, placeOf, siteName, type MissionRow } from './world.js';

const addFact = (row: VesselRow, fact: VesselFact): VesselRow => row.facts.includes(fact) ? row : { ...row, facts: [...row.facts, fact] };
const NOTHING: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/** Everything that happens after the guns, for one side that came and one that stood. */
async function afterBattle(tx: Tx, input: {
  mission: MissionRow; result: BattleResult; attacker: LockedVessel | undefined; defender: LockedVessel | undefined;
  loot: Resources; carriesPart: boolean; written: Omit<StarterBattleRecord, 'grade' | 'rounds' | 'attackerLosses' | 'defenderLosses' | 'attackerRetreated' | 'defenderRetreated' | 'attackerDamage' | 'defenderDamage' | 'wreckValue'>;
  names: { attacker: string; defender: string }; siteId: string | null; replay: ReturnType<typeof buildBattleReplay>; now: Date; at: { x: number; y: number; z: number };
  /** What only the side that came is told. */
  toAttacker?: { firstVictory?: boolean; firstDefeat?: boolean; beatenBy?: string };
}): Promise<void> {
  const { mission, result, attacker, defender, now } = input;
  const debris = battleDebrisOf(result.attackerLosses, result.defenderLosses);
  if (debris) {
    await tx.insert(starterSites).values({
      starterGalaxyId: mission.starterGalaxyId, kind: 'BATTLE_WRECK', x: input.at.x, y: input.at.y, z: input.at.z,
      ...debris, stockFull: debris.alloy + debris.crystal + debris.deuterium,
      expiresAt: new Date(now.getTime() + STARTER.battleDebris.decayMinutes * 60_000), createdAt: now,
    });
    await publishShard(tx, mission.starterGalaxyId, 'mining');
  }
  const survivors = result.attackerSurvivors;
  const span = mission.arriveAt.getTime() - mission.departAt.getTime();
  // From when it landed, not from when the worker got here: a late queue does not lengthen a flight.
  const returnAt = new Date(mission.arriveAt.getTime() + span);
  const anyLeft = fleetCount(survivors) > 0;
  await tx.update(vesselMissions).set({
    status: anyLeft ? 'RETURNING' : 'DONE',
    returnAt: anyLeft ? returnAt : null,
    fleet: survivors,
    damage: normalizeHpDamage(survivors, result.attackerDamage),
    cargo: anyLeft ? input.loot : NOTHING,
    carriesPart: anyLeft && input.carriesPart,
  }).where(eq(vesselMissions.id, mission.id));
  if (anyLeft) await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_mission_return', refId: mission.id, resolveAt: returnAt });

  const record: StarterBattleRecord = {
    ...input.written,
    grade: result.grade, rounds: result.rounds,
    attackerLosses: result.attackerLosses, defenderLosses: result.defenderLosses,
    attackerRetreated: result.attackerRetreated ?? {}, defenderRetreated: result.defenderRetreated ?? {},
    attackerDamage: result.attackerDamage, defenderDamage: result.defenderDamage,
    wreckValue: debris ? debris.alloy + debris.crystal + debris.deuterium : 0,
  };
  const [report] = await tx.insert(vesselBattleReports).values({
    starterGalaxyId: mission.starterGalaxyId, missionId: mission.id,
    attackerVesselId: attacker?.row.id ?? null, defenderVesselId: defender?.row.id ?? null, siteId: input.siteId,
    attackerName: input.names.attacker, defenderName: input.names.defender, at: now, grade: result.grade,
    result: record, replay: input.replay, rulesetVersion: MULTI_WORLD.rulesetVersion,
  }).returning({ id: vesselBattleReports.id });

  for (const [side, opponent, attacking] of [[attacker, input.names.defender, true], [defender, input.names.attacker, false]] as const) {
    if (!side) continue;
    side.row = addFact(side.row, 'FIRST_BATTLE_REPORT');
    await tx.insert(vesselNotifications).values({
      vesselId: side.row.id, kind: 'BATTLE_REPORT', refId: report!.id, createdAt: now,
      payload: {
        grade: result.grade, attacking, opponent, loot: input.loot, lost: fleetCount(attacking ? result.attackerLosses : result.defenderLosses),
        // The kind, not the name: anyone may call their ship PIRATE.
        opponentKind: attacking ? (input.siteId ? 'OUTPOST' : 'SHIP') : (attacker ? 'SHIP' : 'PIRATES'),
        ...(attacking ? input.toAttacker : {}),
      },
    }).onConflictDoNothing();
    await publish(tx, side.row.id, 'private:vessel-sight');
  }
  await publishShard(tx, mission.starterGalaxyId, 'arrival');
}

/** One fight, one transaction. The mission row is locked by the caller and `claim` keeps it single. */
export async function resolveVesselBattle(tx: Tx, mission: MissionRow, clock: Clock): Promise<void> {
  if (mission.targetSiteId) return resolveOutpostBattle(tx, mission, clock);
  const ids = [mission.ownerVesselId, mission.targetVesselId].filter((id): id is string => id !== null);
  await inShips(tx, ids, clock, async (_, ships) => {
    const now = clock.now();
    const attacker = mission.ownerVesselId ? ships.get(mission.ownerVesselId) : undefined;
    const defender = mission.targetVesselId ? ships.get(mission.targetVesselId) : undefined;
    if (defender?.row.status !== 'ACTIVE') return turnBack(tx, mission, now);
    if (attacker) {
      const answer = await attackAnswer(tx, attacker.row, defender.row, now, mission.id);
      if (!answer.ok) return turnBack(tx, mission, now);
    }
    const home = await readHome(tx, defender.row.id);
    const line = garrisonOf(home.fleet, {});
    const spared: Fleet = {};
    for (const [hull, count] of fleetEntries(home.fleet)) if (!line[hull]) spared[hull] = count;
    const stacks = [{ contributionId: mission.id, playerId: attacker?.row.id ?? 'pirate', fleet: mission.fleet, tech: { tech: attacker?.row.research ?? {} }, damage: mission.damage }];
    const standing = [{ stackId: defender.row.id, playerId: defender.row.id, fleet: line, tech: { tech: defender.row.research }, damage: home.damage.filter(lot => line[lot.hull]) }];
    const capture = prepareBattleReplay(stacks, standing);
    const result = starterBattle(stacks, standing, defender.row.shield, seededFrom(mission.id), capture.recording);

    const works = vesselEconomyInput(defender.row.modules);
    const hold = fleetCargo(activeBattleFleet(result.attackerSurvivors, result.attackerRetreated), attacker?.row.research ?? {});
    const stock = { alloy: defender.row.alloy, crystal: defender.row.crystal, deuterium: defender.row.deuterium };
    const buffer = { alloy: defender.row.bufferAlloy, crystal: defender.row.bufferCrystal, deuterium: defender.row.bufferDeuterium };
    const vault = vaultProtects(works.vaultLevel, works.refineryLevel, works.extractorLevel, works.plantLevel);
    const loot = computeLoot(stock, buffer, vault, result.grade, hold, STARTER_PVP_BALANCE);
    const uncapped = computeLoot(stock, buffer, vault, result.grade, Number.MAX_SAFE_INTEGER, STARTER_PVP_BALANCE);
    const recovery = recoveryUntilAfter(result.grade, now.getTime());

    defender.row = {
      ...defender.row,
      alloy: stock.alloy - loot.fromStock.alloy, crystal: stock.crystal - loot.fromStock.crystal, deuterium: stock.deuterium - loot.fromStock.deuterium,
      bufferAlloy: buffer.alloy - loot.fromBuffer.alloy, bufferCrystal: buffer.crystal - loot.fromBuffer.crystal, bufferDeuterium: buffer.deuterium - loot.fromBuffer.deuterium,
      shield: result.shieldLeft,
      ...(recovery ? { recoveryUntil: new Date(recovery) } : {}),
    };
    const stood: Fleet = { ...spared };
    for (const [hull, count] of fleetEntries(result.defenderSurvivors)) stood[hull] = (stood[hull] ?? 0) + count;
    await writeHome(tx, defender.row.id, {
      fleet: stood,
      damage: normalizeHpDamage(stood, result.defenderDamage),
    });

    const replay = buildBattleReplay(capture, result, { environment: 'VESSEL', vessel: { hull: vesselHull(defender.row.id) }, aegisCapacity: vesselAegisHp(moduleStage(progressOf(defender.row), 'AEGIS')), defenceOffline: false, escape: null, control: null });
    await afterBattle(tx, {
      mission, result, attacker, defender, loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium }, carriesPart: false, siteId: null, replay, now,
      at: placeOf(defender.row),
      names: { attacker: attacker?.row.name ?? 'PIRATE', defender: defender.row.name },
      written: {
        attackerSent: mission.fleet, defenderSent: line,
        loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
        cargoLimited: cargoWasLimited(uncapped, loot, hold),
        shieldBefore: standingShield(defender, result), shieldAfter: result.shieldLeft,
        recoveryUntil: recovery ? new Date(recovery).toISOString() : null, siteKind: null, guardDownUntil: null,
      },
    });
  });
}

const standingShield = (defender: LockedVessel, result: BattleResult): number =>
  result.rounds[0]?.shieldBefore ?? defender.row.shield;

/** Whose raid left this outpost without its guard, when it was not this ship's own. */
async function clearedBy(tx: Tx, siteId: string, vesselId: string): Promise<string | null> {
  const [last] = await tx.select({ by: vesselBattleReports.attackerVesselId, name: vesselBattleReports.attackerName })
    .from(vesselBattleReports).where(eq(vesselBattleReports.siteId, siteId)).orderBy(desc(vesselBattleReports.at)).limit(1);
  return last && last.by !== vesselId ? last.name : null;
}

async function resolveOutpostBattle(tx: Tx, mission: MissionRow, clock: Clock): Promise<void> {
  await inShips(tx, mission.ownerVesselId ? [mission.ownerVesselId] : [], clock, async (_, ships) => {
    const now = clock.now();
    const attacker = mission.ownerVesselId ? ships.get(mission.ownerVesselId) : undefined;
    const [site] = await tx.select().from(starterSites).where(eq(starterSites.id, mission.targetSiteId!)).for('update');
    if (!site || !attacker) return turnBack(tx, mission, now);

    const guard = site.guard ?? {};
    const stacks = [{ contributionId: mission.id, playerId: attacker.row.id, fleet: mission.fleet, tech: { tech: attacker.row.research }, damage: mission.damage }];
    const standing = [{ stackId: site.id, playerId: '', fleet: guard, tech: { tech: {} }, maintenanceExempt: true }];
    const capture = prepareBattleReplay(stacks, standing);
    const result = starterBattle(stacks, standing, 0, seededFrom(mission.id), capture.recording);

    const hold = fleetCargo(activeBattleFleet(result.attackerSurvivors, result.attackerRetreated), attacker.row.research);
    const stock = { alloy: site.alloy, crystal: site.crystal, deuterium: site.deuterium };
    const haul = outpostHaul(stock, result.grade, hold);
    const wanted = outpostHaul(stock, result.grade, Number.MAX_SAFE_INTEGER);
    const decisive = result.grade === 'DECISIVE';
    const carriesPart = decisive && site.hasPart && partsVisible(progressOf(attacker.row)) && canTakePart(attacker.row.parts) && await mayTakePart(tx, attacker.row);
    // Retreating craft survive the battle but no longer stand at the outpost.
    const remainingGuard = activeBattleFleet(result.defenderSurvivors, result.defenderRetreated);
    const cleared = fleetCount(remainingGuard) === 0;
    // Any mark starts the clock: a guard that only fled, or a stock only part taken, has to come back too.
    const marked = cleared || fleetCount(remainingGuard) < fleetCount(site.guardFull ?? {}) || haul.alloy + haul.crystal + haul.deuterium > 0;
    const respawnAt = marked ? site.respawnAt ?? new Date(now.getTime() + STARTER.sites.outposts.respawnMinutes * 60_000) : site.respawnAt;
    await tx.update(starterSites).set({
      guard: remainingGuard,
      alloy: site.alloy - haul.alloy, crystal: site.crystal - haul.crystal, deuterium: site.deuterium - haul.deuterium,
      hasPart: site.hasPart && !carriesPart,
      respawnAt,
    }).where(and(eq(starterSites.id, site.id)));

    // The first decisive one unseals the yard's victory crate (N9): the holds alone would leave it a loss.
    // Over a guard that was there: landing on one somebody else took is no victory (plan §5, beaten to it).
    const found = fleetCount(guard) > 0;
    const firstVictory = decisive && found && !attacker.row.facts.includes('FIRST_OUTPOST_VICTORY');
    if (firstVictory) attacker.row = addFact(attacker.row, 'FIRST_OUTPOST_VICTORY');
    // The first fight not won pays a little, once, while the hunt is still on (owner 2026-11-09).
    const firstDefeat = !decisive && found && !attacker.row.facts.includes('FIRST_OUTPOST_VICTORY') && !attacker.row.facts.includes('FIRST_OUTPOST_DEFEAT');
    if (firstDefeat) attacker.row = addFact(attacker.row, 'FIRST_OUTPOST_DEFEAT');
    const beatenBy = found ? null : await clearedBy(tx, site.id, attacker.row.id);
    const replay = buildBattleReplay(capture, result, { environment: 'PLANET', aegisCapacity: 0, defenceOffline: false, escape: null, control: null });
    await afterBattle(tx, {
      mission, result, attacker, defender: undefined, loot: haul, carriesPart, siteId: site.id, replay, now,
      at: { x: site.x, y: site.y, z: site.z },
      names: { attacker: attacker.row.name, defender: siteName(site) },
      written: {
        attackerSent: mission.fleet, defenderSent: guard, loot: haul,
        cargoLimited: cargoWasLimited(wanted, haul, hold),
        shieldBefore: 0, shieldAfter: 0, recoveryUntil: null, siteKind: 'OUTPOST',
        guardDownUntil: cleared && respawnAt ? respawnAt.toISOString() : null,
        ...(firstVictory ? { firstVictory } : {}), beatenBy,
      },
      toAttacker: { ...(firstVictory ? { firstVictory } : {}), ...(firstDefeat ? { firstDefeat } : {}), ...(beatenBy ? { beatenBy } : {}) },
    });
  });
}
