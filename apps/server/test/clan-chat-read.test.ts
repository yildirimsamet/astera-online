import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import { clanMemberships, requestLog, seasons } from '../src/db/schema.js';
import { acceptClanRequest, applyToClan, clanActor, createClan, readClanBadge } from '../src/services/clan.js';
import { postClanChat } from '../src/services/clanChat.js';
import { grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE CLAN CHAT READ MARKER, WITHOUT A RECEIPT. Scaling plan F1.8 (Q16).
 *
 * Every mark was a write transaction that locked the commander and filed an
 * idempotency receipt with its reply — the most frequent row in `request_log`.
 * The cursor only ever moves forward, so a repeated or late mark is already safe
 * without one: it is one conditional update, and a mark that moves nothing writes
 * nothing.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: BuiltApp;
let clanId: string;

beforeEach(async () => {
  f = await seedWorld(2, 114114);
  await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 120_000, 60_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  const leader = await clanActor(f.db, f.accountIds[0]!);
  clanId = (await f.db.transaction(tx => createClan(tx, { actor: leader, name: 'Orion Guard', tag: 'og',
    description: 'One horizon.', recruiting: true, clock: f.clock }))).clanId;
  const application = await f.db.transaction(async tx => applyToClan(tx,
    { actor: await clanActor(tx, f.accountIds[1]!), clanId, now: f.clock.now() }));
  await f.db.transaction(tx => acceptClanRequest(tx, { actor: leader, requestId: application.requestId,
    acknowledgeHostile: false, now: f.clock.now() }));
  built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
  await built.app.ready();
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

const post = async (content: string) => {
  const message = await f.db.transaction(tx => postClanChat(tx, { playerId: f.playerIds[0]!, content, clock: f.clock }));
  f.clock.advance(1_000);
  return message;
};
const mark = async (messageId: string, key?: string) => built.app.inject({ method: 'POST', url: '/api/clan/chat/read',
  headers: { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[1]!)}`,
    ...(key === undefined ? {} : { 'idempotency-key': key }) },
  payload: { messageId } });
const cursor = async () => (await f.db.execute<{ at: Date | null; version: string }>(sql`select last_chat_read_at as at,
    xmin::text as version from ${clanMemberships}
  where ${clanMemberships.playerId} = ${f.playerIds[1]!} and ${clanMemberships.leftAt} is null`))[0]!;
const unread = async () => (await readClanBadge(f.db, f.accountIds[1]!, f.clock.now())).clanChatUnread;

it('moves the cursor forward and never back', async () => {
  const older = await post('Rally at the rim.');
  const newer = await post('Hold the line.');
  expect(await unread()).toBe(2);

  const marked = await mark(newer.id);
  expect(marked.statusCode).toBe(200);
  expect(marked.json()).toEqual({ readAt: new Date(newer.createdAt).toISOString() });
  expect(await unread()).toBe(0);

  const late = await mark(older.id);
  expect(late.statusCode).toBe(200);
  expect(late.json()).toEqual({ readAt: new Date(newer.createdAt).toISOString() });
  expect(await unread()).toBe(0);
});

it('writes once when the same mark comes twice, and files no receipt', async () => {
  const message = await post('Rally at the rim.');
  expect((await mark(message.id, 'one')).statusCode).toBe(200);
  const first = await cursor();
  expect((await mark(message.id, 'two')).statusCode).toBe(200);
  expect((await mark(message.id)).statusCode).toBe(200);
  expect(await cursor()).toEqual(first);
  expect(await f.db.select().from(requestLog).where(and(eq(requestLog.playerId, f.playerIds[1]!),
    eq(requestLog.operation, 'clan.chat.read')))).toEqual([]);
});

it('keeps refusing a message the commander cannot see, and a commander out of the clan', async () => {
  const message = await post('Rally at the rim.');
  expect((await mark('00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
  await f.db.update(clanMemberships).set({ leftAt: f.clock.now() }).where(eq(clanMemberships.playerId, f.playerIds[1]!));
  const outside = await mark(message.id);
  expect(outside.statusCode).toBe(403);
  expect(outside.json()).toMatchObject({ error: 'NOT_IN_CLAN' });
});
