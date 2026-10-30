import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';
import { botProfiles, honorTotals } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { applyHonorPodium, honorPodium } from '../src/services/honorPodium.js';
import { seedWorld, testDb, TEST_DATABASE_URL, type Fixture } from './helpers.js';

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
  // Scaling plan F1.8 (Q6): only the scores that can stand on the podium leave the database.
  describe('reads only the podium, ties included', () => {
    const cases: { name: string; scores: number[]; ranks: (1 | 2 | 3 | undefined)[] }[] = [
      { name: 'a tie at third keeps everyone in it', scores: [9, 8, 7, 7, 7, 6], ranks: [1, 2, 3, 3, 3, undefined] },
      { name: 'a tie at first fills the podium', scores: [9, 9, 9, 8, 1, 1], ranks: [1, 1, 1, undefined, undefined, undefined] },
      { name: 'a tie at second skips third', scores: [9, 8, 8, 7, 1, 1], ranks: [1, 2, 2, undefined, undefined, undefined] },
      { name: 'fewer than three positive scores', scores: [5, 4, 0, 0, 0, 0], ranks: [1, 2, undefined, undefined, undefined, undefined] },
    ];
    for (const { name, scores, ranks } of cases) {
      it(name, async () => {
        const g = await seedWorld(6, 7720);
        await g.db.transaction(tx => prepareHonorSeason(tx, g.seasonId, 'ACTIVE', g.clock));
        await g.db.insert(honorTotals).values(g.playerIds.map((playerId, index) => ({ seasonId: g.seasonId, playerId,
          score: scores[index]! * 1_000_000 })));
        const wire: string[] = [];
        const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined,
          debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
        try {
          const result = await honorPodium(drizzle(client, { schema }), g.seasonId, new Set());
          expect(result.ranks).toEqual(new Map(g.playerIds.flatMap((id, index) => {
            const rank = ranks[index];
            return rank === undefined ? [] : [[id, rank] as const];
          })));
          expect(wire.some(query => query.includes('from "honor_totals"') && query.includes('offset')), 'threshold query').toBe(true);
        } finally { await client.end(); }
      });
    }
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
