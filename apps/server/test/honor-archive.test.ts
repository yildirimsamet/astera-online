import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { honorTotals, seasonResults } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { seasonArchiveLeaderboardSchema, seasonCommanderProfileSchema } from '../../web/src/api/schemas.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

describe('Honor remains the primary achievement in historical records', () => {
  let f: Fixture, app: FastifyInstance, close: () => Promise<void>, authorization: string;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close; await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { await (await testDb()).close(); });

  it('retains separate Honor and Dominion rank/score on the ladder, profile and career', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 120_500_000 });
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const response = await app.inject({ url: `/api/season-archive/${f.seasonId}/leaderboard`, headers: { authorization } });
    expect(response.statusCode).toBe(200);
    const board = seasonArchiveLeaderboardSchema.parse(response.json());
    expect(board.ladder.find(row => row.self)).toMatchObject({ honorScore: 120_500_000, honorRank: 1, dominion: 0 });
    const [result] = await f.db.select().from(seasonResults).where(eq(seasonResults.accountId, f.accountIds[0]!));
    const detail = await app.inject({ url: `/api/season-archive/results/${result!.publicId}`, headers: { authorization } });
    expect(detail.statusCode).toBe(200);
    const profile = seasonCommanderProfileSchema.parse(detail.json());
    expect(profile.selected).toMatchObject({ honorScore: 120_500_000, honorRank: 1 });
    expect(profile.career.seasons[0]).toMatchObject({ honorScore: 120_500_000, honorRank: 1 });
    expect(profile.career).toMatchObject({ championships: 1, podiums: 1, bestRank: 1 });
  });
  it('does not count a zero-Honor tied place as a championship or podium achievement', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const [result] = await f.db.select().from(seasonResults).where(eq(seasonResults.accountId, f.accountIds[0]!));
    const detail = await app.inject({ url: `/api/season-archive/results/${result!.publicId}`, headers: { authorization } });
    expect(seasonCommanderProfileSchema.parse(detail.json()).career).toMatchObject({ championships: 0, podiums: 0, bestRank: null });
  });
});
