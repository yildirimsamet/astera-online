import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import { INACTIVITY_MS } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { players, returnApplications, seasons, shards, silentSpaceMaintenance } from '../db/schema.js';
import { ensureWaitingSeason } from './waitingServers.js';
import { emitTransferOutbox, transferCommander } from './commanderTransfer.js';

export const SILENT_SPACE_INTERVAL_MS = 5 * 60_000;
export interface SilentSpaceResult { ran: boolean; movedOut: number; returned: number; checked: number; deferred: Record<string, number>; failed: number }

/** One bounded maintenance pass per five minutes across replicas, independently of fleet ticks. */
export async function runSilentSpaceSweep(db: Db, clock: Clock, options: { batchSize?: number; maxWaitingShards?: number } = {}): Promise<SilentSpaceResult> {
  const result: SilentSpaceResult = { ran: false, movedOut: 0, returned: 0, checked: 0, deferred: {}, failed: 0 };
  const batchSize = options.batchSize ?? 5;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) throw new RangeError('Invalid Silent Space batch size');
  return db.transaction(async (lease) => {
    const [locked] = await lease.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(83202489) as acquired`);
    if (!locked?.acquired) return result;
    await lease.insert(silentSpaceMaintenance).values({ id: 1, nextRunAt: new Date(0) }).onConflictDoNothing();
    const [state] = await lease.select().from(silentSpaceMaintenance).where(eq(silentSpaceMaintenance.id, 1)).for('update');
    const now = clock.now();
    if (!state || now < state.nextRunAt) return result;
    result.ran = true;
    const deadline = performance.now() + 10_000;
    await emitTransferOutbox(db);
    // Expiry is a terminal queue fact, not an eligibility blocker. Player lock order matches presence.
    const expired = await db.select({ id: returnApplications.playerId }).from(returnApplications)
      .where(and(eq(returnApplications.status, 'QUEUED'), lte(returnApplications.expiresAt, now))).limit(100);
    for (const row of expired) if (row.id) await db.transaction(async tx => {
      await tx.select({ id: players.id }).from(players).where(eq(players.id, row.id!)).for('update');
      await tx.update(returnApplications).set({ status: 'EXPIRED', closedAt: now, updatedAt: now, closedReason: 'INACTIVITY' })
        .where(and(eq(returnApplications.playerId, row.id!), eq(returnApplications.status, 'QUEUED'), lte(returnApplications.expiresAt, now)));
    });
    const applications = await db.select().from(returnApplications).where(and(eq(returnApplications.status, 'QUEUED'), gt(returnApplications.expiresAt, now)))
      .orderBy(asc(returnApplications.cycleId), asc(returnApplications.targetShardId), asc(returnApplications.sequence));
    const contended = new Set<string>();
    for (const application of applications) {
      if (result.movedOut + result.returned >= batchSize || performance.now() >= deadline) break;
      const key = `${application.cycleId}:${application.targetShardId}`;
      if (contended.has(key) || !application.playerId) continue;
      const [target] = await db.select({ id: seasons.id }).from(seasons).where(and(eq(seasons.cycleId, application.cycleId), eq(seasons.shardId, application.targetShardId), eq(seasons.status, 'live')));
      if (!target) continue;
      result.checked++;
      try {
        const { status } = await transferCommander(db, application.playerId, target.id, clock, application.id);
        if (status === 'MOVED') result.returned++;
        else {
          result.deferred[status] = (result.deferred[status] ?? 0) + 1;
          if (status === 'CONTENTION') contended.add(key); // Contention is never evidence that an older application is ineligible.
        }
      } catch { result.failed++; contended.add(key); }
    }
    // Admit waiting commanders first so departures cannot exhaust every pass.
    const cutoff = new Date(now.getTime() - INACTIVITY_MS);
    const candidates = await db.select({ player: players, season: seasons }).from(players)
      .innerJoin(seasons, eq(players.seasonId, seasons.id)).innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(shards.role, 'MAIN'), eq(seasons.status, 'live'), gt(seasons.endsAt, now),
        lte(players.lastActiveAt, cutoff), lte(players.joinedAt, cutoff),
        sql`coalesce(${players.mainEnteredAt}, ${players.joinedAt}) <= ${cutoff.toISOString()}::timestamptz`,
        state.cursorPlayerId ? gt(players.id, state.cursorPlayerId) : undefined))
      .orderBy(asc(players.id)).limit(50);
    let cursor: string | null = null;
    for (const { player, season } of candidates) {
      if (result.movedOut + result.returned >= batchSize || performance.now() >= deadline) break;
      cursor = player.id;
      result.checked++;
      try {
        const target = await ensureWaitingSeason(db, season.id, clock, { maxShards: options.maxWaitingShards ?? 16 });
        const status = target ? (await transferCommander(db, player.id, target.id, clock)).status : 'CAPACITY';
        if (status === 'MOVED') result.movedOut++;
        else result.deferred[status] = (result.deferred[status] ?? 0) + 1;
      } catch { result.failed++; }
    }
    // Every cycle eventually revisits blocked commanders; a full prefix cannot starve later IDs.
    if (cursor === candidates.at(-1)?.player.id && candidates.length < 50) cursor = null;
    await emitTransferOutbox(db);
    await lease.update(silentSpaceMaintenance).set({ nextRunAt: new Date(now.getTime() + SILENT_SPACE_INTERVAL_MS),
      lastRunAt: now, cursorPlayerId: cursor, lastResult: { ...result } }).where(eq(silentSpaceMaintenance.id, 1));
    return result;
  });
}
