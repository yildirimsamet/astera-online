import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, chatMessages, players } from '../src/db/schema.js';
import { EventBus } from '../src/stream/bus.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import {
  makeAccount,
  placeAt,
  seedWorld,
  TEST_DATABASE_URL,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('galaxy chat', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];

  beforeEach(async () => {
    f = await seedWorld(2);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(f.accountIds.map(async (id) => ({
      authorization: `Bearer ${await tokens.issueAccess(id)}`,
    })));
  });

  afterEach(async () => {
    await close();
  });

  const post = (who: number, content: string) => app.inject({
    method: 'POST',
    url: '/api/chat/messages',
    headers: auth[who],
    payload: { content },
  });

  it('requires auth and never accepts a client-authored identity', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/chat/messages' })).statusCode).toBe(401);
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/messages',
      headers: auth[0],
      payload: { content: 'hello', username: 'Impostor' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('trims content, preserves Unicode and accepts exactly 280 characters', async () => {
    expect((await post(0, '   ')).statusCode).toBe(400);
    const unicode = `  İzci 🚀 ${'🌌'.repeat(273)}  `;
    const accepted = await post(0, unicode);
    expect(accepted.statusCode).toBe(200);
    expect(Array.from(accepted.json<{ message: { content: string } }>().message.content)).toHaveLength(280);
    expect((await post(0, '🌌'.repeat(281))).statusCode).toBe(400);
  });

  it('uses canonical account identity and never a stale season name', async () => {
    await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[0]!));
    await f.db.update(players).set({ name: 'STALE' }).where(eq(players.id, f.playerIds[0]!));
    const sent = await post(0, 'Merhaba');
    expect(sent.json<{ message: { username: string; planetId: string } }>().message).toMatchObject({
      username: 'İzci',
      planetId: f.planetIds[0],
    });
    const read = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[1] });
    expect(read.json<{ messages: { username: string; planetId: string }[] }>().messages[0]).toMatchObject({
      username: 'İzci',
      planetId: f.planetIds[0],
    });
  });

  it('never publishes an undiscovered author location through chat', async () => {
    await placeAt(f.db, f.planetIds[0]!, { x: 3_000 });
    expect((await post(0, 'Beni bul')).statusCode).toBe(200);

    const read = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[1] });
    const [message] = read.json<{ messages: Record<string, unknown>[] }>().messages;
    expect(message).toMatchObject({ authorPlayerId: f.playerIds[0], content: 'Beni bul' });
    expect(message).not.toHaveProperty('planetId');
  });

  it('limits one player to five committed messages in a rolling ten seconds', async () => {
    const first = await Promise.all(Array.from({ length: 6 }, (_, i) => post(0, `m${String(i)}`)));
    expect(first.filter((res) => res.statusCode === 200)).toHaveLength(5);
    expect(first.filter((res) => res.statusCode === 429)).toHaveLength(1);
    f.clock.advance(10 / 60);
    expect((await post(0, 'after-window')).statusCode).toBe(200);
  });

  it('gives concurrent authors distinct ordered read instants', async () => {
    const sent = await Promise.all([post(0, 'alpha'), post(1, 'beta')]);
    expect(sent.every((response) => response.statusCode === 200)).toBe(true);
    const times = sent.map((response) =>
      response.json<{ message: { createdAt: string } }>().message.createdAt,
    );
    expect(new Set(times).size).toBe(2);
  });

  it('paginates newest-first pages chronologically with a stable cursor', async () => {
    const start = f.clock.now().getTime();
    await f.db.insert(chatMessages).values(Array.from({ length: 60 }, (_, i) => ({
      seasonId: f.seasonId,
      authorPlayerId: f.playerIds[1]!,
      content: `m${String(i)}`,
      createdAt: new Date(start + i * 1000),
    })));
    const newest = await app.inject({ method: 'GET', url: '/api/chat/messages?limit=50', headers: auth[0] });
    const page = newest.json<{ messages: { content: string }[]; nextBefore: string | null }>();
    expect(page.messages).toHaveLength(50);
    expect(page.messages[0]!.content).toBe('m10');
    expect(page.messages.at(-1)!.content).toBe('m59');
    const older = await app.inject({ method: 'GET', url: `/api/chat/messages?limit=50&before=${page.nextBefore!}`, headers: auth[0] });
    expect(older.json<{ messages: { content: string }[] }>().messages.map((m) => m.content))
      .toEqual(Array.from({ length: 10 }, (_, i) => `m${String(i)}`));
  });

  it('paginates equal-timestamp concurrent messages without gaps or duplicates', async () => {
    await f.db.insert(chatMessages).values(Array.from({ length: 55 }, (_, i) => ({
      seasonId: f.seasonId,
      authorPlayerId: f.playerIds[1]!,
      content: `same-${String(i)}`,
      createdAt: f.clock.now(),
    })));
    const newest = await app.inject({ method: 'GET', url: '/api/chat/messages?limit=50', headers: auth[0] });
    const first = newest.json<{ messages: { id: string }[]; nextBefore: string | null }>();
    const older = await app.inject({
      method: 'GET',
      url: `/api/chat/messages?limit=50&before=${first.nextBefore!}`,
      headers: auth[0],
    });
    const second = older.json<{ messages: { id: string }[]; nextBefore: string | null }>();
    const ids = [...first.messages, ...second.messages].map((message) => message.id);
    expect(first.messages).toHaveLength(50);
    expect(second.messages).toHaveLength(5);
    expect(new Set(ids).size).toBe(55);
    expect(second.nextBefore).toBeNull();
  });

  it('isolates seasons in reads, unread counts and cursors', async () => {
    const other = await createSeason(f.db, {
      shardCode: 'EU-CHAT-OTHER', seed: 9001, startsAt: f.clock.now(), playerCap: 5,
    });
    const account = await makeAccount(f.db, 'Elsewhere');
    const joined = await joinSeason(f.db, account.id, other.season.id, f.clock);
    const [foreign] = await f.db.insert(chatMessages).values({
      seasonId: other.season.id,
      authorPlayerId: joined.playerId,
      content: 'secret elsewhere',
      createdAt: f.clock.now(),
    }).returning();
    const list = await app.inject({ method: 'GET', url: '/api/chat/messages', headers: auth[0] });
    expect(list.json<{ messages: unknown[] }>().messages).toEqual([]);
    const unread = await app.inject({ method: 'GET', url: '/api/chat/unread', headers: auth[0] });
    expect(unread.json<{ count: number }>().count).toBe(0);
    const cursor = await app.inject({ method: 'GET', url: `/api/chat/messages?before=${foreign!.id}`, headers: auth[0] });
    expect(cursor.statusCode).toBe(400);
  });

  it('counts only other commanders and keeps the newest read marker under races', async () => {
    const self = await post(0, 'mine');
    expect(self.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/chat/unread', headers: auth[0] })).json<{ count: number }>().count).toBe(0);

    const older = (await post(1, 'older')).json<{ message: { id: string } }>().message;
    f.clock.advance(1 / 60);
    const newer = (await post(1, 'newer')).json<{ message: { id: string } }>().message;
    expect((await app.inject({ method: 'GET', url: '/api/chat/unread', headers: auth[0] })).json<{ count: number }>().count).toBe(2);

    await Promise.all([
      app.inject({ method: 'POST', url: '/api/chat/read', headers: auth[0], payload: { messageId: newer.id } }),
      app.inject({ method: 'POST', url: '/api/chat/read', headers: auth[0], payload: { messageId: older.id } }),
    ]);
    expect((await app.inject({ method: 'GET', url: '/api/chat/unread', headers: auth[0] })).json<{ count: number }>().count).toBe(0);
  });

  it('rejects unread markers outside the caller season and malformed page limits', async () => {
    const other = await createSeason(f.db, {
      shardCode: 'EU-CHAT-READ', seed: 9002, startsAt: f.clock.now(), playerCap: 5,
    });
    const account = await makeAccount(f.db, 'ForeignRead');
    const joined = await joinSeason(f.db, account.id, other.season.id, f.clock);
    const [foreign] = await f.db.insert(chatMessages).values({
      seasonId: other.season.id,
      authorPlayerId: joined.playerId,
      content: 'not visible here',
      createdAt: f.clock.now(),
    }).returning();
    const marked = await app.inject({
      method: 'POST', url: '/api/chat/read', headers: auth[0], payload: { messageId: foreign!.id },
    });
    expect(marked.statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/chat/messages?limit=51', headers: auth[0] })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/chat/messages?limit=0', headers: auth[0] })).statusCode).toBe(400);
  });

  it('publishes shard:chat after commit', async () => {
    const bus = new EventBus(TEST_DATABASE_URL, silent);
    await bus.start();
    const heard: string[] = [];
    const off = bus.subscribeShard(f.seasonId, (event) => { heard.push(event.kind); });
    try {
      expect((await post(0, 'live')).statusCode).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(heard).toContain('shard:chat');
    } finally {
      off();
      await bus.stop();
    }
  });
});
