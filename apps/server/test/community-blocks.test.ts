import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { MULTI_WORLD } from '@astera/rules';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import { accounts, chatMessages, clanMemberships, clanMessages, clans, dmConversations, dmMessages, messageReactions, players, seasons, securityCounters } from '../src/db/schema.js';
import { commanderRows, demolish } from '../src/services/reclaim.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture; let built: BuiltApp; let auth: { authorization: string }[];
const base = '/api/community/blocks';
beforeEach(async () => {
  f = await seedWorld(3);
  built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
  await built.app.ready(); auth = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await built.app.tokens.issueAccess(id)}` })));
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });
const block = (target = f.playerIds[1], who = 0) => built.app.inject({ method: 'POST', url: base, headers: auth[who], payload: { targetPlayerId: target } });
const get = (url: string, who = 0) => built.app.inject({ url, headers: auth[who] });
async function dm() {
  const pair = [f.playerIds[0]!, f.playerIds[1]!].sort();
  const [conversation] = await f.db.insert(dmConversations).values({ seasonId: f.seasonId, playerLowId: pair[0]!, playerHighId: pair[1]! }).returning();
  if (!conversation) throw new Error('Missing DM fixture');
  const [message] = await f.db.insert(dmMessages).values({ conversationId: conversation.id, authorPlayerId: f.playerIds[1]!, content: 'Retained private message', createdAt: f.clock.now() }).returning();
  if (!message) throw new Error('Missing DM message fixture'); return { conversation, message };
}
it('authenticates, rejects forged selectors and returns only the caller’s private block list', async () => {
  expect((await built.app.inject({ url: base })).statusCode).toBe(401);
  expect((await built.app.inject({ method: 'POST', url: base, payload: { targetPlayerId: f.playerIds[1] } })).statusCode).toBe(401);
  expect((await block(f.playerIds[0])).statusCode).toBe(400);
  expect((await block(randomUUID())).statusCode).toBe(404);
  expect((await built.app.inject({ method: 'POST', url: base, headers: auth[0], payload: { targetPlayerId: f.playerIds[1], accountId: f.accountIds[2] } })).statusCode).toBe(400);
  const result = await block(); expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect((await get(base)).json()).toMatchObject({ blocks: [{ accountId: f.accountIds[1] }] });
  expect((await get(base, 2)).json()).toEqual({ blocks: [] });
});
it('keeps one account relation and original timestamp across concurrent repeated requests', async () => {
  const results = await Promise.all([block(), block()]); expect(results.map(value => value.statusCode)).toEqual([200, 200]);
  const initial = (await get(base)).json<unknown>(); f.clock.set(new Date(f.clock.now().getTime() + 1000));
  expect((await block()).statusCode).toBe(200); expect((await get(base)).json()).toEqual(initial);
  expect(await f.db.execute(sql`select blocker_account_id, target_account_id from community_blocks`)).toEqual([{ blocker_account_id: f.accountIds[0], target_account_id: f.accountIds[1] }]);
});
it('filters general chat before pagination, including unread and quoted blocked content in both directions', async () => {
  const [hidden] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'tr', content: 'Hidden author', createdAt: f.clock.now() }).returning();
  if (!hidden) throw new Error('No message fixture');
  await f.db.insert(chatMessages).values([{ seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, language: 'tr', content: 'Visible reply', replyToMessageId: hidden.id, createdAt: new Date(f.clock.now().getTime() + 1000) }, { seasonId: f.seasonId, authorPlayerId: f.playerIds[0]!, language: 'tr', content: 'My message', createdAt: f.clock.now() }]);
  expect((await block()).statusCode).toBe(200);
  const page = (await get('/api/chat/messages?language=tr&limit=1')).json<{ messages: { content: string; replyTo: unknown }[] }>();
  expect(page.messages).toEqual([expect.objectContaining({ content: 'Visible reply', replyTo: null })]);
  expect((await get('/api/chat/unread?language=tr')).json()).toEqual({ count: 1 });
  expect((await get('/api/chat/messages?language=tr', 1)).body).not.toContain('My message');
});
it('filters clan messages and their unread badge consistently', async () => {
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion }).where(eq(seasons.id, f.seasonId));
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Block Test', nameKey: 'block test', tag: 'BLK', createdAt: f.clock.now() }).returning();
  if (!clan) throw new Error('Missing clan');
  await f.db.insert(clanMemberships).values(f.playerIds.map((playerId, slot) => ({ seasonId: f.seasonId, clanId: clan.id, playerId, slot, role: slot === 0 ? 'LEADER' as const : 'MEMBER' as const, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
  await f.db.insert(clanMessages).values([{ clanId: clan.id, seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, content: 'Hidden clan message', createdAt: f.clock.now() }, { clanId: clan.id, seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, content: 'Visible clan message', createdAt: f.clock.now() }]);
  expect((await block()).statusCode).toBe(200);
  const page = await get('/api/clan/chat'); expect(page.statusCode).toBe(200);
  expect(page.body).not.toContain('Hidden clan message'); expect(page.body).toContain('Visible clan message');
  expect((await get('/api/clan/badge')).json()).toMatchObject({ clanChatUnread: 1 });
});
it('refuses new DMs in both directions while retaining reportable history and suppressing unread harassment', async () => {
  const { conversation, message } = await dm(); expect((await block()).statusCode).toBe(200);
  for (const [who, target] of [[0, 1], [1, 0]] as const) expect((await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[who], payload: { recipientPlayerId: f.playerIds[target], content: 'Should not arrive' } })).statusCode).toBe(403);
  expect((await get(`/api/dm/conversations/${conversation.id}/messages`)).json()).toMatchObject({ messages: [{ id: message.id }], canSend: false, unavailableReason: 'BLOCKED' });
  expect((await get('/api/dm/conversations')).json()).toMatchObject({ totalUnread: 0, conversations: [{ communityBlockedByMe: true, canSend: false }] });
  expect((await get('/api/dm/unread')).json()).toEqual({ count: 0 });
  expect((await get('/api/dm/contacts?q=Tester1')).json()).toEqual({ contacts: [] });
  const receipt = await built.app.inject({ method: 'POST', url: '/api/community/reports', headers: auth[0], payload: { kind: 'message', channel: 'dm', messageId: message.id, reason: 'HARASSMENT', details: '' } }); expect(receipt.statusCode).toBe(202);
});
it('allows only an already-known cross-galaxy DM peer and preserves the account block across placement changes', async () => {
  const { season } = await createSeason(f.db, { shardCode: 'BLOCK-OTHER', seed: 91273, startsAt: f.clock.now(), playerCap: 10 });
  await f.db.update(players).set({ seasonId: season.id }).where(eq(players.id, f.playerIds[1]!));
  expect((await block()).statusCode).toBe(404); await dm(); expect((await block()).statusCode).toBe(200);
  expect((await get(base)).json()).toMatchObject({ blocks: [{ accountId: f.accountIds[1] }] });
});
it('unblocks only the caller’s relation, supports a removed placement and deletes account-linked data on erasure', async () => {
  expect((await block()).statusCode).toBe(200);
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${f.accountIds[1]}`, headers: auth[2] })).statusCode).toBe(200);
  expect((await get(base)).json()).toMatchObject({ blocks: [{ accountId: f.accountIds[1] }] });
  const [unplaced] = await f.db.insert(accounts).values({ username: 'unplacedblock', displayName: 'Unplaced Block', passwordHash: 'unused' }).returning();
  if (!unplaced) throw new Error('Missing account');
  await f.db.execute(sql`insert into community_blocks(blocker_account_id,target_account_id,created_at) values(${unplaced.id},${f.accountIds[1]},${f.clock.now().toISOString()})`);
  const headers = { authorization: `Bearer ${await built.app.tokens.issueAccess(unplaced.id)}` };
  expect((await built.app.inject({ url: base, headers })).statusCode).toBe(200);
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${f.accountIds[1]}`, headers })).statusCode).toBe(200);
  expect(await f.db.execute(sql`select target_account_id from community_blocks where blocker_account_id=${unplaced.id}`)).toHaveLength(0);
  await f.db.execute(sql`insert into community_blocks(blocker_account_id,target_account_id,created_at) values(${unplaced.id},${f.accountIds[1]},${f.clock.now().toISOString()})`);
  await f.db.delete(accounts).where(eq(accounts.id, unplaced.id));
  expect(await f.db.execute(sql`select target_account_id from community_blocks where blocker_account_id=${unplaced.id}`)).toHaveLength(0);
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${f.accountIds[1]}`, headers: auth[0] })).statusCode).toBe(200);
  expect((await get(base)).json()).toEqual({ blocks: [] });
});
it('keeps the block when a season erases the old player and the same account gets a new player id', async () => {
  expect((await block()).statusCode).toBe(200);
  await f.db.transaction(async tx => {
    const ids = [f.planetIds[1]!]; const rows = await commanderRows(tx, ids, f.playerIds[1]!);
    await demolish(tx, ids, f.playerIds[1]!, rows);
  });
  const [replacement] = await f.db.insert(players).values({ accountId: f.accountIds[1]!, seasonId: f.seasonId, name: 'Replacement commander' }).returning();
  if (!replacement) throw new Error('No replacement player'); expect(replacement.id).not.toBe(f.playerIds[1]);
  expect((await get(base)).json()).toMatchObject({ blocks: [{ accountId: f.accountIds[1] }] });
  expect((await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: replacement.id, content: 'Must still be blocked' } })).statusCode).toBe(403);
});
it('charges only new blocks and resets the shared rate budget at its exact expiry', async () => {
  expect((await block()).statusCode).toBe(200);
  await f.db.update(securityCounters).set({ count: 20 }).where(eq(securityCounters.key, `community-blocks:${f.accountIds[0]}`));
  expect((await block()).statusCode).toBe(200); expect((await block(f.playerIds[2])).statusCode).toBe(429);
  f.clock.set(new Date(f.clock.now().getTime() + 15 * 60_000)); expect((await block(f.playerIds[2])).statusCode).toBe(200);
});
it('prevents blocked users from sending reactions and omits their reactions from visible message rosters', async () => {
  const [message] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[0]!, language: 'tr', content: 'My message', createdAt: f.clock.now() }).returning();
  if (!message) throw new Error('No message');
  await f.db.insert(messageReactions).values({ chatMessageId: message.id, playerId: f.playerIds[1]!, emoji: '👍', createdAt: f.clock.now() });
  expect((await block()).statusCode).toBe(200);
  const reaction = await built.app.inject({ method: 'POST', url: '/api/chat/reactions', headers: auth[1], payload: { channel: 'general', messageId: message.id, emoji: '👏' } });
  expect(reaction.statusCode).toBe(403);
  const roster = await get(`/api/chat/reactions?channel=general&messageId=${message.id}`); expect(roster.statusCode).toBe(200); expect(roster.json()).toEqual({ participants: [] });
  expect((await get('/api/chat/messages?language=tr')).json()).toMatchObject({ messages: [{ reactions: [] }] });
});
it('prevents reactions even to one’s own retained DM in a blocked conversation', async () => {
  const { conversation, message } = await dm();
  const [own] = await f.db.insert(dmMessages).values({ conversationId: conversation.id, authorPlayerId: f.playerIds[0]!, content: 'My retained message', createdAt: f.clock.now() }).returning();
  if (!own) throw new Error('No own message'); expect((await block()).statusCode).toBe(200);
  for (const [who, id] of [[0, own.id], [1, message.id]] as const) {
    const response = await built.app.inject({ method: 'POST', url: '/api/chat/reactions', headers: auth[who], payload: { channel: 'dm', messageId: id, emoji: '👏' } });
    expect(response.statusCode).toBe(403);
  }
});
it('does not remove the separate legacy DM block when a community block is removed', async () => {
  await dm();
  expect((await built.app.inject({ method: 'POST', url: '/api/dm/blocks', headers: auth[0], payload: { targetPlayerId: f.playerIds[1] } })).statusCode).toBe(200);
  expect((await block()).statusCode).toBe(200);
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${f.accountIds[1]}`, headers: auth[0] })).statusCode).toBe(200);
  expect((await get(base)).json()).toEqual({ blocks: [] });
  expect((await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: f.playerIds[1], content: 'Still DM blocked' } })).statusCode).toBe(403);
});
it('accepts a previously visible pagination cursor after that author was blocked', async () => {
  const [cursor] = await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'tr', content: 'Now hidden cursor', createdAt: f.clock.now() }).returning();
  if (!cursor) throw new Error('No cursor');
  await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, language: 'tr', content: 'Older visible message', createdAt: new Date(f.clock.now().getTime() - 1000) });
  expect((await block()).statusCode).toBe(200);
  const result = await get(`/api/chat/messages?language=tr&before=${cursor.id}&limit=1`);
  expect(result.statusCode).toBe(200); expect(result.json()).toMatchObject({ messages: [{ content: 'Older visible message' }] });
});
it('bounds the durable list without discarding an existing block when the limit is reached', async () => {
  const targets = await f.db.insert(accounts).values(Array.from({ length: 500 }, (_, index) => ({ username: `blocklimit${index}`, displayName: `Block limit ${index}`, passwordHash: 'unused-fixture' }))).returning({ id: accounts.id });
  await f.db.execute(sql`insert into community_blocks(blocker_account_id,target_account_id,created_at) select ${f.accountIds[0]}::uuid, id, ${f.clock.now().toISOString()}::timestamptz from accounts where username like 'blocklimit%'`);
  expect((await get(base)).json<{ blocks: unknown[] }>().blocks).toHaveLength(500);
  expect((await block()).statusCode).toBe(409); const target = targets[0]; if (!target) throw new Error('No cap fixture');
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${target.id}`, headers: auth[0] })).statusCode).toBe(200);
  expect((await block()).statusCode).toBe(200); expect((await get(base)).json<{ blocks: unknown[] }>().blocks).toHaveLength(500);
});
it('rolls back the rate charge and relation when storage fails instead of reporting success', async () => {
  await f.db.execute(sql`CREATE FUNCTION community_block_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture storage failure'; END $$`);
  await f.db.execute(sql`CREATE TRIGGER community_block_test_failure BEFORE INSERT ON community_blocks FOR EACH ROW EXECUTE FUNCTION community_block_test_failure()`);
  try {
    expect((await block()).statusCode).toBe(500); expect((await get(base)).json()).toEqual({ blocks: [] });
    expect(await f.db.select().from(securityCounters).where(eq(securityCounters.key, `community-blocks:${f.accountIds[0]}`))).toHaveLength(0);
  } finally { await f.db.execute(sql`DROP TRIGGER community_block_test_failure ON community_blocks`); await f.db.execute(sql`DROP FUNCTION community_block_test_failure()`); }
});
it('serializes opposite-direction blocks with an in-flight DM and keeps either remaining block authoritative', async () => {
  const results = await Promise.all([block(), block(f.playerIds[0], 1), built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: f.playerIds[1], content: 'Concurrent message' } })]);
  expect(results.slice(0, 2).map(value => value.statusCode)).toEqual([200, 200]); expect([200, 403]).toContain(results[2].statusCode);
  expect((await built.app.inject({ method: 'DELETE', url: `${base}/${f.accountIds[1]}`, headers: auth[0] })).statusCode).toBe(200);
  expect((await get(base)).json()).toEqual({ blocks: [] });
  expect((await built.app.inject({ method: 'POST', url: '/api/dm/messages', headers: auth[0], payload: { recipientPlayerId: f.playerIds[1], content: 'Still blocked by peer' } })).statusCode).toBe(403);
});
