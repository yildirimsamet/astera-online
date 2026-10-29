import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { botProfiles, honorTotals } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { applyHonorPodium, honorPodium } from '../src/services/honorPodium.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('the public podium follows the active Honor competition', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(4, 7719); });
  afterAll(async () => { await (await testDb()).close(); });

  it('does not change legacy or shadow podiums', async () => {
    expect(await honorPodium(f.db, f.seasonId, new Set())).toEqual({ active: false, ranks: new Map() });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    expect((await honorPodium(f.db, f.seasonId, new Set())).active).toBe(false);
  });
  it('shares positive podium places fairly and excludes operators and nonpositive scores', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId,
      score: index < 2 ? 20_000_000 : index === 2 ? 0 : 100_000_000 })));
    const result = await honorPodium(f.db, f.seasonId, new Set([f.playerIds[3]!]));
    expect(result).toEqual({ active: true, ranks: new Map([[f.playerIds[0], 1], [f.playerIds[1], 1]]) });
    expect((await honorPodium(f.db, f.seasonId, new Set([f.playerIds[0]!, f.playerIds[3]!]))).ranks)
      .toEqual(new Map([[f.playerIds[1], 1]]));
  });
  it('crowns a bot that holds a podium place like anybody else', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId,
      score: (index + 1) * 10_000_000 })));
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[3]!, ordinal: 1, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    expect((await honorPodium(f.db, f.seasonId, new Set())).ranks)
      .toEqual(new Map([[f.playerIds[3], 1], [f.playerIds[2], 2], [f.playerIds[1], 3]]));
  });
  it('marks the primary competition even when a world has no Honor podium place', () => {
    const worlds = [{ id: 'a', controller: { kind: 'PLAYER', playerId: 'a' }, dominionRank: 1 as const },
      { id: 'b', controller: { kind: 'PLAYER', playerId: 'b' }, dominionRank: 2 as const }];
    expect(applyHonorPodium(worlds, { active: true, ranks: new Map([['b', 1]]) })).toEqual([
      { ...worlds[0], honorRanking: true, honorRank: undefined }, { ...worlds[1], honorRanking: true, honorRank: 1 },
    ]);
    expect(applyHonorPodium(worlds, { active: false, ranks: new Map() })).toEqual(worlds);
  });
});
