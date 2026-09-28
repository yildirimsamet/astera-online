import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { clanMemberships, clans, dmBlocks, players, seasons } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const logger = pino({ level: 'silent' });
const reply = z.object({ id: z.string(), username: z.string(), content: z.string() }).nullable();
const message = z.object({ id: z.string(), content: z.string(), replyTo: reply,
  reactions: z.array(z.object({ emoji: z.string(), count: z.number(), mine: z.boolean() })) });
const post = z.object({ message });
const page = z.object({ messages: z.array(message) });
const dmPost = z.object({ conversationId: z.string(), message });

afterAll(async () => { const { close } = await testDb(); await close(); });

describe('message reactions and replies', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];

  beforeEach(async () => {
    f = await seedWorld(3, 6363);
    const built = buildApp({ env: testEnv(), logger, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(f.accountIds.map(async (id) => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  });
  afterEach(async () => { await close(); });

  const sendGeneral = (who: number, content: string, replyToMessageId?: string, language = 'tr') => app.inject({
    method: 'POST', url: '/api/chat/messages', headers: auth[who], payload: { content, language, ...(replyToMessageId ? { replyToMessageId } : {}) },
  });
  const sendDm = (who: number, recipientPlayerId: string, content: string, replyToMessageId?: string) => app.inject({
    method: 'POST', url: '/api/dm/messages', headers: auth[who], payload: { recipientPlayerId, content, ...(replyToMessageId ? { replyToMessageId } : {}) },
  });
  const react = (who: number, channel: 'general' | 'clan' | 'dm', messageId: string, emoji: string | null) => app.inject({
    method: 'POST', url: '/api/chat/reactions', headers: auth[who], payload: { channel, messageId, emoji },
  });

  it('keeps one reaction per commander and a quoted reply in general chat', async () => {
    const first = await sendGeneral(0, 'Look north');
    expect(first.statusCode, first.body).toBe(200);
    const target = post.parse(first.json()).message;
    const answer = await sendGeneral(1, 'I see it', target.id);
    expect(answer.statusCode, answer.body).toBe(200);
    expect(post.parse(answer.json()).message.replyTo).toMatchObject({ id: target.id, content: 'Look north', username: 'Tester0' });
    expect((await react(0, 'general', target.id, '👍')).statusCode).toBe(200);
    expect((await react(1, 'general', target.id, '👍')).statusCode).toBe(200);
    let listed = page.parse((await app.inject({ method: 'GET', url: '/api/chat/messages?language=tr', headers: auth[0] })).json()).messages;
    expect(listed[0]?.reactions).toEqual([{ emoji: '👍', count: 2, mine: true }]);
    expect(listed[1]?.replyTo).toMatchObject({ id: target.id, content: 'Look north' });
    expect((await react(0, 'general', target.id, '❤️')).statusCode).toBe(200);
    listed = page.parse((await app.inject({ method: 'GET', url: '/api/chat/messages?language=tr', headers: auth[1] })).json()).messages;
    expect(listed[0]?.reactions).toEqual([
      { emoji: '👍', count: 1, mine: true }, { emoji: '❤️', count: 1, mine: false },
    ]);
    expect((await react(0, 'general', target.id, null)).statusCode).toBe(200);
    expect((await react(0, 'general', target.id, 'not-an-emoji')).statusCode).toBe(400);
    expect((await sendGeneral(1, 'wrong language', target.id, 'en')).statusCode).toBe(404);
  });

  it('limits clan interaction to messages visible since joining', async () => {
    const [clan] = await f.db.insert(clans).values({
      seasonId: f.seasonId, name: 'Orion Guard', nameKey: 'orion guard', tag: 'OG', createdAt: f.clock.now(),
    }).returning();
    for (const who of [0, 1]) {
      await f.db.insert(clanMemberships).values({
        seasonId: f.seasonId, clanId: clan!.id, playerId: f.playerIds[who]!, role: who === 0 ? 'LEADER' : 'MEMBER',
        slot: who, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now(),
      });
    }
    const first = await app.inject({ method: 'POST', url: '/api/clan/chat/messages', headers: { ...auth[0], 'idempotency-key': 'react-clan-first' }, payload: { content: 'Clan plan' } });
    expect(first.statusCode, first.body).toBe(200);
    const target = post.parse(first.json()).message;
    const answer = await app.inject({ method: 'POST', url: '/api/clan/chat/messages', headers: { ...auth[1], 'idempotency-key': 'react-clan-answer' }, payload: { content: 'Ready', replyToMessageId: target.id } });
    expect(answer.statusCode, answer.body).toBe(200);
    expect(post.parse(answer.json()).message.replyTo?.content).toBe('Clan plan');
    expect((await react(1, 'clan', target.id, '👏')).statusCode).toBe(200);
    expect((await react(2, 'clan', target.id, '👏')).statusCode).toBe(403);
    const listed = page.parse((await app.inject({ method: 'GET', url: '/api/clan/chat', headers: auth[1] })).json()).messages;
    expect(listed[0]?.reactions).toEqual([{ emoji: '👏', count: 1, mine: true }]);
    expect(listed[1]?.replyTo?.content).toBe('Clan plan');
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    expect((await react(1, 'clan', target.id, '👍')).statusCode).toBe(200);
  });

  it('does not react after a concurrent clan departure', async () => {
    const [clan] = await f.db.insert(clans).values({
      seasonId: f.seasonId, name: 'Rim Watch', nameKey: 'rim watch', tag: 'RW', createdAt: f.clock.now(),
    }).returning();
    for (const who of [0, 1]) await f.db.insert(clanMemberships).values({
      seasonId: f.seasonId, clanId: clan!.id, playerId: f.playerIds[who]!,
      role: who === 0 ? 'LEADER' : 'MEMBER', slot: who, joinedAt: f.clock.now(),
      matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now(),
    });
    const first = await app.inject({ method: 'POST', url: '/api/clan/chat/messages',
      headers: { ...auth[0], 'idempotency-key': 'react-clan-departure' }, payload: { content: 'Watch the rim' } });
    const target = post.parse(first.json()).message;
    let release!: () => void;
    let acquired!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const departure = f.db.transaction(async (tx) => {
      await tx.select({ id: players.id }).from(players).where(eq(players.id, f.playerIds[1]!)).for('update');
      acquired();
      await hold;
      await tx.update(clanMemberships).set({ leftAt: f.clock.now() })
        .where(eq(clanMemberships.playerId, f.playerIds[1]!));
    });
    await ready;
    const pending = react(1, 'clan', target.id, '👏');
    let waitingOnLock = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const [activity] = await f.db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
         WHERE datname = current_database() AND state = 'active'
           AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()
           AND query ILIKE '%players%for update%'
      `);
      if ((activity?.count ?? 0) > 0) { waitingOnLock = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    release();
    await departure;
    expect(waitingOnLock).toBe(true);
    expect((await pending).statusCode).toBe(403);
  });

  it('keeps replies and reactions inside their DM participants and blocks writes while unavailable', async () => {
    const first = await sendDm(0, f.playerIds[1]!, 'Private plan');
    expect(first.statusCode, first.body).toBe(200);
    const { conversationId, message: target } = dmPost.parse(first.json());
    const answer = await sendDm(1, f.playerIds[0]!, 'Agreed', target.id);
    expect(answer.statusCode, answer.body).toBe(200);
    expect(dmPost.parse(answer.json()).message.replyTo?.content).toBe('Private plan');
    expect((await react(1, 'dm', target.id, '😮')).statusCode).toBe(200);
    expect((await react(2, 'dm', target.id, '😮')).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/dm/blocks', headers: auth[1],
      payload: { targetPlayerId: f.playerIds[0]! } })).statusCode).toBe(200);
    expect((await react(0, 'dm', target.id, '👍')).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE',
      url: `/api/dm/blocks/${f.playerIds[0]!}`, headers: auth[1] })).statusCode).toBe(200);
    expect((await react(0, 'dm', target.id, '👍')).statusCode).toBe(200);
    expect((await sendDm(2, f.playerIds[1]!, 'Cross-thread', target.id)).statusCode).toBe(404);
    const listed = page.parse((await app.inject({ method: 'GET', url: `/api/dm/conversations/${conversationId}/messages`, headers: auth[1] })).json()).messages;
    expect(listed[0]?.reactions).toEqual([
      { emoji: '👍', count: 1, mine: false }, { emoji: '😮', count: 1, mine: true },
    ]);
    expect(listed[1]?.replyTo?.content).toBe('Private plan');
    const waiting = await createSeason(f.db, { shardCode: 'WAIT-REACT', role: 'WAITING', seed: 8181,
      startsAt: f.clock.now(), days: 14, rulesetVersion: 1 });
    await f.db.update(players).set({ seasonId: waiting.season.id }).where(eq(players.id, f.playerIds[1]!));
    expect((await react(0, 'dm', target.id, '😂')).statusCode).toBe(409);
  });

  it('serializes DM reactions with a concurrent block', async () => {
    const first = await sendDm(0, f.playerIds[1]!, 'Block race');
    const target = dmPost.parse(first.json()).message;
    const [low, high] = [f.playerIds[0]!, f.playerIds[1]!].sort();
    let release!: () => void;
    let acquired!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const block = f.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`dm:${low}:${high}`}))`);
      acquired();
      await hold;
      await tx.insert(dmBlocks).values({ blockerPlayerId: f.playerIds[1]!,
        targetPlayerId: f.playerIds[0]!, createdAt: f.clock.now() });
    });
    await ready;
    const pending = react(0, 'dm', target.id, '👍');
    const settledWhileBlocked = await Promise.race([
      pending.then(() => true), new Promise<false>((resolve) => setTimeout(() => { resolve(false); }, 500)),
    ]);
    release();
    await block;
    expect(settledWhileBlocked).toBe(false);
    expect((await pending).statusCode).toBe(403);
  });

  it('does not react after a concurrent transfer to Silent Space', async () => {
    const first = await sendDm(0, f.playerIds[1]!, 'Transfer race');
    const target = dmPost.parse(first.json()).message;
    const waiting = await createSeason(f.db, { shardCode: 'WAIT-REACT-RACE', role: 'WAITING', seed: 8182,
      startsAt: f.clock.now(), days: 14, rulesetVersion: 1 });
    let release!: () => void;
    let acquired!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const transfer = f.db.transaction(async (tx) => {
      await tx.select({ id: players.id }).from(players).where(eq(players.id, f.playerIds[1]!)).for('update');
      acquired();
      await hold;
      await tx.update(players).set({ seasonId: waiting.season.id }).where(eq(players.id, f.playerIds[1]!));
    });
    await ready;
    const pending = react(0, 'dm', target.id, '👏');
    const settledWhileTransferring = await Promise.race([
      pending.then(() => true), new Promise<false>((resolve) => setTimeout(() => { resolve(false); }, 500)),
    ]);
    release();
    await transfer;
    expect(settledWhileTransferring).toBe(false);
    expect((await pending).statusCode).toBe(409);
  });
});
