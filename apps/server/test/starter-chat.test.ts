import { CHAT } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chatPageSchema, chatPostSchema } from '../../web/src/api/schemas.js';
import { communityBlocks, contentReports, starterChatMessages, starterGalaxies, vessels } from '../src/db/schema.js';
import { resolveContentReport } from '../src/services/contentReports.js';
import { setChatMute } from '../src/services/chatModeration.js';
import { testDb } from './helpers.js';
import { TOKENS, bearer, starterWorld } from './starterFixture.js';
import { aboard, get, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const TALK = { REFINERY: 2, SURVEY: 2 };

describe('the channel of a ship galaxy', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const say = (who: { headers: Record<string, string> }, content: string, language = 'en') => post(world, '/api/starter/chat/messages', who.headers, { content, language });
  const read = async (who: { headers: Record<string, string> }, language = 'en') => chatPageSchema.parse(await get(world, `/api/starter/chat/messages?language=${language}`, who.headers));

  it('opens with the second antenna, and the lock is on the server', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1 });
    const answer = await say(me, 'hello');
    expect(answer.statusCode).toBe(403);
    expect(answer.json<{ error: string }>().error).toBe('FEATURE_LOCKED');
  });

  it('carries a message to a neighbour, in the shape the chat screen reads', async () => {
    const me = await aboard(world, 'Me', TALK);
    const other = await aboard(world, 'Other', TALK);
    const sent = await say(me, 'hello out there');
    expect(sent.statusCode).toBe(200);
    expect(chatPostSchema.parse(sent.json()).message).toMatchObject({ content: 'hello out there', self: true, username: 'Me' });
    const { messages } = await read(other);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ content: 'hello out there', self: false, username: 'Me' });
  });

  it('keeps languages apart, as the main channel does', async () => {
    const me = await aboard(world, 'Me', TALK);
    await say(me, 'merhaba', 'tr');
    expect((await read(me, 'en')).messages).toHaveLength(0);
    expect((await read(me, 'tr')).messages).toHaveLength(1);
  });

  it('stays in its own galaxy, and out of the main game', async () => {
    const me = await aboard(world, 'Me', TALK);
    const other = await aboard(world, 'Other', TALK);
    const [second] = await world.f.db.insert(starterGalaxies).values({ shardId: (await world.f.db.select().from(starterGalaxies))[0]!.shardId, ordinal: 2, seed: 7, epoch: world.f.clock.now(), capacity: 30 }).returning();
    await world.f.db.update(vessels).set({ starterGalaxyId: second!.id }).where(eq(vessels.id, other.vesselId));
    await say(me, 'only here');
    expect((await read(other)).messages).toHaveLength(0);
    const main = await world.app.inject({ url: '/api/chat/messages?language=en', headers: bearer(await TOKENS.issueAccess(world.f.accountIds[0]!)) });
    expect(JSON.stringify(main.json())).not.toContain('only here');
  });

  it('refuses what the main channel refuses: filth, and a flood', async () => {
    const me = await aboard(world, 'Me', TALK);
    const filth = await say(me, 'amk');
    expect(filth.statusCode).toBeGreaterThanOrEqual(400);
    for (let i = 0; i < CHAT.burst; i++) expect((await say(me, `line ${String(i)}`)).statusCode).toBe(200);
    const flood = await say(me, 'one more');
    expect(flood.statusCode).toBe(429);
    expect(flood.json<{ error: string }>().error).toBe('CHAT_RATE_LIMIT');
  });

  it('honours a moderator\'s mute', async () => {
    const me = await aboard(world, 'Me', TALK);
    await setChatMute(world.f.db, world.f.accountIds[0]!, { username: me.username, channels: ['general'], duration: 'permanent' }, world.f.clock);
    const muted = await say(me, 'anyone?');
    expect(muted.statusCode).toBe(403);
    expect(muted.json<{ error: string }>().error).toBe('CHAT_MUTED');
  });

  it('hides each from the other once one has blocked', async () => {
    const me = await aboard(world, 'Me', TALK);
    const other = await aboard(world, 'Other', TALK);
    await say(other, 'hello');
    await world.f.db.insert(communityBlocks).values({ blockerAccountId: me.id, targetAccountId: other.id, createdAt: world.f.clock.now() });
    expect((await read(me)).messages).toHaveLength(0);
  });

  it('counts what has not been read, and stops once it has', async () => {
    const me = await aboard(world, 'Me', TALK);
    const other = await aboard(world, 'Other', TALK);
    const { message } = chatPostSchema.parse((await say(other, 'hi')).json());
    expect(await get(world, '/api/starter/chat/unread?language=en', me.headers)).toEqual({ count: 1 });
    expect(await get(world, '/api/starter/chat/unread?language=en', other.headers)).toEqual({ count: 0 });
    const marked = await post(world, '/api/starter/chat/read', me.headers, { messageId: message.id, language: 'en' });
    expect(marked.json<{ ok: boolean }>().ok).toBe(true);
    expect(await get(world, '/api/starter/chat/unread?language=en', me.headers)).toEqual({ count: 0 });
  });

  it('takes a report to the same queue, and the decision masks the words', async () => {
    const me = await aboard(world, 'Me', TALK);
    const other = await aboard(world, 'Other', TALK);
    const { message } = chatPostSchema.parse((await say(other, 'bad words')).json());
    const body = { kind: 'message', channel: 'general', messageId: message.id, reason: 'HARASSMENT', details: '' };
    expect((await post(world, '/api/starter/chat/report', me.headers, body)).statusCode).toBe(200);
    expect((await post(world, '/api/starter/chat/report', me.headers, body)).statusCode).toBe(200);
    const rows = await world.f.db.select().from(contentReports);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.evidence).toMatchObject({ username: 'Other', content: 'bad words' });
    await resolveContentReport(world.f.db, world.f.clock, rows[0]!.id, 'MASK', world.f.accountIds[0]!);
    const [row] = await world.f.db.select().from(starterChatMessages).where(eq(starterChatMessages.id, message.id));
    expect(row!.maskedAt).not.toBeNull();
    expect((await read(me)).messages[0]?.content).toBe('**');
  });

  it('will not take a report of one\'s own words', async () => {
    const me = await aboard(world, 'Me', TALK);
    const { message } = chatPostSchema.parse((await say(me, 'mine')).json());
    const answer = await post(world, '/api/starter/chat/report', me.headers, { kind: 'message', channel: 'general', messageId: message.id, reason: 'SPAM', details: '' });
    expect(answer.statusCode).toBe(400);
  });

  it('blocks the author of a line by ship, both ways, in this galaxy only', async () => {
    const me = await aboard(world, 'Me', TALK);
    const them = await aboard(world, 'Them', TALK);
    await say(them, 'hello');
    await say(me, 'hi');
    expect((await post(world, '/api/starter/chat/block', me.headers, { targetPlayerId: me.vesselId })).statusCode).toBe(400);
    expect((await post(world, '/api/starter/chat/block', me.headers, { targetPlayerId: crypto.randomUUID() })).statusCode).toBe(404);
    expect((await post(world, '/api/starter/chat/block', me.headers, { targetPlayerId: them.vesselId })).json()).toEqual({ blocked: true });
    expect((await read(me)).messages.map(line => line.content)).toEqual(['hi']);
    expect((await read(them)).messages.map(line => line.content)).toEqual(['hello']);
  });
});
