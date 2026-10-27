import { and, eq } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { arenaShips, seasons } from '../db/schema.js';
import { schedule, type EventRow } from '../worker/queue.js';
import { notify } from './notifications.js';

/** The timer is news only: hangar/launch availability still reads readyAt directly. */
export async function queueShipReady(tx: Tx, seasonId: string, playerId: string, noticeId: string, readyAt: Date): Promise<void> {
  await schedule(tx, { seasonId, kind: 'arena_ship_ready', refId: noticeId, resolveAt: readyAt,
    payload: { playerId, readyAt: readyAt.toISOString() }, dedupeKey: `arena-ready:${noticeId}:${readyAt.toISOString()}` });
}

/** A repair payment or newer flight invalidates an old event; a committed notice cannot repeat. */
export async function shipReadyNotice(db: Db, clock: Clock, event: EventRow): Promise<void> {
  if (!event.refId || event.resolveAt > clock.now()) return;
  await db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, event.seasonId)).for('share');
    if (season?.status !== 'live') return;
    const [row] = await tx.select().from(arenaShips).where(eq(arenaShips.readyNoticeId, event.refId!)).for('update');
    if (row?.sortieId !== null || row.readyAt?.getTime() !== event.resolveAt.getTime() || row.readyReason === null) return;
    await notify(tx, { playerId: row.playerId, kind: 'arena_ship_ready', refId: event.refId,
      at: event.resolveAt, payload: { ship: row.ship, level: row.level, reason: row.readyReason, readyAt: row.readyAt.toISOString() } });
    await tx.update(arenaShips).set({ readyNoticeId: null }).where(and(eq(arenaShips.playerId, row.playerId), eq(arenaShips.readyNoticeId, event.refId!)));
  });
}
