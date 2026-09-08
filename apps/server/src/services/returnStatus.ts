import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { players, returnApplications, seasons, shards } from '../db/schema.js';

/** One placement snapshot, protected against a concurrent commander move. */
export async function readReturnStatus(db: Db, accountId: string, clock: Clock) {
  return db.transaction(async (tx) => {
    const [player] = await tx.select().from(players).where(eq(players.accountId, accountId)).for('share');
    if (!player) return { placement: null, homeShard: null, canApply: false, application: null };
    const [source] = await tx.select({ season: seasons, role: shards.role }).from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, player.seasonId));
    const [home] = player.homeShardId
      ? await tx.select().from(shards).where(eq(shards.id, player.homeShardId)) : [];
    const [target] = home && source ? await tx.select().from(seasons).where(and(
      eq(seasons.shardId, home.id), eq(seasons.cycleId, source.season.cycleId), eq(seasons.status, 'live'),
    )) : [];
    const now = clock.now();
    const [queued] = await tx.select().from(returnApplications).where(and(
      eq(returnApplications.playerId, player.id), eq(returnApplications.status, 'QUEUED'),
      gt(returnApplications.expiresAt, now),
    ));
    const [ahead] = queued ? await tx.select({ n: sql<number>`count(*)::int` }).from(returnApplications).where(and(
      eq(returnApplications.cycleId, queued.cycleId), eq(returnApplications.targetShardId, queued.targetShardId),
      eq(returnApplications.status, 'QUEUED'), gt(returnApplications.expiresAt, now),
      lt(returnApplications.sequence, queued.sequence),
    )) : [];
    return {
      placement: { playerId: player.id, version: player.placementVersion, role: source?.role ?? 'MAIN' },
      homeShard: home?.code ?? null,
      canApply: source?.role === 'WAITING' && source.season.status === 'live' && now < source.season.endsAt
        && home?.role === 'MAIN' && target !== undefined && now < target.endsAt
        && target.rulesetVersion === source.season.rulesetVersion,
      application: queued ? { id: queued.id, position: (ahead?.n ?? 0) + 1 } : null,
    };
  });
}
