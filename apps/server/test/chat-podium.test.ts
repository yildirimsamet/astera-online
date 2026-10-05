import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { clanMemberships, clans, players, seasonCycles, seasonResults, seasonRewardEntitlements, seasons, shards } from '../src/db/schema.js';
import { previousSeasonPodium } from '../src/services/messageDecorations.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const message = z.object({ id: z.string(), previousSeasonRank: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional() });
const posted = z.object({ message, conversationId: z.string().optional() });
const page = z.object({ messages: z.array(message) });

describe('previous-season chat podium', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];
  let priorSeasonId: string;

  beforeEach(async () => {
    f = await seedWorld(4, 8319);
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    if (!current) throw new Error('Missing fixture season');
    await f.db.update(seasonCycles).set({ ordinal: 2 }).where(eq(seasonCycles.id, current.cycleId));
    const startsAt = new Date(current.startsAt.getTime() - 14 * 86_400_000);
    const [cycle] = await f.db.insert(seasonCycles).values({ ordinal: 1, startsAt, endsAt: current.startsAt }).returning();
    if (!cycle) throw new Error('Missing prior cycle');
    const [prior] = await f.db.insert(seasons).values({
      shardId: current.shardId, cycleId: cycle.id, seed: 8318, status: 'wiped',
      startsAt, endsAt: current.startsAt, closedAt: current.startsAt, endReason: 'SCHEDULED_END',
    }).returning();
    if (!prior) throw new Error('Missing prior season');
    priorSeasonId = prior.id;
    await f.db.insert(seasonResults).values(f.accountIds.map((accountId, index) => ({
      cycleId: cycle.id, seasonId: prior.id, accountId, finalRank: index + 1, dominion: 100,
      title: 'VETERAN', createdAt: current.startsAt,
      recap: { commanderName: `Previous${index}`, countryCode: 'TR' as const, planetName: 'Old',
        battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null },
    })));
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(f.accountIds.map(async (id) => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  it('marks exactly the previous top three without needing a reward claim', async () => {
    expect(await previousSeasonPodium(f.db, f.playerIds)).toEqual(new Map([
      [f.playerIds[0], 1], [f.playerIds[1], 2], [f.playerIds[2], 3],
    ]));
    await f.db.update(players).set({ dominionTaken: 99_999 }).where(eq(players.id, f.playerIds[3]!));
    expect((await previousSeasonPodium(f.db, f.playerIds)).has(f.playerIds[3]!)).toBe(false);
  });

  it('returns no podium for an empty page', async () => {
    expect(await previousSeasonPodium(f.db, [])).toEqual(new Map());
  });

  it('does not retain an older podium into the following season', async () => {
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(seasonCycles).set({ ordinal: 3 }).where(eq(seasonCycles.id, current!.cycleId));
    expect(await previousSeasonPodium(f.db, f.playerIds)).toEqual(new Map());
  });

  it('retains the frozen MAIN podium when that shard is repurposed as Silent Space', async () => {
    const [prior] = await f.db.select().from(seasons).where(eq(seasons.id, priorSeasonId));
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(seasonRewardEntitlements).values({
      sourceCycleId: prior!.cycleId, sourceSeasonId: priorSeasonId, targetCycleId: current!.cycleId,
      accountId: f.accountIds[0]!, displayRank: 1, rewardPlace: 1,
      alloy: 1_000, crystal: 500, deuterium: 100, programVersion: 1, createdAt: f.clock.now(),
    });
    await f.db.update(shards).set({ role: 'WAITING' });
    expect(await previousSeasonPodium(f.db, f.playerIds)).toEqual(new Map([
      [f.playerIds[0], 1], [f.playerIds[1], 2], [f.playerIds[2], 3],
    ]));
  });

  it('does not award a Silent Space or unfinished season podium', async () => {
    await f.db.update(seasons).set({ status: 'pending' }).where(eq(seasons.id, priorSeasonId));
    expect(await previousSeasonPodium(f.db, f.playerIds)).toEqual(new Map());
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, priorSeasonId));
    await f.db.update(shards).set({ role: 'WAITING' });
    expect(await previousSeasonPodium(f.db, f.playerIds)).toEqual(new Map());
  });

  it('includes the same podium in general chat post and history', async () => {
    for (const who of [0, 1, 2, 3]) {
      const result = await app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[who], payload: { content: `Hello${who}` } });
      expect(result.statusCode, result.body).toBe(200);
      expect(posted.parse(result.json()).message.previousSeasonRank).toBe(who < 3 ? who + 1 : undefined);
    }
    const result = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[3] });
    expect(page.parse(result.json()).messages.map((row) => row.previousSeasonRank)).toEqual([1, 2, 3, undefined]);
  });

  it('includes the podium in clan chat post and history', async () => {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Podium', nameKey: 'podium', tag: 'WIN', createdAt: f.clock.now() }).returning();
    await f.db.insert(clanMemberships).values(f.playerIds.slice(0, 2).map((playerId, slot) => ({
      seasonId: f.seasonId, clanId: clan!.id, playerId, role: slot === 0 ? 'LEADER' as const : 'MEMBER' as const,
      slot, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now(),
    })));
    const result = await app.inject({ method: 'POST', url: '/api/clan/chat/messages', headers: { ...auth[1], 'idempotency-key': 'podium-clan' }, payload: { content: 'Silver' } });
    expect(result.statusCode, result.body).toBe(200);
    expect(posted.parse(result.json()).message.previousSeasonRank).toBe(2);
    const history = await app.inject({ method: 'GET', url: '/api/clan/chat', headers: auth[0] });
    expect(page.parse(history.json()).messages[0]?.previousSeasonRank).toBe(2);
  });

  it('includes the podium in DM post and history', async () => {
    const result = await app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[2], payload: { recipientPlayerId: f.playerIds[3], content: 'Bronze' } });
    expect(result.statusCode, result.body).toBe(200);
    const { conversationId, message: row } = posted.parse(result.json());
    expect(row.previousSeasonRank).toBe(3);
    const history = await app.inject({ method: 'GET', url: `/api/dm/conversations/${conversationId}/messages`, headers: auth[3] });
    expect(history.statusCode, history.body).toBe(200);
    expect(page.parse(history.json()).messages[0]?.previousSeasonRank).toBe(3);
  });
});
