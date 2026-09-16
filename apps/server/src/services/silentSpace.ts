import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import { INACTIVITY_MS, inactivityEligible } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, planets, players, returnApplications, seasons, shards, silentSpaceMaintenance } from '../db/schema.js';
import { ensureWaitingSeason } from './waitingServers.js';
import { emitTransferOutbox, transferCommander, type TransferStatus } from './commanderTransfer.js';

export const SILENT_SPACE_INTERVAL_MS = 5 * 60_000;
export interface SilentSpaceResult { ran: boolean; movedOut: number; returned: number; checked: number; deferred: Record<string, number>; failed: number }

/** One bounded maintenance pass per five minutes across replicas, independently of fleet ticks. */
export async function runSilentSpaceSweep(db: Db, clock: Clock, options: { batchSize?: number; maxWaitingShards?: number; onError?: (error: unknown) => void } = {}): Promise<SilentSpaceResult> {
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
    for (const row of expired) if (row.id && performance.now() < deadline) await db.transaction(async tx => {
      const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, row.id!)).for('update', { skipLocked: true });
      if (!player) return;
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
      } catch (error) { result.failed++; options.onError?.(error); contended.add(key); }
    }
    // Admit waiting commanders first so departures cannot exhaust every pass.
    const departureBudget = result.movedOut + result.returned < batchSize && performance.now() < deadline;
    const cutoff = new Date(now.getTime() - INACTIVITY_MS);
    const candidates = await db.select({ player: players, season: seasons }).from(players)
      .innerJoin(seasons, eq(players.seasonId, seasons.id)).innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(shards.role, 'MAIN'), eq(seasons.status, 'live'), gt(seasons.endsAt, now),
        lte(players.lastActiveAt, cutoff), lte(players.joinedAt, cutoff),
        sql`coalesce(${players.mainEnteredAt}, ${players.joinedAt}) <= ${cutoff.toISOString()}::timestamptz`,
        state.cursorPlayerId ? gt(players.id, state.cursorPlayerId) : undefined))
      .orderBy(asc(players.id)).limit(50);
    let cursor = state.cursorPlayerId;
    for (const { player, season } of candidates) {
      if (result.movedOut + result.returned >= batchSize || performance.now() >= deadline) break;
      cursor = player.id;
      result.checked++;
      try {
        const target = await ensureWaitingSeason(db, season.id, clock, { maxShards: options.maxWaitingShards ?? 16 });
        const status = target ? (await transferCommander(db, player.id, target.id, clock)).status : 'CAPACITY';
        if (status === 'MOVED') result.movedOut++;
        else result.deferred[status] = (result.deferred[status] ?? 0) + 1;
      } catch (error) { result.failed++; options.onError?.(error); }
    }
    // Every cycle eventually revisits blocked commanders; a full prefix cannot starve later IDs.
    if (departureBudget && (candidates.length === 0 || cursor === candidates.at(-1)?.player.id) && candidates.length < 50) cursor = null;
    await emitTransferOutbox(db);
    await lease.update(silentSpaceMaintenance).set({ nextRunAt: new Date(now.getTime() + SILENT_SPACE_INTERVAL_MS),
      lastRunAt: now, cursorPlayerId: cursor, lastResult: { ...result } }).where(eq(silentSpaceMaintenance.id, 1));
    return result;
  });
}

/* ── one named commander, moved by hand ──────────────────────────────────── */

export interface SilentSpaceDeparture {
  playerId: string;
  accountId: string;
  commander: string;
  seasonId: string;
  shard: string;
  worlds: { id: string; kind: string; name: string; slotIndex: number }[];
  /** Whether the sweep would have taken them anyway. Reported, never required. */
  inactive: boolean;
}

/**
 * WHO WOULD MOVE, WHAT THEY HOLD, AND WHICH GALAXY THEY WOULD LEAVE. Read-only.
 *
 * The operator types a name they read in a message, so the failure this has to
 * not have is moving the wrong person: `display_name` is not unique, and two
 * matches stop the command rather than pick one. Everything else about the move
 * is decided inside `transferCommander`'s transaction, which either does all of
 * it or writes nothing at all.
 */
export async function describeSilentSpaceDeparture(db: Db, clock: Clock, commander: string): Promise<SilentSpaceDeparture> {
  const rows = await db.select({ player: players, name: accounts.displayName, season: seasons, shard: shards })
    .from(players).innerJoin(accounts, eq(accounts.id, players.accountId))
    .innerJoin(seasons, eq(seasons.id, players.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(eq(accounts.displayName, commander)).orderBy(asc(players.id));
  if (rows.length === 0) throw new Error(`No commander named ${commander}`);
  if (rows.length > 1) {
    throw new Error(`${commander} is more than one commander (${rows.map(r => `${r.player.id} on ${r.shard.name}`).join(', ')}); refusing to guess`);
  }
  const { player, name, season, shard } = rows[0]!;
  if (shard.role !== 'MAIN') throw new Error(`${commander} is already outside a main galaxy (${shard.name})`);
  if (season.status !== 'live') throw new Error(`${commander} is in a galaxy that is no longer live`);
  const worlds = await db.select({ id: planets.id, kind: planets.kind, name: planets.name, slotIndex: planets.slotIndex })
    .from(planets).where(eq(planets.controllerPlayerId, player.id)).orderBy(asc(planets.kind), asc(planets.slotIndex));
  return {
    playerId: player.id, accountId: player.accountId, commander: name, seasonId: season.id, shard: shard.name, worlds,
    inactive: inactivityEligible({ lastActiveAt: player.lastActiveAt.getTime(), joinedAt: player.joinedAt.getTime(),
      mainEnteredAt: (player.mainEnteredAt ?? player.joinedAt).getTime() }, clock.now().getTime()),
  };
}

/**
 * MOVE ONE NAMED COMMANDER OUT OF THEIR MAIN GALAXY, BECAUSE THEY ASKED.
 *
 * The same primitive the sweep uses, with the activity clock waived and no other
 * fence touched — so their worlds, buildings, stock, fleet and research travel
 * with them, the addresses they leave become return addresses, and a move that
 * cannot be made safely right now comes back as a status instead of a partial
 * write. Emitting the outbox here is not required for correctness (the next
 * sweep would); it simply closes the audit row while the operator is watching.
 */
export async function departToSilentSpace(db: Db, clock: Clock, commander: string,
  options: { maxWaitingShards?: number } = {}): Promise<{ departure: SilentSpaceDeparture; status: TransferStatus; targetSeasonId: string | null }> {
  const departure = await describeSilentSpaceDeparture(db, clock, commander);
  const target = await ensureWaitingSeason(db, departure.seasonId, clock, { maxShards: options.maxWaitingShards ?? 16 });
  if (!target) return { departure, status: 'CAPACITY', targetSeasonId: null };
  const { status } = await transferCommander(db, departure.playerId, target.id, clock, undefined, { ownerRequested: true });
  if (status === 'MOVED') await emitTransferOutbox(db);
  return { departure, status, targetSeasonId: target.id };
}
