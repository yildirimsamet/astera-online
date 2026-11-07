import {
  STARTER, canAttackVessel, combatValue, distance, fleetCount, fleetEntries, fleetSpeed, isFeatureOpen, landHaulInWorks, missionFuel, moduleStage,
  normalizeHpDamage, partitionCombatFleet, sphereEntryFraction, travelExact, vesselSphere,
  type AttackAnswer, type Fleet, type HpDamageLot, type Vec3, type VesselStanding,
} from '@astera/rules';
import { count, and, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { starterEvents, starterSites, vesselMissions, vesselNotifications, vesselUnits, vessels } from '../../db/schema.js';
import { publish, publishShard } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { ringShip } from './push.js';
import { markProgress } from './quiet.js';
import { starterPendingView } from './traffic.js';
import { progressOf, vesselView, withVesselLock, type LockedVessel, type VesselRow } from './vessel.js';
import { assertFeatureOpen, inShips, missionFrom, missionTo, placeOf, takeFlightToRecall, type MissionRow } from './world.js';

const DAY_MS = 86_400_000;
const WINDOW_MS = STARTER.pvp.bashWindowMinutes * 60_000;

export interface HomeWing { fleet: Fleet; damage: HpDamageLot[] }

export async function readHome(q: Queryable, vesselId: string): Promise<HomeWing> {
  const rows = await q.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, vesselId), eq(vesselUnits.location, 'HOME')));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return { fleet, damage: normalizeHpDamage(fleet, rows.flatMap(row => row.damage)) };
}

export async function writeHome(tx: Tx, vesselId: string, wing: HomeWing): Promise<void> {
  await tx.delete(vesselUnits).where(and(eq(vesselUnits.vesselId, vesselId), eq(vesselUnits.location, 'HOME')));
  for (const [hull, count] of fleetEntries(wing.fleet)) {
    await tx.insert(vesselUnits).values({ vesselId, hull, location: 'HOME', count, damage: wing.damage.filter(lot => lot.hull === hull) });
  }
}

/**
 * TAKES SHIPS OFF THE DECK, the soundest first, so that a wing leaves as strong as it can be. Ships
 * too hurt to fire stay: the main rule, and the reason a fleet can never fly to die without shooting.
 */
export function takeFromHome(home: HomeWing, sent: Fleet): { left: HomeWing; flying: HomeWing } {
  const ready = partitionCombatFleet(home.fleet, home.damage);
  const left: HomeWing = { fleet: { ...home.fleet }, damage: [] };
  const flying: HomeWing = { fleet: {}, damage: [] };
  for (const [hull, count] of fleetEntries(sent)) {
    if (count > (ready.eligible[hull] ?? 0)) throw new GameError('NOT_ENOUGH_SHIPS', 'Not enough of that hull ready at home', 409, { hull });
    left.fleet[hull] = (left.fleet[hull] ?? 0) - count;
    flying.fleet[hull] = count;
    const lots = home.damage.filter(lot => lot.hull === hull).sort((a, b) => a.damageBp - b.damageBp);
    const sound = (home.fleet[hull] ?? 0) - lots.reduce((sum, lot) => sum + lot.count, 0);
    let due = count - Math.min(count, sound);
    for (const lot of lots) {
      const took = Math.min(lot.count, due);
      if (took > 0) flying.damage.push({ ...lot, count: took });
      if (lot.count > took) left.damage.push({ ...lot, count: lot.count - took });
      due -= took;
    }
  }
  for (const lot of home.damage) if (!sent[lot.hull]) left.damage.push(lot);
  left.fleet = Object.fromEntries(fleetEntries(left.fleet).filter(([, count]) => count > 0));
  return { left, flying };
}

/** This galaxy's whole protection model, read from what the rows say now (§3.6). */
export async function attackAnswer(q: Queryable, attacker: VesselRow, target: VesselRow, now: Date, flying?: string): Promise<AttackAnswer> {
  const since = new Date(now.getTime() - Math.max(WINDOW_MS, DAY_MS));
  const shots = await q.select({ id: vesselMissions.id, owner: vesselMissions.ownerVesselId, departAt: vesselMissions.departAt, arriveAt: vesselMissions.arriveAt, cargo: vesselMissions.cargo, status: vesselMissions.status })
    .from(vesselMissions).where(and(eq(vesselMissions.targetVesselId, target.id), eq(vesselMissions.kind, 'ATTACK'), gt(vesselMissions.departAt, since), isNotNull(vesselMissions.ownerVesselId)));
  return canAttackVessel({
    attacker: standing(attacker),
    target: standing(target),
    nowMs: now.getTime(),
    attacksByAttackerOnTargetMs: shots.filter(shot => shot.owner === attacker.id && shot.id !== flying).map(shot => shot.departAt.getTime()),
    successfulRaidsOnTargetMs: shots.filter(shot => shot.cargo.alloy + shot.cargo.crystal + shot.cargo.deuterium > 0).map(shot => shot.arriveAt.getTime()),
  });
}

const standing = (row: VesselRow): VesselStanding => ({
  id: row.id, status: row.status, progress: progressOf(row), enlistedAtMs: row.enlistedAt.getTime(),
  pvpOpenAtMs: row.pvpOpenAt?.getTime() ?? null, recoveryUntilMs: row.recoveryUntil?.getTime() ?? null,
});

const ATTACK_MESSAGES = {
  FEATURE_LOCKED: ['That system is still broken', 403],
  PVP_LOCKED: ['This ship can no longer attack anyone here', 409],
  PVP_PROTECTED: ['That ship is protected for now', 409],
  TARGET_GONE: ['That ship is not there', 409],
  BASH_LIMIT: ['You have struck that ship enough for now', 409],
  RAID_CAP: ['That ship has been raided enough for today', 409],
} as const;

export const flyingAttacks = (q: Queryable, vesselId: string) => q.select({ id: vesselMissions.id }).from(vesselMissions).where(and(
  eq(vesselMissions.ownerVesselId, vesselId), inArray(vesselMissions.kind, ['ATTACK', 'RAID_SITE']), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']),
));

const bayCount = (stage: number): number => STARTER.attackBays[Math.max(0, Math.min(stage, STARTER.attackBays.length) - 1)]!;

interface LaunchBody { targetPlanetId: string; fleet: Fleet; acknowledgeShieldLoss?: boolean | undefined }

async function sayWhatFlew(tx: Tx, vessel: LockedVessel, mission: MissionRow, clock: Clock) {
  const { pending } = await starterPendingView(tx, vessel.row, clock);
  const home = await readHome(tx, vessel.row.id);
  return {
    missionId: mission.id,
    arriveAt: mission.arriveAt,
    exposureMinutes: (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000,
    homeDefenceAfter: combatValue(home.fleet),
    pending,
    vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal),
  };
}

export const launchVesselFleet = (db: Db, accountId: string, body: LaunchBody, key: string | undefined, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    if (key) {
      const [seen] = await tx.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, vessel.row.id), eq(vesselMissions.idempotencyKey, key)));
      if (seen) return sayWhatFlew(tx, vessel, seen, clock);
    }
    assertFeatureOpen(vessel.row, 'fleet');
    // First, because waking can move the ship: everything below reads where it stands now. A refusal undoes it.
    await markProgress(tx, vessel, clock);
    const { row } = vessel;
    const [ship] = await tx.select().from(vessels).where(and(eq(vessels.id, body.targetPlanetId), eq(vessels.starterGalaxyId, row.starterGalaxyId)));
    const [site] = ship ? [] : await tx.select().from(starterSites).where(and(eq(starterSites.id, body.targetPlanetId), eq(starterSites.starterGalaxyId, row.starterGalaxyId), eq(starterSites.kind, 'OUTPOST')));
    if (!ship && !site) throw new GameError('PLANET_NOT_FOUND', 'Nothing like that in this galaxy', 404, { context: 'ship' });
    // A ship's own answer asks this too. The menu is not the lock (§3.7).
    if (site) assertFeatureOpen(row, 'attack');

    if (ship) {
      const answer = await attackAnswer(tx, row, ship, vessel.now);
      if (!answer.ok) {
        const [message, status] = ATTACK_MESSAGES[answer.code];
        throw new GameError(answer.code, message, status);
      }
      if (answer.dropsOwnShield) {
        if (!body.acknowledgeShieldLoss) throw new GameError('ATTACK_DROPS_SHIELD', 'This attack ends your own protection', 409);
        vessel.row = { ...vessel.row, pvpOpenAt: vessel.now, recoveryUntil: null };
      }
    }

    if (fleetCount(body.fleet) <= 0 || combatValue(body.fleet) <= 0) throw new GameError('NO_ARMED_SHIPS', 'Send at least one armed ship', 400);
    const flights = await flyingAttacks(tx, row.id);
    if (flights.length >= bayCount(moduleStage(progressOf(row), 'HANGAR'))) throw new GameError('NO_ATTACK_BAY', 'Every attack bay is flying', 409);

    const { left, flying } = takeFromHome(await readHome(tx, row.id), body.fleet);
    const from = placeOf(row);
    const to: Vec3 = ship ? placeOf(ship) : { x: site!.x, y: site!.y, z: site!.z };
    const span = distance(from, to);
    const fuelPaid = isFeatureOpen(progressOf(row), 'deuterium') ? missionFuel(flying.fleet, span, 2) : 0;
    if (vessel.row.deuterium < fuelPaid) throw new GameError('INSUFFICIENT_DEUTERIUM', 'Not enough Deuterium for that flight', 409, { need: fuelPaid });
    vessel.row = { ...vessel.row, deuterium: vessel.row.deuterium - fuelPaid };
    await writeHome(tx, row.id, left);

    const minutes = travelExact(span, fleetSpeed(flying.fleet, row.research));
    const arriveAt = new Date(vessel.now.getTime() + minutes * 60_000);
    const [mission] = await tx.insert(vesselMissions).values({
      starterGalaxyId: row.starterGalaxyId, ownerVesselId: row.id, kind: ship ? 'ATTACK' : 'RAID_SITE',
      ...(ship ? { targetVesselId: ship.id } : { targetSiteId: site!.id }),
      fromX: from.x, fromY: from.y, fromZ: from.z, toX: to.x, toY: to.y, toZ: to.z,
      fleet: flying.fleet, damage: flying.damage, fuelPaid, departAt: vessel.now, arriveAt, ...(key ? { idempotencyKey: key } : {}),
    }).returning();
    await scheduleStarter(tx, { starterGalaxyId: row.starterGalaxyId, kind: 'vessel_mission_arrival', refId: mission!.id, resolveAt: arriveAt });
    if (ship) await warnInReach(tx, mission!, ship, vessel.now);
    await publishShard(tx, row.starterGalaxyId, 'launch');
    return sayWhatFlew(tx, vessel, mission!, clock);
  });

/** The moment a craft crosses into a radar's reach, which is when the owner hears of it. */
export async function warnInReach(tx: Tx, mission: MissionRow, target: VesselRow, now: Date): Promise<void> {
  const progress = progressOf(target);
  const reach = vesselSphere(placeOf(target), moduleStage(progress, 'TELESCOPE'), moduleStage(progress, 'RADAR'), target.id).detect;
  const fraction = sphereEntryFraction(missionFrom(mission), missionTo(mission), placeOf(target), reach);
  if (fraction === null) return;
  const span = mission.arriveAt.getTime() - mission.departAt.getTime();
  const at = new Date(Math.max(now.getTime(), mission.departAt.getTime() + span * fraction));
  await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_radar_warning', refId: mission.id, resolveAt: at });
}

/** The owner hears only that something is coming and when. A craft recalled before now says nothing. */
export async function deliverRadarWarning(db: Db, missionId: string, clock: Clock): Promise<void> {
  const told = await db.transaction(async (tx) => {
    const [mission] = await tx.select().from(vesselMissions).where(eq(vesselMissions.id, missionId));
    if (!mission?.targetVesselId || mission.status !== 'OUTBOUND') return null;
    const fresh = await tx.insert(vesselNotifications).values({
      vesselId: mission.targetVesselId, kind: 'RADAR_WARNING', refId: missionId, payload: { arriveAt: mission.arriveAt.toISOString() },
      createdAt: new Date(mission.departAt.getTime()),
    }).onConflictDoNothing().returning({ id: vesselNotifications.id });
    await publish(tx, mission.targetVesselId, 'private:vessel-sight');
    return fresh.length > 0 ? mission : null;
  });
  // Only the delivery that wrote the row rings: the queue delivers at least once, a phone rings once.
  if (told?.targetVesselId) {
    await ringShip(db, told.targetVesselId, { kind: 'incoming_attack', refId: told.id, minutes: Math.max(1, Math.ceil((told.arriveAt.getTime() - clock.now().getTime()) / 60_000)) }, clock.now());
  }
}

/** An hour's notice, told once. A shield given up since it was booked has nothing left to warn about. */
export async function warnShieldFalling(db: Db, vesselId: string, clock: Clock): Promise<void> {
  const told = await db.transaction(async (tx) => {
    const now = clock.now();
    const [ship] = await tx.select({ status: vessels.status, pvpOpenAt: vessels.pvpOpenAt }).from(vessels).where(eq(vessels.id, vesselId));
    if (!ship?.pvpOpenAt || ship.status === 'DEPARTED' || ship.pvpOpenAt <= now) return false;
    const fresh = await tx.insert(vesselNotifications).values({
      vesselId, kind: 'SHIELD_WARNING', refId: vesselId, payload: { until: ship.pvpOpenAt.toISOString() }, createdAt: now,
    }).onConflictDoNothing().returning({ id: vesselNotifications.id });
    await publish(tx, vesselId, 'private:vessel-sight');
    return fresh.length > 0;
  });
  if (told) await ringShip(db, vesselId, { kind: 'shield_falling', refId: vesselId }, clock.now());
}

/** Turns round where it is, and takes as long to come home as it took to get there. */
export const recallVesselFleet = (db: Db, accountId: string, missionId: string, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    const [mission] = await tx.select().from(vesselMissions).where(and(eq(vesselMissions.id, missionId), eq(vesselMissions.ownerVesselId, vessel.row.id)));
    if (!mission || mission.kind === 'PROBE') throw new GameError('MISSION_NOT_FOUND', 'No such flight', 404);
    const now = vessel.now;
    if (mission.status !== 'OUTBOUND' || mission.arriveAt <= now || !await takeFlightToRecall(tx, mission.id)) throw new GameError('NOT_RECALLABLE', 'That flight can no longer turn back', 409);
    const flown = now.getTime() - mission.departAt.getTime();
    const returnAt = new Date(now.getTime() + flown);
    const share = flown / (mission.arriveAt.getTime() - mission.departAt.getTime());
    const from = missionFrom(mission), to = missionTo(mission);
    const claimed = await tx.update(vesselMissions).set({
      status: 'RETURNING', returnAt, departAt: now, arriveAt: now,
      toX: from.x + (to.x - from.x) * share, toY: from.y + (to.y - from.y) * share, toZ: from.z + (to.z - from.z) * share,
    }).where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'OUTBOUND'))).returning({ id: vesselMissions.id });
    if (claimed.length === 0) throw new GameError('NOT_RECALLABLE', 'That flight can no longer turn back', 409);
    await tx.update(starterEvents).set({ status: 'done', claimedAt: null }).where(and(eq(starterEvents.refId, mission.id), inArray(starterEvents.kind, ['vessel_mission_arrival', 'vessel_radar_warning']), inArray(starterEvents.status, ['pending', 'processing'])));
    await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_mission_return', refId: mission.id, resolveAt: returnAt });
    await publishShard(tx, mission.starterGalaxyId, 'launch');
    return { missionId: mission.id, arriveAt: returnAt };
  });

/** Home: ships back on the deck, what they carry in the hold. Claimed, so a redelivery brings nothing. */
export async function landMission(tx: Tx, mission: MissionRow, clock: Clock): Promise<void> {
  if (!mission.ownerVesselId) {
    await tx.update(vesselMissions).set({ status: 'DONE' }).where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'RETURNING')));
    return;
  }
  await inShips(tx, [mission.ownerVesselId], clock, async (_, ships) => {
    const claimed = await tx.update(vesselMissions).set({ status: 'DONE' })
      .where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'RETURNING'))).returning({ id: vesselMissions.id });
    if (claimed.length === 0) return;
    const owner = ships.get(mission.ownerVesselId!);
    if (!owner) return;
    const home = await readHome(tx, owner.row.id);
    const fleet: Fleet = { ...home.fleet };
    for (const [hull, count] of fleetEntries(mission.fleet)) fleet[hull] = (fleet[hull] ?? 0) + count;
    await writeHome(tx, owner.row.id, { fleet, damage: [...home.damage, ...normalizeHpDamage(mission.fleet, mission.damage)] });
    // Dug or salvaged, a haul lands in the works and waits to be collected, as a world's does (owner
    // K3). Spoils taken in a fight go straight to the store, as they do in the main game.
    const mined = mission.kind === 'MINE';
    const landed = mined ? landHaulInWorks(owner.row, owner.row.modules, mission.cargo) : null;
    owner.row = {
      ...owner.row,
      ...(landed ? landed.buffer : {
        alloy: owner.row.alloy + mission.cargo.alloy,
        crystal: owner.row.crystal + mission.cargo.crystal,
        deuterium: owner.row.deuterium + mission.cargo.deuterium,
      }),
      parts: owner.row.parts + (mission.carriesPart ? 1 : 0),
      facts: mission.kind === 'MINE' && !owner.row.facts.includes('FIRST_MINING_RETURN') ? [...owner.row.facts, 'FIRST_MINING_RETURN'] : owner.row.facts,
    };
    if (mined) {
      const [returns] = await tx.select({ n: count() }).from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, owner.row.id), eq(vesselMissions.kind, 'MINE'), eq(vesselMissions.status, 'DONE')));
      if ((returns?.n ?? 0) <= 3 || mission.carriesPart) await scheduleStarter(tx, {
        starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_push', refId: owner.row.id,
        dedupeKey: `miner-home:${mission.id}`, payload: { kind: 'miner_home', refId: mission.id }, resolveAt: owner.now,
      });
    }
    await tx.insert(vesselNotifications).values({
      vesselId: owner.row.id, kind: 'FLEET_HOME', refId: mission.id, payload: { kind: mission.kind, cargo: mission.cargo, part: mission.carriesPart, ships: fleetCount(mission.fleet), ...(landed ? { wasted: landed.wasted } : {}) }, createdAt: owner.now,
    }).onConflictDoNothing();
    await publish(tx, owner.row.id, 'private:vessel-sight');
  });
}

/** A leg with nothing to do at its end. */
export async function turnBack(tx: Tx, mission: MissionRow, now: Date): Promise<void> {
  const span = mission.arriveAt.getTime() - mission.departAt.getTime();
  const returnAt = new Date(mission.arriveAt.getTime() + span);
  const claimed = await tx.update(vesselMissions).set({ status: 'RETURNING', returnAt })
    .where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'OUTBOUND'))).returning({ id: vesselMissions.id });
  if (claimed.length === 0) return;
  await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_mission_return', refId: mission.id, resolveAt: returnAt });
  if (mission.ownerVesselId) {
    await tx.insert(vesselNotifications).values({
      vesselId: mission.ownerVesselId, kind: 'FLEET_TURNED_BACK', refId: mission.id, payload: {}, createdAt: now,
    }).onConflictDoNothing();
    await publish(tx, mission.ownerVesselId, 'private:vessel-sight');
  }
}

export const lastFlightTo = (q: Queryable, vesselId: string) => q.select().from(vesselMissions)
  .where(eq(vesselMissions.targetVesselId, vesselId)).orderBy(desc(vesselMissions.departAt)).limit(1);

