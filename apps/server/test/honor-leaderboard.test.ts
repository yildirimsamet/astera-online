import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { botProfiles, honorTotals, players } from '../src/db/schema.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { galaxySchema, leaderboardSchema } from '../../web/src/api/schemas.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

describe('public Honor ranking and client contract', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let closeApp: () => Promise<void>;
  let authorization: string;
  beforeEach(async () => {
    f = await seedWorld(4, 7719);
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    app = built.app; closeApp = built.close; await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
  });
  afterEach(async () => { await closeApp(); });
  afterAll(async () => { await (await testDb()).close(); });
  const board = async (ranking = 'HONOR') => {
    const response = await app.inject({ method: 'GET', url: `/api/leaderboard?ranking=${ranking}`, headers: { authorization } });
    expect(response.statusCode).toBe(200);
    return leaderboardSchema.parse(response.json());
  };
  const enable = (mode: 'ACTIVE' | 'SHADOW' = 'ACTIVE') => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, mode, f.clock));

  it('keeps legacy and shadow seasons on Dominion without exposing shadow points', async () => {
    await f.db.update(players).set({ dominionTaken: 123 }).where(eq(players.id, f.playerIds[0]!));
    expect(await board()).toMatchObject({ ranking: 'DOMINION', honorEnabled: false, you: { score: 123 } });
    await enable('SHADOW');
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 999_000_000 });
    const result = await board();
    expect(result).toMatchObject({ ranking: 'DOMINION', honorEnabled: false, you: { score: 123 } });
    expect(JSON.stringify(result)).not.toContain('999000000');
  });

  it('uses competition ranks, exposes both scores and retains the separate Dominion ordering', async () => {
    await enable();
    await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId,
      score: index < 2 ? 123_456_789 : index === 2 ? 0 : -500_000 })));
    await f.db.update(players).set({ dominionTaken: 1000 }).where(eq(players.id, f.playerIds[3]!));
    const result = await board();
    expect(result.ranking).toBe('HONOR');
    expect(result.ladder.map(row => row.rank)).toEqual([1, 1, 3, 4]);
    expect(result.you).toMatchObject({ score: 123_456_789, honor: 123_456_789, dominion: 0 });
    expect(result.honorReward).toMatchObject({ rank: 1, honor: 123_456_789,
      nominal: { alloy: 3750, crystal: 2750, deuterium: 550 },
      fullThreshold: 134_250_000 });
    const old = await board('DOMINION');
    expect(old.ladder[0]?.playerId).toBe(f.playerIds[3]);
    expect(old.ranking).toBe('DOMINION');
    expect(JSON.stringify(result)).not.toMatch(/navy|referenceOrder|evidenceHash|accountId/);
  });

  it('puts Honor places on galaxy worlds even when the Dominion leader has no positive Honor', async () => {
    await enable();
    await f.db.insert(honorTotals).values(f.playerIds.map((playerId, index) => ({ seasonId: f.seasonId, playerId,
      score: index === 0 ? 0 : (4 - index) * 10_000_000 })));
    await f.db.update(players).set({ dominionTaken: 999_999 }).where(eq(players.id, f.playerIds[0]!));
    const response = await app.inject({ method: 'GET', url: '/api/galaxy', headers: { authorization } });
    expect(response.statusCode, response.body).toBe(200);
    const galaxy = galaxySchema.parse(response.json());
    expect(galaxy.planets.find(row => row.id === f.planetIds[0])).toMatchObject({ honorRanking: true, dominionRank: 1 });
    expect(galaxy.planets.find(row => row.id === f.planetIds[0])?.honorRank).toBeUndefined();
    expect(galaxy.planets.find(row => row.id === f.planetIds[1])).toMatchObject({ honorRanking: true, honorRank: 1 });
    expect(galaxy.planets.find(row => row.id === f.planetIds[2])).toMatchObject({ honorRanking: true, honorRank: 2 });
    expect(galaxy.planets.find(row => row.id === f.planetIds[3])).toMatchObject({ honorRanking: true, honorRank: 3 });
  });

  it('lists bots on Honor like every commander, so the two ladders cannot be diffed to find them', async () => {
    await enable();
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[1]!, ordinal: 1, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    const ids = (rows: { playerId: string }[]) => rows.map(row => row.playerId).sort();
    const result = await board();
    expect(ids(result.ladder)).toEqual(ids((await board('DOMINION')).ladder));
    expect(result.ladder).toHaveLength(4);
    expect(result.ladder.every(row => row.rank === 1)).toBe(true);
    const raw = (await app.inject({ method: 'GET', url: '/api/leaderboard?ranking=HONOR', headers: { authorization } }))
      .json<{ ladder: Record<string, unknown>[] }>().ladder;
    const keys = (playerId: string) => Object.keys(raw.find(row => row.playerId === playerId)!).sort();
    expect(keys(f.playerIds[1]!)).toEqual(keys(f.playerIds[2]!));
    expect(JSON.stringify(raw)).not.toMatch(/"bot"|isBot|persona|RAIDER/);
  });

  it('a bot ahead keeps its place, so the prize shown matches the visible rank', async () => {
    await enable();
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[1]!, ordinal: 1, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    await f.db.insert(honorTotals).values([
      { seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 50_000_000 },
      { seasonId: f.seasonId, playerId: f.playerIds[1]!, score: 90_000_000 },
    ]);
    const result = await board();
    expect(result.ladder.map(row => row.rank)).toEqual([1, 2, 3, 3]);
    expect(result.ladder.slice(0, 2).map(row => row.playerId)).toEqual([f.playerIds[1], f.playerIds[0]]);
    expect(result.you).toMatchObject({ rank: 2 });
    expect(result.honorReward).toMatchObject({ rank: 2, honor: 50_000_000 });
  });

  it('publishes the announced opening time and clean totals without leaking the observation epoch', async () => {
    await enable('SHADOW');
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 999_000_000 });
    const hidden = await board();
    expect(hidden.honorStartsAt).toBeNull();
    f.clock.advance(2 * 24 * 60);
    await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
    const result = await board();
    expect(result.honorStartsAt).toEqual(f.clock.now());
    expect(result.ladder.every(row => row.honor === 0 && row.rank === 1)).toBe(true);
    expect(result.honorReward!.reward).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(JSON.stringify(result)).not.toMatch(/observedSince|shadowEvents|legacySources/);
    expect((await board('DOMINION')).honorStartsAt).toEqual(f.clock.now());
  });
});
