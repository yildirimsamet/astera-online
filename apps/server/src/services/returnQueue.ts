import { and, eq, sql } from 'drizzle-orm';
import { INACTIVITY_MS } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { players, returnApplications, returnQueueCounters, seasons, shards } from '../db/schema.js';
import { GameError, lockSeason } from './planet.js';

/** Shared by return admission and ordinary new seats; acquire before season/player locks. */
export async function lockAdmission(tx: Tx, cycleId: string, targetShardId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`admission:${cycleId}:${targetShardId}`}, 0))`);
}

/** Pre-reads locate locks only. All authority is reread after acquiring them. */
async function lockQueueCommander(tx: Tx, accountId: string, clock: Clock, expectedVersion: number) {
  const [initial] = await tx.select().from(players).where(eq(players.accountId, accountId));
  if (!initial) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const [source] = await tx.select().from(seasons).where(eq(seasons.id, initial.seasonId));
  if (!source || !initial.homeShardId) {
    throw new GameError('RETURN_TARGET_UNAVAILABLE', 'Your return galaxy is unavailable', 409);
  }
  await lockAdmission(tx, source.cycleId, initial.homeShardId);
  const targets = await tx.select().from(seasons).where(and(
    eq(seasons.cycleId, source.cycleId), eq(seasons.shardId, initial.homeShardId), eq(seasons.status, 'live'),
  ));
  if (targets.length !== 1) throw new GameError('RETURN_TARGET_UNAVAILABLE', 'Your return galaxy is unavailable', 409);
  const target = targets[0]!;
  for (const id of [...new Set([source.id, target.id])].sort()) {
    const season = await lockSeason(tx, id, false);
    if (season.status !== 'live') {
      throw new GameError('SEASON_NOT_LIVE', 'That season is over', 409);
    }
  }
  if (source.rulesetVersion !== target.rulesetVersion) {
    throw new GameError('RETURN_TARGET_UNAVAILABLE', 'Your return galaxy uses different rules', 409);
  }
  const [commander] = await tx.select().from(players).where(eq(players.id, initial.id)).for('update');
  if (commander?.seasonId !== initial.seasonId
    || commander.homeShardId !== initial.homeShardId || commander.placementVersion !== expectedVersion) {
    throw new GameError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
  }
  const [sourceShard] = await tx.select().from(shards).where(eq(shards.id, source.shardId));
  const [targetShard] = await tx.select().from(shards).where(eq(shards.id, target.shardId));
  if (sourceShard?.role !== 'WAITING') throw new GameError('NOT_IN_WAITING', 'You are already in a main galaxy', 409);
  if (targetShard?.role !== 'MAIN') throw new GameError('RETURN_TARGET_UNAVAILABLE', 'Your return galaxy is unavailable', 409);
  const now = await refreshReturnActivity(tx, commander.id, clock);
  // All blocking row locks are held: crossing a deadline while waiting must
  // reject the transaction, including its provisional activity refresh.
  if (now >= source.endsAt || now >= target.endsAt) {
    throw new GameError('SEASON_NOT_LIVE', 'That season is over', 409);
  }
  return { commander, source, target, now };
}

/** Under player lock, expire before refreshing activity: a late login cannot revive priority. */
export async function refreshReturnActivity(tx: Tx, playerId: string, clock: Clock): Promise<Date> {
  const [active] = await tx.select().from(returnApplications)
    .where(and(eq(returnApplications.playerId, playerId), eq(returnApplications.status, 'QUEUED')))
    .for('update');
  const now = clock.now();
  if (active) {
    await tx.update(returnApplications).set(now >= active.expiresAt
      ? { status: 'EXPIRED', closedAt: now, closedReason: 'INACTIVITY', updatedAt: now }
      : { expiresAt: new Date(now.getTime() + INACTIVITY_MS), updatedAt: now })
      .where(eq(returnApplications.id, active.id));
  }
  await tx.update(players).set({ lastActiveAt: now }).where(eq(players.id, playerId));
  return now;
}

export async function enqueueReturn(db: Db, accountId: string, clock: Clock, expectedVersion: number) {
  return db.transaction(async (tx) => {
    const { commander, source, target, now } = await lockQueueCommander(tx, accountId, clock, expectedVersion);
    const [existing] = await tx.select().from(returnApplications).where(and(
      eq(returnApplications.playerId, commander.id), eq(returnApplications.status, 'QUEUED'),
    ));
    if (existing) return existing;
    await tx.insert(returnQueueCounters).values({ cycleId: source.cycleId, targetShardId: target.shardId })
      .onConflictDoNothing();
    const [counter] = await tx.update(returnQueueCounters)
      .set({ lastSequence: sql`${returnQueueCounters.lastSequence} + 1` })
      .where(and(eq(returnQueueCounters.cycleId, source.cycleId), eq(returnQueueCounters.targetShardId, target.shardId)))
      .returning();
    if (!counter) throw new Error('Return queue counter missing under admission lock');
    const [application] = await tx.insert(returnApplications).values({
      playerId: commander.id, playerIdSnapshot: commander.id, cycleId: source.cycleId,
      targetShardId: target.shardId, sequence: counter.lastSequence,
      requestedAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + INACTIVITY_MS),
    }).returning();
    if (!application) throw new Error('Return application insert returned no row');
    return application;
  });
}

export async function cancelReturn(
  db: Db, accountId: string, applicationId: string, clock: Clock, expectedVersion: number,
) {
  return db.transaction(async (tx) => {
    const { commander, now } = await lockQueueCommander(tx, accountId, clock, expectedVersion);
    const [application] = await tx.select().from(returnApplications).where(and(
      eq(returnApplications.id, applicationId), eq(returnApplications.playerId, commander.id),
    )).for('update');
    if (!application) throw new GameError('APPLICATION_NOT_FOUND', 'No return application by that ID', 404);
    if (application.status !== 'QUEUED') return application;
    const [cancelled] = await tx.update(returnApplications).set({
      status: 'CANCELLED', closedAt: now, updatedAt: now, closedReason: 'PLAYER_CANCELLED',
    }).where(eq(returnApplications.id, application.id)).returning();
    if (!cancelled) throw new Error('Locked return application disappeared');
    return cancelled;
  });
}
