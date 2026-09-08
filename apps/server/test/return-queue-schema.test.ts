import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { returnApplications, seasons } from '../src/db/schema.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2); });
afterAll(async () => { await (await testDb()).close(); });

async function application(playerId: string, sequence: bigint) {
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  return {
    playerId, playerIdSnapshot: playerId, cycleId: season!.cycleId, targetShardId: season!.shardId, sequence,
    requestedAt: f.clock.now(), updatedAt: f.clock.now(),
    expiresAt: new Date(f.clock.now().getTime() + 48 * 60 * 60_000),
  };
}

it('allows only one queued application per commander even under concurrent insertion', async () => {
  const a = await application(f.playerIds[0]!, 1n);
  const outcomes = await Promise.allSettled([
    f.db.insert(returnApplications).values(a),
    f.db.insert(returnApplications).values({ ...a, sequence: 2n }),
  ]);
  expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(await f.db.select().from(returnApplications)).toHaveLength(1);
});

it('enforces durable sequence uniqueness per target and preserves bigint precision', async () => {
  const a = await application(f.playerIds[0]!, 9_007_199_254_740_993n);
  const [row] = await f.db.insert(returnApplications).values(a).returning();
  expect(row?.sequence).toBe(a.sequence);
  await expect(f.db.insert(returnApplications).values({ ...a, playerId: f.playerIds[1]! }))
    .rejects.toThrow();
});

it('requires a closed timestamp for terminal applications', async () => {
  const a = await application(f.playerIds[0]!, 1n);
  await expect(f.db.insert(returnApplications).values({ ...a, status: 'CANCELLED' })).rejects.toThrow();
  await f.db.insert(returnApplications).values({ ...a, status: 'CANCELLED', closedAt: f.clock.now() });
  await f.db.insert(returnApplications).values({ ...a, sequence: 2n });
  expect(await f.db.select().from(returnApplications)).toHaveLength(2);
});
