import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { CHAT } from '@astera/rules';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, dmArchive, dmConversations, dmMessages, players } from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { createSeason } from '../src/services/season.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const logger = pino({ level: 'silent' });
const postResult = z.object({
  conversationId: z.string(),
  message: z.object({ id: z.string(), content: z.string() }),
});
const conversationResult = z.object({
  conversations: z.array(z.object({ id: z.string(), canSend: z.boolean(), unavailableReason: z.string().nullable(),
    lastMessage: z.object({ id: z.string() }) })),
});
const pageResult = z.object({ messages: z.array(z.object({ content: z.string(), self: z.boolean() }).passthrough()), canSend: z.boolean() });
const unreadResult = z.object({ count: z.number() });
const contactsResult = z.object({ contacts: z.array(z.object({ playerId: z.string() })) });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('seasonal direct messages', () => {
  let fixture: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];

  beforeEach(async () => {
    fixture = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger, db: fixture.db, clock: fixture.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(fixture.accountIds.map(async (id) => ({
      authorization: `Bearer ${await tokens.issueAccess(id)}`,
    })));
  });

  afterEach(async () => { await close(); });

  const send = (who: number, recipientPlayerId: string, content = 'Hello') => app.inject({
    method: 'POST', url: '/api/dm/messages', headers: auth[who],
    payload: { recipientPlayerId, content },
  });

  it('requires authentication and exposes only a participant’s conversations', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/dm/conversations' })).statusCode).toBe(401);
    expect(contactsResult.parse((await app.inject({ method: 'GET', url: '/api/dm/contacts?q=Tester1', headers: auth[0] })).json()).contacts)
      .toMatchObject([{ playerId: fixture.playerIds[1] }]);
    const sent = await send(0, fixture.playerIds[1]!);
    expect(sent.statusCode, sent.body).toBe(200);

    const mine = await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[0] });
    const theirs = await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[1] });
    const stranger = await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[2] });
    expect(conversationResult.parse(mine.json()).conversations).toHaveLength(1);
    expect(conversationResult.parse(theirs.json()).conversations).toHaveLength(1);
    expect(conversationResult.parse(stranger.json()).conversations).toHaveLength(0);

    const id = conversationResult.parse(mine.json()).conversations[0]!.id;
    expect((await app.inject({ method: 'GET', url: `/api/dm/conversations/${id}/messages`, headers: auth[2] })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/dm/conversations/${id}/read`, headers: auth[2], payload: { messageId: conversationResult.parse(mine.json()).conversations[0]!.lastMessage.id } })).statusCode).toBe(404);
  });

  it('keeps one thread per pair, trims Unicode and counts unread per recipient', async () => {
    expect((await send(0, fixture.playerIds[0]!)).statusCode).toBe(400);
    expect((await send(0, fixture.playerIds[1]!, '   ')).statusCode).toBe(400);
    const first = await send(0, fixture.playerIds[1]!, '  Merhaba 🌌  ');
    const second = await send(1, fixture.playerIds[0]!, 'Cevap');
    expect(first.statusCode, first.body).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstBody = postResult.parse(first.json());
    expect(firstBody.conversationId).toBe(postResult.parse(second.json()).conversationId);
    expect(firstBody.message.content).toBe('Merhaba 🌌');
    expect(unreadResult.parse((await app.inject({ method: 'GET', url: '/api/dm/unread', headers: auth[1] })).json()).count).toBe(1);

    const id = firstBody.conversationId;
    const page = await app.inject({ method: 'GET', url: `/api/dm/conversations/${id}/messages`, headers: auth[1] });
    const pageBody = pageResult.parse(page.json());
    expect(pageBody.messages.map((message) => message.content)).toEqual(['Merhaba 🌌', 'Cevap']);
    expect(pageBody.messages[0]!.self).toBe(false);
    expect(pageBody.messages[1]!.self).toBe(true);
    expect(pageBody.messages[0]).not.toHaveProperty('planetId');

    const read = await app.inject({ method: 'POST', url: `/api/dm/conversations/${id}/read`, headers: auth[1], payload: { messageId: firstBody.message.id } });
    expect(read.statusCode).toBe(200);
    expect(unreadResult.parse((await app.inject({ method: 'GET', url: '/api/dm/unread', headers: auth[1] })).json()).count).toBe(0);
  });

  it('blocks either direction without erasing an existing conversation', async () => {
    const first = await send(0, fixture.playerIds[1]!);
    const id = postResult.parse(first.json()).conversationId;
    expect((await app.inject({ method: 'POST', url: '/api/dm/blocks', headers: auth[1], payload: { targetPlayerId: fixture.playerIds[0] } })).statusCode).toBe(200);
    expect(contactsResult.parse((await app.inject({ method: 'GET', url: '/api/dm/contacts?q=Tester0', headers: auth[1] })).json()).contacts).toHaveLength(0);
    expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(403);
    expect((await send(1, fixture.playerIds[0]!)).statusCode).toBe(403);
    const page = await app.inject({ method: 'GET', url: `/api/dm/conversations/${id}/messages`, headers: auth[1] });
    expect(pageResult.parse(page.json()).messages).toHaveLength(1);
    expect(pageResult.parse(page.json()).canSend).toBe(false);
    expect((await app.inject({ method: 'DELETE', url: `/api/dm/blocks/${fixture.playerIds[0]!}`, headers: auth[1] })).statusCode).toBe(200);
    expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(200);
  });

  it('disables sending during Silent Space and resumes the same history on return', async () => {
    const first = await send(0, fixture.playerIds[1]!);
    const id = postResult.parse(first.json()).conversationId;
    const waiting = await createSeason(fixture.db, {
      shardCode: 'WAIT-DM-TEST', role: 'WAITING', seed: 8181,
      startsAt: fixture.clock.now(), days: 14, rulesetVersion: 1,
    });
    await fixture.db.update(players).set({ seasonId: waiting.season.id }).where(eq(players.id, fixture.playerIds[1]!));

    const paused = await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[0] });
    expect(conversationResult.parse(paused.json()).conversations[0]).toMatchObject({ id, canSend: false, unavailableReason: 'WAITING' });
    expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(409);
    expect(pageResult.parse((await app.inject({ method: 'GET', url: `/api/dm/conversations/${id}/messages`, headers: auth[0] })).json()).messages).toHaveLength(1);
    expect(contactsResult.parse((await app.inject({ method: 'GET', url: '/api/dm/contacts?q=Tester', headers: auth[0] })).json()).contacts.map((c) => c.playerId)).not.toContain(fixture.playerIds[1]);

    await fixture.db.update(players).set({ seasonId: fixture.seasonId }).where(eq(players.id, fixture.playerIds[1]!));
    const resumed = await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[0] });
    expect(conversationResult.parse(resumed.json()).conversations[0]).toMatchObject({ id, canSend: true, unavailableReason: null });
    expect(postResult.parse((await send(0, fixture.playerIds[1]!, 'Welcome back')).json()).conversationId).toBe(id);
  });

  it('does not accept forged sender, another season, or an alien cursor', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: fixture.playerIds[1], content: 'Hi', username: 'Impostor' } })).statusCode).toBe(400);
    const first = await send(0, fixture.playerIds[1]!);
    const other = await send(0, fixture.playerIds[2]!);
    const id = postResult.parse(first.json()).conversationId;
    const otherId = postResult.parse(other.json()).message.id;
    expect((await app.inject({ method: 'GET', url: `/api/dm/conversations/${id}/messages?before=${otherId}`, headers: auth[0] })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/api/dm/conversations/${id}/read`, headers: auth[0], payload: { messageId: otherId } })).statusCode).toBe(404);
  });

  it('limits DM bursts and allows sending again after the window', async () => {
    for (let index = 0; index < CHAT.burst; index += 1) {
      expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(200);
    }
    expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(429);
    fixture.clock.set(new Date(fixture.clock.now().getTime() + CHAT.windowSeconds * 1000 + 1));
    expect((await send(0, fixture.playerIds[1]!)).statusCode).toBe(200);
  });

  it('clears player DM history at season rollover while preserving the operator archive', async () => {
    const sent = await send(0, fixture.playerIds[1]!, 'Season secret');
    expect(sent.statusCode).toBe(200);
    await forceSeasonEnd({ db: fixture.db, clock: fixture.clock }, fixture.seasonId);
    const frozenThread = conversationResult.parse((await app.inject({ method: 'GET', url: '/api/dm/conversations', headers: auth[0] })).json()).conversations[0];
    expect(frozenThread).toMatchObject({ canSend: false, unavailableReason: 'SEASON_ENDED' });
    expect(pageResult.parse((await app.inject({ method: 'GET', url: `/api/dm/conversations/${postResult.parse(sent.json()).conversationId}/messages`, headers: auth[0] })).json()).canSend).toBe(false);
    await wipeAllServers(fixture.db, fixture.clock, { count: 1, capacity: 4 });
    expect(await fixture.db.select().from(dmConversations)).toHaveLength(0);
    expect(await fixture.db.select().from(dmMessages)).toHaveLength(0);
    expect(await fixture.db.select().from(dmArchive)).toMatchObject([{
      senderAccountId: fixture.accountIds[0], recipientAccountId: fixture.accountIds[1], content: 'Season secret',
    }]);
    const [recipient] = await fixture.db.select().from(accounts).where(eq(accounts.id, fixture.accountIds[1]!));
    await deleteAccount(fixture.db, fixture.clock, recipient!.username);
    expect(await fixture.db.select().from(dmArchive)).toHaveLength(0);
  });
});
