import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { players, seasons, shards } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, TEST_SEASON_DAYS } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('initializes a main placement without granting a new activity timestamp', async () => {
  const f = await seedWorld(1);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  const [shard] = await f.db.select().from(shards).where(eq(shards.id, season!.shardId));
  const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(shard?.role).toBe('MAIN');
  expect(season?.cycleId).toEqual(expect.any(String));
  expect(player?.homeShardId).toBe(shard?.id);
  expect(player?.placementVersion).toBe(0);
  expect(player?.mainEnteredAt).toEqual(player?.joinedAt);
  expect(player?.lastActiveAt).toEqual(f.clock.now());
});

it('groups matching period boundaries without changing a legacy period', async () => {
  const f = await seedWorld(0);
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  /*
    THE MATCHING SEASON HAS TO BE MATCHED ON PURPOSE. D194.

    A cycle groups seasons by their PERIOD — the same start and the same end — and
    this asked for one with the same start and no `days` at all, so it took the
    default. That worked while the default was the fixture's own fourteen; the
    season is thirty now, the two ends differ, and the pair correctly landed in
    different cycles. The test was reading the default, not the rule.

    Stated from the fixture instead, so the season length can move again without
    quietly turning this assertion into a comparison of two unrelated periods.
  */
  const same = await createSeason(f.db, {
    shardCode: 'SAME-CYCLE', seed: 7, startsAt: f.clock.now(), days: TEST_SEASON_DAYS,
    rulesetVersion: 1,
  });
  const different = await createSeason(f.db, {
    shardCode: 'OTHER-CYCLE', seed: 7, startsAt: f.clock.now(), days: TEST_SEASON_DAYS + 1,
    rulesetVersion: 1,
  });
  expect(same.season.cycleId).toBe(source?.cycleId);
  expect(different.season.cycleId).not.toBe(source?.cycleId);
  expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]).toEqual(source);
});
