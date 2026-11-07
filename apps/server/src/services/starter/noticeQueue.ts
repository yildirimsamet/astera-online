import { and, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { openFeatures } from '@astera/rules';
import type { vessels } from '../../db/schema.js';
import type { Clock } from '../../clock.js';
import type { Db, Tx } from '../../db/client.js';
import { starterEvents, vesselNotifications, vesselOrders } from '../../db/schema.js';
import { scheduleStarter, type StarterEventRow } from '../../worker/starterQueue.js';
import { ringShip } from './push.js';

const WINDOW_MS = 30 * 60_000;
export async function queueRepairNotice(tx: Tx, ship: typeof vessels.$inferSelect, at: Date): Promise<void> {
  const [pending] = await tx.select({ id: starterEvents.id }).from(starterEvents).where(and(
    eq(starterEvents.refId, ship.id), eq(starterEvents.kind, 'vessel_repair_notice'), inArray(starterEvents.status, ['pending', 'processing']),
    gte(starterEvents.resolveAt, at),
  )).limit(1);
  if (pending) return;
  const upcoming = await tx.select().from(vesselOrders).where(and(
    eq(vesselOrders.vesselId, ship.id), eq(vesselOrders.status, 'BUILDING'), inArray(vesselOrders.queue, ['CONSTRUCTION', 'DOCK']),
    gt(vesselOrders.readyAt, at), lte(vesselOrders.readyAt, new Date(at.getTime() + WINDOW_MS)),
    sql`${vesselOrders.readyAt} - ${vesselOrders.startedAt} >= interval '15 minutes'`,
  ));
  const eligible = upcoming.filter(order => order.queue === 'DOCK' || openFeatures({ ...ship, modules: { ...ship.modules, [order.subject]: order.stage } }).size === openFeatures(ship).size);
  const resolveAt = new Date(Math.max(at.getTime(), ...eligible.map(order => order.readyAt.getTime())));
  await scheduleStarter(tx, { starterGalaxyId: ship.starterGalaxyId, kind: 'vessel_repair_notice', refId: ship.id, resolveAt, payload: { since: at.toISOString() } });
}
async function claimNotice(db: Db, event: StarterEventRow): Promise<boolean> {
  if (!event.refId) return false;
  const claimed = await db.update(starterEvents).set({ status: 'done', claimedAt: null }).where(and(
    eq(starterEvents.id, event.id), inArray(starterEvents.status, ['pending', 'processing']),
  )).returning({ id: starterEvents.id });
  return claimed.length > 0;
}
export async function deliverRepairNotice(db: Db, clock: Clock, event: StarterEventRow): Promise<void> {
  if (!event.refId || event.resolveAt > clock.now()) return;
  const since = z.object({ since: z.string().datetime() }).safeParse(event.payload);
  const repairs = await db.select({ payload: vesselNotifications.payload }).from(vesselNotifications).where(and(
    eq(vesselNotifications.vesselId, event.refId), inArray(vesselNotifications.kind, ['REPAIR_DONE', 'DOCK_DONE']),
    gte(vesselNotifications.createdAt, since.success ? new Date(since.data.since) : event.resolveAt), lte(vesselNotifications.createdAt, event.resolveAt),
    sql`${vesselNotifications.payload}->>'long' = 'true'`,
  ));
  const first = repairs[0];
  if (first && await claimNotice(db, event)) {
    const parsed = z.object({ module: z.string().optional() }).safeParse(first.payload);
    await ringShip(db, event.refId, { kind: 'repair_done', refId: event.id, count: repairs.length, ...(parsed.success && parsed.data.module ? { module: parsed.data.module } : {}) }, clock.now());
  }
}
const push = z.object({ kind: z.literal('miner_home'), refId: z.string().uuid() });
export async function deliverShipPush(db: Db, clock: Clock, event: StarterEventRow): Promise<void> {
  const parsed = push.safeParse(event.payload);
  if (event.refId && parsed.success && await claimNotice(db, event)) await ringShip(db, event.refId, parsed.data, clock.now());
}
