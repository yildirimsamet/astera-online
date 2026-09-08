import { and, asc, eq, sql } from 'drizzle-orm';
import { MULTI_WORLD, SERVERS, generateGalaxy, hashSeed, waitingColonySlots } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { planets, players, seasons, shards } from '../db/schema.js';
import { createSeasonIn } from './season.js';

/**
 * Provisioning is separate from commander transfer: map/calendar construction
 * must never happen while holding a moving commander's assets. The lifecycle
 * advisory lock is the same one used by global wipe. No seat is reserved here;
 * transfer rechecks capacity under its admission and season locks.
 */
export async function ensureWaitingSeason(
  db: Db, sourceSeasonId: string, clock: Clock,
  options: { maxShards?: number; colonyCount?: number } = {},
): Promise<typeof seasons.$inferSelect | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(83202488)`);
    const [source] = await tx.select().from(seasons).where(eq(seasons.id, sourceSeasonId)).for('share');
    const now = clock.now();
    if (source?.status !== 'live' || now >= source.endsAt) return null;
    const [sourceShard] = await tx.select().from(shards).where(eq(shards.id, source.shardId));
    if (sourceShard?.role !== 'MAIN') return null;

    const candidates = await tx.select({ season: seasons, shard: shards }).from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(shards.role, 'WAITING'), eq(seasons.status, 'live'),
        eq(seasons.cycleId, source.cycleId), eq(seasons.rulesetVersion, source.rulesetVersion)))
      .orderBy(asc(shards.ordinal));
    for (const { season, shard } of candidates) {
      if (now >= season.endsAt) continue;
      const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(players)
        .where(eq(players.seasonId, season.id));
      if ((count?.n ?? 0) >= shard.playerCap) continue;
      const worlds = await tx.select({ index: planets.slotIndex, x: planets.x, y: planets.y, z: planets.z })
        .from(planets).where(eq(planets.seasonId, season.id));
      const occupied = new Set(worlds.map((world) => world.index));
      const reserved = generateGalaxy(season.seed, MULTI_WORLD.capitalSlots).slots;
      if (!reserved.slice(0, shard.playerCap).some((slot) => !occupied.has(slot.index))) continue;
      const colonyCount = options.colonyCount ?? 3;
      if (waitingColonySlots(season.seed, [...reserved, ...worlds], colonyCount).length === colonyCount) return season;
    }

    const allShards = await tx.select().from(shards).orderBy(asc(shards.ordinal));
    const waitingShards = allShards.filter((shard) => shard.role === 'WAITING');
    // Reuse dormant WAIT metadata after rollover instead of multiplying it every cycle.
    const liveWaiting = await tx.select({ shardId: seasons.shardId }).from(seasons).where(eq(seasons.status, 'live'));
    const liveIds = new Set(liveWaiting.map((season) => season.shardId));
    const dormant = waitingShards.find((shard) => !liveIds.has(shard.id));
    if (!dormant && waitingShards.length >= (options.maxShards ?? 16)) return null;
    let number = 1;
    const codes = new Set(allShards.map((shard) => shard.code));
    while (codes.has(`WAIT-${String(number)}`)) number++;
    const code = dormant?.code ?? `WAIT-${String(number)}`;
    const ordinal = dormant?.ordinal ?? Math.max(0, ...allShards.map((shard) => shard.ordinal)) + 1;
    const created = await createSeasonIn(tx, {
      shardCode: code, shardName: 'Silent Space', role: 'WAITING', ordinal,
      seed: hashSeed('waiting-season', source.cycleId, code) & 0x7fffffff,
      startsAt: source.startsAt, endsAt: source.endsAt, initializedAt: now,
      rulesetVersion: source.rulesetVersion, playerCap: SERVERS.capacity,
    });
    return created.season;
  });
}
