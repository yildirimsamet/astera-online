import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { seasonCycles, seasonResults, seasons, shards } from '../src/db/schema.js';
import { monumentHonorees } from '../src/services/monumentHonorees.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { seasonSchema } from '../../web/src/api/schemas.js';

/**
 * The eight monuments carry last season's top eight names (owner, 2026-10-10). Rank N to
 * monument N, the names frozen into the previous cycle's record (the archive leaderboard's
 * own `recap.commanderName`), read from the main galaxy like the chat podium.
 */
describe('the names the monuments carry', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let priorCycleId: string;
  let priorSeasonId: string;

  const recordRanks = async (ranks: readonly number[]): Promise<void> => {
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(seasonResults).values(ranks.map((finalRank, index) => ({
      cycleId: priorCycleId, seasonId: priorSeasonId, accountId: f.accountIds[index]!, finalRank, dominion: 100,
      title: 'VETERAN', createdAt: current!.startsAt,
      recap: { commanderName: `Champion${String(finalRank)}`, countryCode: 'TR' as const, planetName: 'Old',
        battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null },
    })));
  };

  beforeEach(async () => {
    f = await seedWorld(10, 9321);
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    if (!current) throw new Error('Missing fixture season');
    await f.db.update(seasonCycles).set({ ordinal: 2 }).where(eq(seasonCycles.id, current.cycleId));
    const startsAt = new Date(current.startsAt.getTime() - 14 * 86_400_000);
    const [cycle] = await f.db.insert(seasonCycles).values({ ordinal: 1, startsAt, endsAt: current.startsAt }).returning();
    if (!cycle) throw new Error('Missing prior cycle');
    priorCycleId = cycle.id;
    const [prior] = await f.db.insert(seasons).values({
      shardId: current.shardId, cycleId: cycle.id, seed: 9320, status: 'wiped',
      startsAt, endsAt: current.startsAt, closedAt: current.startsAt, endReason: 'SCHEDULED_END',
    }).returning();
    if (!prior) throw new Error('Missing prior season');
    priorSeasonId = prior.id;
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  it('names monument N after last season\'s rank N, including the new ranks six to eight, and excludes ninth', async () => {
    await recordRanks([3, 1, 8, 5, 2, 4, 6, 7, 9]);
    expect(await monumentHonorees(f.db, f.seasonId))
      .toEqual(['Champion1', 'Champion2', 'Champion3', 'Champion4', 'Champion5', 'Champion6', 'Champion7', 'Champion8']);
  });

  it('leaves a monument unnamed when last season had fewer commanders', async () => {
    await recordRanks([2, 1]);
    expect(await monumentHonorees(f.db, f.seasonId)).toEqual(['Champion1', 'Champion2', null, null, null, null, null, null]);
  });

  it('names nothing in a galaxy with no previous season', async () => {
    await f.db.delete(seasons).where(eq(seasons.id, priorSeasonId));
    expect(await monumentHonorees(f.db, f.seasonId)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('reads only a season that is over', async () => {
    await recordRanks([1, 2, 3, 4, 5]);
    await f.db.update(seasons).set({ status: 'live' }).where(eq(seasons.id, priorSeasonId));
    expect(await monumentHonorees(f.db, f.seasonId)).toEqual([null, null, null, null, null, null, null, null]);
  });

  /**
   * EACH GALAXY HONOURS ITS OWN. Production runs two galaxies at once; reading every main
   * galaxy's last season wrote both rank-1 commanders into one slot, whichever came last.
   */
  it('names the monuments after this galaxy\'s own last season, not another galaxy\'s', async () => {
    await recordRanks([1, 2, 3, 4, 5, 6, 7, 8]);
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [other] = await f.db.insert(shards).values({ code: 'EU-OTHER', name: 'Other', ordinal: 77 }).returning();
    const [elsewherePrior] = await f.db.insert(seasons).values({
      shardId: other!.id, cycleId: priorCycleId, seed: 9322, status: 'wiped',
      startsAt: new Date(current!.startsAt.getTime() - 14 * 86_400_000), endsAt: current!.startsAt,
      closedAt: current!.startsAt, endReason: 'SCHEDULED_END',
    }).returning();
    const [elsewhereNow] = await f.db.insert(seasons).values({
      shardId: other!.id, cycleId: current!.cycleId, seed: 9323, status: 'live',
      startsAt: current!.startsAt, endsAt: current!.endsAt,
    }).returning();
    // One commander finished first over there; an account holds one result per cycle.
    await f.db.insert(seasonResults).values({
      cycleId: priorCycleId, seasonId: elsewherePrior!.id, accountId: f.accountIds[8]!, finalRank: 1,
      dominion: 100, title: 'VETERAN', createdAt: current!.startsAt,
      recap: { commanderName: 'Elsewhere1', countryCode: 'TR' as const, planetName: 'Old',
        battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null },
    });
    expect(await monumentHonorees(f.db, f.seasonId))
      .toEqual(['Champion1', 'Champion2', 'Champion3', 'Champion4', 'Champion5', 'Champion6', 'Champion7', 'Champion8']);
    expect(await monumentHonorees(f.db, elsewhereNow!.id)).toEqual(['Elsewhere1', null, null, null, null, null, null, null]);
  });

  it('hands the names to every client with the season', async () => {
    await recordRanks([1, 2, 3, 4, 5, 6, 7, 8]);
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const response = await app.inject({
      method: 'GET', url: '/api/season',
      headers: { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` },
    });
    expect(response.statusCode).toBe(200);
    const body = seasonSchema.parse(response.json());
    expect(body.monumentHonorees).toEqual(['Champion1', 'Champion2', 'Champion3', 'Champion4', 'Champion5', 'Champion6', 'Champion7', 'Champion8']);
  });
});
