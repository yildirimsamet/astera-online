import {
  REPAIR_LADDER, STARTER, STARTER_CRATES, afterQueue, canOrderStep, cancelRefund, collectVessel, isFeatureOpen, readyCrates, stepDependsOn,
  type RepairStep, type StarterFeature, type StepRequirement, type VesselModule,
} from '@astera/rules';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Tx } from '../../db/client.js';
import { starterEvents, vesselNotifications, vesselOrders, vessels } from '../../db/schema.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { planStarterReturn } from '../returnPlanning.js';
import { markProgress } from './quiet.js';
import { activeOrders, economyOf, progressOf, vesselView, withEconomy, withVesselLock, type LockedVessel, type VesselOrderRow, type VesselView } from './vessel.js';

const stepOf = (order: Pick<VesselOrderRow, 'subject' | 'stage'>): RepairStep | undefined =>
  REPAIR_LADDER.find(step => step.module === order.subject && step.stage === order.stage);

const stepsOf = (orders: readonly VesselOrderRow[]): RepairStep[] =>
  orders.flatMap(order => stepOf(order) ?? []);

const named = (need: StepRequirement): string => {
  switch (need.kind) {
    case 'MODULE': return `${need.module}:${String(need.stage)}`;
    case 'FACT': return need.fact;
    case 'PARTS': return `PARTS:${String(need.count)}`;
  }
};

/** The menu is not the lock. Every write that a closed system could reach asks here (§3.7). */
export function assertFeatureOpen(vessel: LockedVessel, feature: StarterFeature): void {
  if (!isFeatureOpen(progressOf(vessel.row), feature)) {
    throw new GameError('FEATURE_LOCKED', 'That system is not repaired yet', 409, { feature });
  }
}

export const collectAtVessel = (db: Db, accountId: string, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel, 'production');
    const { state, moved, blocked } = collectVessel(economyOf(vessel.row), vessel.row.modules);
    vessel.row = withEconomy(vessel.row, state);
    await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
    return { vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal), moved, blocked };
  });

/** Pays now, joins the queue, and finishes on the worker or on the next command, whichever comes first. */
export const orderRepair = (db: Db, accountId: string, module: VesselModule, stage: number, clock: Clock): Promise<VesselView> =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    const queue = await activeOrders(tx, vessel.row.id, 'CONSTRUCTION');
    const answer = canOrderStep(afterQueue(progressOf(vessel.row), stepsOf(queue)), module, stage);
    if (!answer.ok) {
      if (answer.code === 'UNKNOWN_STEP') throw new GameError(answer.code, 'That repair does not exist', 400);
      if (answer.code === 'ALREADY_REPAIRED') throw new GameError(answer.code, 'That repair is already done or under way', 409);
      throw new GameError(answer.code, 'Something else has to come first', 409, { missing: answer.missing.map(named).join(',') });
    }
    if (queue.length >= STARTER.queues.construction) throw new GameError('QUEUE_FULL', 'The repair queue is full', 409, { context: 'repairs' });
    const { step } = answer;
    if (vessel.row.alloy < step.alloy || vessel.row.crystal < step.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources', 409, { alloy: step.alloy, crystal: step.crystal });
    }

    await markProgress(tx, vessel, clock);
    vessel.row = { ...vessel.row, alloy: vessel.row.alloy - step.alloy, crystal: vessel.row.crystal - step.crystal };
    const startedAt = queue.at(-1)?.readyAt ?? vessel.now;
    const remainingSeconds = step.minutes * 60;
    const readyAt = new Date(startedAt.getTime() + remainingSeconds * 1000);
    const [order] = await tx.insert(vesselOrders).values({
      vesselId: vessel.row.id, queue: 'CONSTRUCTION', slot: queue.length, subject: module, stage,
      startedAt, readyAt, remainingSeconds, cost: { alloy: step.alloy, crystal: step.crystal, deuterium: 0 },
    }).returning({ id: vesselOrders.id });
    await scheduleStarter(tx, { starterGalaxyId: vessel.row.starterGalaxyId, kind: 'vessel_order_complete', refId: order!.id, resolveAt: readyAt });
    await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
    return vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal);
  });

/** Everything behind the cancelled order moves up, and its finish moves with it. */
async function reflow(tx: Tx, vessel: LockedVessel, queue: VesselOrderRow['queue'], keepHead: boolean): Promise<void> {
  const orders = await activeOrders(tx, vessel.row.id, queue);
  let at = vessel.now;
  for (const [slot, order] of orders.entries()) {
    const startedAt = slot === 0 && keepHead ? order.startedAt : at;
    const readyAt = slot === 0 && keepHead ? order.readyAt : new Date(startedAt.getTime() + order.remainingSeconds * 1000);
    at = readyAt;
    await tx.update(vesselOrders).set({ slot, startedAt, readyAt }).where(eq(vesselOrders.id, order.id));
    await tx.update(starterEvents).set({ resolveAt: readyAt })
      .where(and(eq(starterEvents.refId, order.id), eq(starterEvents.kind, 'vessel_order_complete'), inArray(starterEvents.status, ['pending', 'processing'])));
  }
}

/** The main queue's rule: half back, and never out from under an order that stands on this one. */
export const cancelRepair = (db: Db, accountId: string, orderId: string, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    const [named] = (await activeOrders(tx, vessel.row.id)).filter(order => order.id === orderId);
    if (!named) throw new GameError('BUILD_ORDER_NOT_FOUND', 'No active order by that id', 404);
    const queue = await activeOrders(tx, vessel.row.id, named.queue);
    const index = queue.findIndex(order => order.id === orderId);
    const order = named;

    const step = order.queue === 'CONSTRUCTION' ? stepOf(order) : undefined;
    const behind = stepsOf(queue.slice(index + 1));
    const stranded = step ? behind.filter(later => stepDependsOn(later, step)).length : 0;
    if (stranded > 0) {
      throw new GameError('BUILD_ORDER_HAS_DEPENDENTS', 'Cancel the orders behind this one first', 409, { count: stranded });
    }

    const refund = cancelRefund(order.cost);
    vessel.row = {
      ...vessel.row,
      alloy: vessel.row.alloy + refund.alloy,
      crystal: vessel.row.crystal + refund.crystal,
      deuterium: vessel.row.deuterium + refund.deuterium,
      lastSeenAt: vessel.now,
    };
    await tx.update(vesselOrders).set({ status: 'CANCELLED' }).where(eq(vesselOrders.id, order.id));
    await tx.update(starterEvents).set({ status: 'done', claimedAt: null })
      .where(and(eq(starterEvents.refId, order.id), eq(starterEvents.kind, 'vessel_order_complete'), inArray(starterEvents.status, ['pending', 'processing'])));
    await reflow(tx, vessel, order.queue, index !== 0);
    await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
    return { vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal), refund };
  });

export const markUnlockSeen = (db: Db, accountId: string, feature: StarterFeature, clock: Clock): Promise<VesselView> =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel, feature);
    if (!vessel.row.unlocksSeen.includes(feature)) vessel.row = { ...vessel.row, unlocksSeen: [...vessel.row.unlocksSeen, feature] };
    return vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal);
  });

/**
 * KURTARMA KASALARI (retention plan §6.2). A named crate opens if it is ready; none named opens every
 * ready one, the panel's "open all". The purse goes into the store, where any reward lands.
 */
export const openCrates = (db: Db, accountId: string, id: string | undefined, clock: Clock): Promise<{ vessel: VesselView; opened: string[] }> =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    if (id !== undefined && !STARTER_CRATES.some(crate => crate.id === id)) throw new GameError('UNKNOWN_CRATE', 'That crate does not exist', 400);
    const ready = readyCrates(progressOf(vessel.row), vessel.row.cratesOpened).filter(crate => id === undefined || crate.id === id);
    if (id !== undefined && ready.length === 0) throw new GameError('CRATE_NOT_READY', 'That crate is not ready to open', 409);
    vessel.row = {
      ...vessel.row,
      alloy: vessel.row.alloy + ready.reduce((sum, crate) => sum + crate.reward.alloy, 0),
      crystal: vessel.row.crystal + ready.reduce((sum, crate) => sum + crate.reward.crystal, 0),
      cratesOpened: [...vessel.row.cratesOpened, ...ready.map(crate => crate.id)],
    };
    await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
    return { vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal), opened: ready.map(crate => crate.id) };
  });

const NOTIFICATIONS_SHOWN = 50;

/** Newest first. A notification says what happened and never asks for a second read to say it. */
export async function listNotifications(db: Db, accountId: string) {
  const [ship] = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.accountId, accountId));
  if (!ship) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  const rows = await db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, ship.id))
    .orderBy(desc(vesselNotifications.createdAt)).limit(NOTIFICATIONS_SHOWN);
  return rows.map(row => ({ id: row.id, kind: row.kind, refId: row.refId, payload: row.payload, seen: row.seen, at: row.createdAt.toISOString() }));
}

export async function markNotificationsSeen(db: Db, accountId: string): Promise<number> {
  const [ship] = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.accountId, accountId));
  if (!ship) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  const marked = await db.update(vesselNotifications).set({ seen: true })
    .where(and(eq(vesselNotifications.vesselId, ship.id), eq(vesselNotifications.seen, false))).returning({ id: vesselNotifications.id });
  return marked.length;
}
