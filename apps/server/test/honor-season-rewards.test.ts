import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorSeasons, honorTotals, players, seasonResults, seasonRewardEntitlements } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('Honor season rewards preserve the existing Dominion promise', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(4, 7719); });
  afterAll(async () => { await (await testDb()).close(); });
  const enable = (mode: 'SHADOW' | 'ACTIVE' = 'ACTIVE') => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, mode, f.clock));
  const close = () => forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);

  it('archives equal Honor ranks and pays both tied owners the same pooled prize exactly once', async () => {
    await enable();
    await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId,
      score: index < 2 ? 200_000_000 : index === 2 ? 0 : -1_000_000 })));
    await f.db.update(players).set({ dominionTaken: 1000 }).where(eq(players.id, f.playerIds[0]!));
    await close(); await close();
    const results = await f.db.select().from(seasonResults);
    expect(results.find(row => row.accountId === f.accountIds[0])).toMatchObject({ honorScore: 200_000_000, honorRank: 1 });
    expect(results.find(row => row.accountId === f.accountIds[1])).toMatchObject({ honorScore: 200_000_000, honorRank: 1 });
    expect(results.filter(row => row.honorScore === 200_000_000).every(row => row.title.startsWith('Sovereign of '))).toBe(true);
    expect(results.filter(row => (row.honorScore ?? 0) <= 0).every(row => row.title === 'Commander')).toBe(true);
    const rewards = await f.db.select().from(seasonRewardEntitlements);
    expect(rewards).toHaveLength(2);
    for (const reward of rewards) expect(reward).toMatchObject({ ranking: 'HONOR', rewardPlace: 1,
      alloy: 3750, crystal: 2750, deuterium: 550 });
    expect((await f.db.select().from(honorSeasons))[0]?.closedAt).toEqual(f.clock.now());
  });

  it('keeps the larger Dominion package instead of summing a capped Honor prize into it', async () => {
    await enable();
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 500_000 });
    await f.db.update(players).set({ dominionTaken: 1000 }).where(eq(players.id, f.playerIds[0]!));
    await close();
    const rewards = await f.db.select().from(seasonRewardEntitlements);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ ranking: 'DOMINION', alloy: 2000, crystal: 1500, deuterium: 300 });
  });

  it('shadow evidence never grants a ranked archive entry or a persistent reward', async () => {
    await enable('SHADOW');
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 200_000_000 });
    await close();
    expect(await f.db.select().from(seasonRewardEntitlements)).toHaveLength(0);
    expect((await f.db.select().from(seasonResults)).every(row => row.honorScore === null && row.honorRank === null)).toBe(true);
  });
});
