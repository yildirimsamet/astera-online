import {
  REPAIR_LADDER, STARTER, advanceVesselEconomy, crateStates, fleetEntries, nextUnlockToAnnounce, openFeatures, repairProgress, vesselAegisHp, vesselPvpOpenAt,
  type HullId, type PlanetEconomyState, type ResearchProjectId, type VesselModules, type VesselProgress,
} from '@astera/rules';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { pushDevices, starterGalaxies, vesselMissions, vesselNotifications, vesselOrders, vesselUnits, vessels } from '../../db/schema.js';
import { publish } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { queueRepairNotice } from './noticeQueue.js';
import { ensureFirstRock } from './rocks.js';
import { GameError } from '../planet.js';

/** §3.10: a shield's end is told while there is still time to do something about it. */
const SHIELD_WARNING_MS = 60 * 60 * 1000;

export type VesselRow = typeof vessels.$inferSelect;
export type VesselOrderRow = typeof vesselOrders.$inferSelect;

export interface LockedVessel {
  returnEligible?: boolean;
  row: VesselRow;
  epoch: Date;
  galaxyOrdinal: number;
  /** The clock as it stood when the lock was granted, and the instant everything below is true of. */
  now: Date;
}

const minutesSince = (epoch: Date, at: Date): number => (at.getTime() - epoch.getTime()) / 60_000;

export const progressOf = (row: Pick<VesselRow, 'modules' | 'facts' | 'parts' | 'fuel'>): VesselProgress =>
  ({ modules: row.modules, facts: row.facts, parts: row.parts, fuel: row.fuel });

export const economyOf = (row: VesselRow): PlanetEconomyState => ({
  alloy: row.alloy,
  crystal: row.crystal,
  deuterium: row.deuterium,
  bufferAlloy: row.bufferAlloy,
  bufferCrystal: row.bufferCrystal,
  bufferDeuterium: row.bufferDeuterium,
  shield: row.shield,
  lastTickMinutes: row.lastTickMinutes,
  disruptedUntilMinutes: 0,
});

export const withEconomy = (row: VesselRow, state: PlanetEconomyState): VesselRow => ({
  ...row,
  alloy: state.alloy,
  crystal: state.crystal,
  deuterium: state.deuterium,
  bufferAlloy: state.bufferAlloy,
  bufferCrystal: state.bufferCrystal,
  bufferDeuterium: state.bufferDeuterium,
  shield: state.shield,
  lastTickMinutes: state.lastTickMinutes,
});

const advance = (row: VesselRow, epoch: Date, to: Date): VesselRow =>
  withEconomy(row, advanceVesselEconomy(economyOf(row), row.modules, minutesSince(epoch, to)));

export type VesselQueue = VesselOrderRow['queue'];

/** One queue's orders in turn, or everything under way aboard when no queue is named. */
export const activeOrders = (q: Queryable, vesselId: string, queue?: VesselQueue): Promise<VesselOrderRow[]> =>
  q.select().from(vesselOrders)
    .where(and(eq(vesselOrders.vesselId, vesselId), eq(vesselOrders.status, 'BUILDING'), queue ? eq(vesselOrders.queue, queue) : undefined))
    .orderBy(asc(vesselOrders.slot));

async function addHome(tx: Tx, vesselId: string, hull: HullId, count: number): Promise<void> {
  await tx.insert(vesselUnits).values({ vesselId, hull, location: 'HOME', count })
    .onConflictDoUpdate({
      target: [vesselUnits.vesselId, vesselUnits.hull, vesselUnits.location],
      set: { count: sql`${vesselUnits.count} + ${count}` },
    });
}

/** A yard job, a research project or a dock job comes to its end. Nothing of these moves the ladder. */
async function finishOtherOrder(tx: Tx, vessel: LockedVessel, order: VesselOrderRow): Promise<void> {
  let row = advance(vessel.row, vessel.epoch, order.readyAt);
  if (order.queue === 'YARD') {
    await addHome(tx, row.id, order.subject as HullId, order.count);
  } else if (order.queue === 'RESEARCH') {
    const id = order.subject as ResearchProjectId;
    row = { ...row, research: { ...row.research, [id]: Math.max(row.research[id] ?? 0, order.stage) } };
  } else {
    await tx.update(vesselUnits).set({ damage: [] }).where(and(eq(vesselUnits.vesselId, row.id), eq(vesselUnits.location, 'HOME')));
  }
  vessel.row = row;
  const long = order.queue === 'DOCK' && order.readyAt.getTime() - order.startedAt.getTime() >= 15 * 60_000;
  if (long) await queueRepairNotice(tx, row, order.readyAt);
  await tx.insert(vesselNotifications).values({
    vesselId: row.id, kind: `${order.queue}_DONE`, refId: order.id, payload: { subject: order.subject, count: order.count, stage: order.stage, long }, createdAt: order.readyAt,
  }).onConflictDoNothing();
  await publish(tx, row.id, 'private:vessel');
}

/**
 * ONE ORDER FINISHES: the module, what it gives, and the player told. Under the ship's lock, and
 * guarded by the order's own status, so the worker and a command that got here first cannot both
 * apply it. The ship is ticked up to the finish first: it made ore at the old rate until then.
 */
async function finishOrder(tx: Tx, vessel: LockedVessel, order: VesselOrderRow): Promise<void> {
  const claimed = await tx.update(vesselOrders).set({ status: 'DONE' })
    .where(and(eq(vesselOrders.id, order.id), eq(vesselOrders.status, 'BUILDING'))).returning({ id: vesselOrders.id });
  if (claimed.length === 0) return;
  if (order.queue !== 'CONSTRUCTION') {
    await finishOtherOrder(tx, vessel, order);
    return;
  }

  const step = REPAIR_LADDER.find(s => s.module === order.subject && s.stage === order.stage);
  if (!step) throw new Error(`no repair step for ${order.subject} ${String(order.stage)}`);
  const { module } = step;
  const modules: VesselModules = { ...vessel.row.modules, [module]: Math.max(vessel.row.modules[module] ?? 0, order.stage) };
  let row: VesselRow = { ...advance(vessel.row, vessel.epoch, order.readyAt), modules };
  if (step.grants?.deuterium) row = { ...row, deuterium: row.deuterium + step.grants.deuterium };
  for (const [hull, count] of fleetEntries(step.grants?.fleet ?? {})) await addHome(tx, row.id, hull, count);
  if (module === 'AEGIS' && order.stage === 1) {
    const falls = vesselPvpOpenAt(order.readyAt.getTime());
    // Charged from the first minute: the first raid lands within the quarter hour, and this is what it comes to teach.
    row = { ...row, pvpOpenAt: new Date(falls), shield: vesselAegisHp(order.stage) };
    await scheduleStarter(tx, { starterGalaxyId: row.starterGalaxyId, kind: 'pvp_shield_warning', refId: row.id, resolveAt: new Date(falls - SHIELD_WARNING_MS) });
  }
  const opens = openFeatures(progressOf(row)).size > openFeatures(progressOf(vessel.row)).size;
  vessel.row = row;
  if (!opens && order.readyAt.getTime() - order.startedAt.getTime() >= 15 * 60_000) await queueRepairNotice(tx, vessel.row, order.readyAt);
  if (module === 'SHIPYARD' && order.stage === 1) await ensureFirstRock(tx, vessel);

  await tx.insert(vesselNotifications).values({
    vesselId: row.id, kind: 'REPAIR_DONE', refId: order.id, payload: { module, stage: order.stage, long: !opens && order.readyAt.getTime() - order.startedAt.getTime() >= 15 * 60_000 }, createdAt: order.readyAt,
  }).onConflictDoNothing();
  await publish(tx, row.id, module === 'SURVEY' || module === 'TELESCOPE' ? 'private:vessel-sight' : 'private:vessel');
}

/** Everything due, in the order it fell due, and then the works up to now. */
export async function settleVessel(tx: Tx, vessel: LockedVessel): Promise<void> {
  const orders = await activeOrders(tx, vessel.row.id);
  for (const order of [...orders].sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime())) {
    if (order.readyAt > vessel.now) break;
    await finishOrder(tx, vessel, order);
  }
  vessel.row = advance(vessel.row, vessel.epoch, vessel.now);
}

export async function saveVessel(tx: Tx, row: VesselRow): Promise<void> {
  await tx.update(vessels).set({
    alloy: row.alloy,
    crystal: row.crystal,
    deuterium: row.deuterium,
    bufferAlloy: row.bufferAlloy,
    bufferCrystal: row.bufferCrystal,
    bufferDeuterium: row.bufferDeuterium,
    shield: row.shield,
    lastTickMinutes: row.lastTickMinutes,
    modules: row.modules,
    research: row.research,
    facts: row.facts,
    parts: row.parts,
    fuel: row.fuel,
    pvpOpenAt: row.pvpOpenAt,
    recoveryUntil: row.recoveryUntil,
    unlocksSeen: row.unlocksSeen,
    cratesOpened: row.cratesOpened,
    lastSeenAt: row.lastSeenAt,
    lastProgressAt: row.lastProgressAt,
  }).where(eq(vessels.id, row.id));
}

/**
 * NOT A KEY LOCK. A neighbour's flight names this ship, and that insert asks only for the row's key.
 * Two ships aiming at each other would otherwise each hold what the other is waiting for.
 */
async function lockBy(tx: Tx, where: ReturnType<typeof eq>, clock: Clock): Promise<LockedVessel | null> {
  const [found] = await tx.select({ row: vessels, returnEligible: sql<boolean>`exists(select 1 from ${pushDevices} where ${pushDevices.accountId} = ${vessels.accountId})`, epoch: starterGalaxies.epoch, galaxyOrdinal: starterGalaxies.ordinal }).from(vessels)
    .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
    .where(where).for('no key update', { of: vessels });
  return found ? { returnEligible: found.returnEligible, row: found.row, epoch: found.epoch, galaxyOrdinal: found.galaxyOrdinal, now: clock.now() } : null;
}

export const refuseLeft = (row: VesselRow): void => {
  // A second tab or device learns here that its ship has become a planet.
  if (row.status === 'DEPARTED') throw new GameError('PLACEMENT_CHANGED', 'Your ship has landed; refresh', 409);
};

/**
 * ONE TRANSACTION, THE SHIP LOCKED AND SETTLED. Every write goes through here, and what `fn` leaves
 * in `vessel.row` is saved, so no path can forget the lazy tick.
 */
export function withVesselLock<T>(db: Db, accountId: string, clock: Clock, fn: (tx: Tx, vessel: LockedVessel) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const vessel = await lockBy(tx, eq(vessels.accountId, accountId), clock);
    if (!vessel) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
    refuseLeft(vessel.row);
    // The hold has been counted: nothing may spend it now.
    if (vessel.row.status === 'DEPARTING') throw new GameError('MIGRATION_IN_PROGRESS', 'Your ship is already leaving', 409);
    await settleVessel(tx, vessel);
    const answer = await fn(tx, vessel);
    await saveVessel(tx, vessel.row);
    return answer;
  });
}

/** The jump's own door: it may find the ship already leaving, and joins that departure. */
export async function lockVesselForDeparture(tx: Tx, accountId: string, clock: Clock): Promise<LockedVessel> {
  const vessel = await lockBy(tx, eq(vessels.accountId, accountId), clock);
  if (!vessel) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(vessel.row);
  return vessel;
}

/** The worker's door, by ship and not by account. A deleted ship simply has nothing left to do. */
export async function settleVesselById(db: Db, vesselId: string, clock: Clock): Promise<void> {
  await db.transaction(async (tx) => {
    const vessel = await lockBy(tx, eq(vessels.id, vesselId), clock);
    if (!vessel) return;
    await settleVessel(tx, vessel);
    await saveVessel(tx, vessel.row);
  });
}

/** What the owner sees. Never sent for anyone else's ship; `publicView` is that (Faz 4). */
export async function vesselView(q: Queryable, row: VesselRow, epoch: Date, ordinal: number) {
  const orders = await activeOrders(q, row.id);
  const units = await q.select({ hull: vesselUnits.hull, count: vesselUnits.count, damage: vesselUnits.damage }).from(vesselUnits)
    .where(and(eq(vesselUnits.vesselId, row.id), eq(vesselUnits.location, 'HOME')));
  const progress = progressOf(row);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    quietAt: new Date(row.lastProgressAt.getTime() + STARTER.idleMs).toISOString(),
    galaxy: { id: row.starterGalaxyId, epoch: epoch.toISOString(), ordinal },
    position: { x: row.x, y: row.y, z: row.z },
    alloy: row.alloy,
    crystal: row.crystal,
    deuterium: row.deuterium,
    bufferAlloy: row.bufferAlloy,
    bufferCrystal: row.bufferCrystal,
    bufferDeuterium: row.bufferDeuterium,
    shield: row.shield,
    lastTickMinutes: row.lastTickMinutes,
    modules: row.modules,
    research: row.research,
    facts: row.facts,
    parts: row.parts,
    fuel: row.fuel,
    pvpOpenAt: row.pvpOpenAt?.toISOString() ?? null,
    recoveryUntil: row.recoveryUntil?.toISOString() ?? null,
    progress: repairProgress(progress),
    features: [...openFeatures(progress)],
    unlockToAnnounce: nextUnlockToAnnounce(progress, row.unlocksSeen),
    crates: crateStates(progress, row.cratesOpened),
    queue: orders.map(order => ({
      id: order.id, queue: order.queue, subject: order.subject, stage: order.stage, count: order.count,
      startedAt: order.startedAt.toISOString(), readyAt: order.readyAt.toISOString(), cost: order.cost,
    })),
    fleet: Object.fromEntries(units.filter(unit => unit.count > 0).map(unit => [unit.hull, unit.count])),
    damage: units.flatMap(unit => unit.damage),
    flying: (await q.select({ id: vesselMissions.id }).from(vesselMissions).where(and(
      eq(vesselMissions.ownerVesselId, row.id), inArray(vesselMissions.kind, ['ATTACK', 'RAID_SITE']), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']),
    ))).length,
    jumpFuel: STARTER.fuelForJump,
  };
}

export type VesselView = Awaited<ReturnType<typeof vesselView>>;

/**
 * READING DOES NOT WRITE, unless an order is overdue: then the worker is behind and this read
 * settles it, so that nobody ever looks at a repair that finished and did not happen.
 */
export async function readVessel(db: Db, accountId: string, clock: Clock): Promise<VesselView> {
  const [found] = await db.select({ row: vessels, epoch: starterGalaxies.epoch, galaxyOrdinal: starterGalaxies.ordinal }).from(vessels)
    .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
    .where(eq(vessels.accountId, accountId));
  if (!found) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(found.row);
  const now = clock.now();
  const orders = await activeOrders(db, found.row.id);
  if (orders.some(order => order.readyAt <= now)) {
    return withVesselLock(db, accountId, clock, (tx, vessel) => vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal));
  }
  return vesselView(db, advance(found.row, found.epoch, now), found.epoch, found.galaxyOrdinal);
}
