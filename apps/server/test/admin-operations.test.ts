import { randomUUID } from 'node:crypto';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { accounts, botProfiles, chatMessages, clanMemberships, clanMessages, clans, miningRuns, pirateRaids, planets, players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { assertChatAllowed, setChatMute } from '../src/services/chatModeration.js';
import { createSeason } from '../src/services/season.js';

describe('admin operations and channel moderation', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];
  let clanId: string;
  let otherClanId: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    await f.db.update(accounts).set({ username: 'operator', displayName: 'Operator' }).where(eq(accounts.id, f.accountIds[0]!));
    await f.db.update(accounts).set({ username: 'player1' }).where(eq(accounts.id, f.accountIds[1]!));
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: 'operator' }), logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close;
    await app.ready();
    auth = await Promise.all(f.accountIds.map(async (id) => ({ authorization: `Bearer ${await app.tokens.issueAccess(id)}` })));
    const rows = await f.db.insert(clans).values([
      { seasonId: f.seasonId, name: 'Orion', nameKey: 'orion', tag: 'ORI', createdAt: f.clock.now() },
      { seasonId: f.seasonId, name: 'Lyra', nameKey: 'lyra', tag: 'LYR', createdAt: f.clock.now() },
    ]).returning();
    clanId = rows[0]!.id; otherClanId = rows[1]!.id;
    await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId, playerId: f.playerIds[1]!, role: 'LEADER', slot: 0,
      joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { await (await testDb()).close(); });

  const request = (options: InjectOptions, who = 0) => app.inject({ ...options, headers: { ...auth[who], ...options.headers } });
  const mute = (channels: string[], duration = '5m') => request({ method: 'POST', url: '/api/admin/chat/mute',
    payload: { username: 'player1', channels, duration } });
  const general = () => request({ method: 'POST', url: '/api/chat/messages', payload: { content: 'general' } }, 1);
  const clan = () => request({ method: 'POST', url: '/api/clan/chat/messages', headers: { ...auth[1], 'idempotency-key': randomUUID() }, payload: { content: 'clan' } }, 1);
  const dm = () => request({ method: 'POST', url: '/api/dm/messages', payload: { recipientPlayerId: f.playerIds[2], content: 'dm' } }, 1);

  it('requires authenticated allowlisted authority on every endpoint', async () => {
    const endpoints: InjectOptions[] = [
      { method: 'GET', url: '/api/admin/players' },
      { method: 'GET', url: '/api/admin/clans' },
      { method: 'GET', url: `/api/admin/clans/${clanId}/chat` },
      { method: 'POST', url: `/api/admin/clans/${clanId}/chat`, payload: { content: 'forged' } },
      { method: 'POST', url: '/api/admin/chat/mute', payload: { username: 'player1', channels: ['general'], duration: '5m' } },
      { method: 'POST', url: '/api/admin/chat/mask', payload: { username: 'player1', channel: 'general', language: 'tr', count: 2, seasonId: f.seasonId } },
    ];
    await f.db.update(accounts).set({ displayName: 'operator' }).where(eq(accounts.id, f.accountIds[2]!));
    for (const endpoint of endpoints) {
      expect((await app.inject(endpoint)).statusCode).toBe(401);
      expect((await request(endpoint, 2)).statusCode).toBe(403);
    }
  });

  it.each(['general', 'clan', 'dm'] as const)('enforces only the selected %s mute and expires at the exact boundary', async (channel) => {
    expect((await mute([channel])).statusCode).toBe(200);
    const send = { general, clan, dm };
    for (const [name, post] of Object.entries(send)) {
      const response = await post();
      expect(response.statusCode).toBe(name === channel ? 403 : 200);
      if (name === channel) expect(response.json<{ error: string }>().error).toBe('CHAT_MUTED');
    }
    f.clock.advance(5);
    expect((await send[channel]()).statusCode).toBe(200);
  });

  it('supports all durations, permanent mute, partial removal and persists across app instances', async () => {
    for (const [duration, minutes] of [['5m', 5], ['15m', 15], ['1h', 60], ['4h', 240], ['1d', 1440]] as const) {
      const response = await mute(['general'], duration);
      expect(response.statusCode).toBe(200);
      expect(response.json<{ expiresAt: string }>().expiresAt).toBe(new Date(f.clock.now().getTime() + minutes * 60_000).toISOString());
    }
    expect((await mute(['general', 'clan', 'dm'], 'permanent')).statusCode).toBe(200);
    await close();
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: 'operator' }), logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close; await app.ready();
    f.clock.advance(2 * 24 * 60);
    expect((await general()).statusCode).toBe(403);
    expect((await mute(['general'], 'remove')).statusCode).toBe(200);
    expect((await general()).statusCode).toBe(200);
    expect((await clan()).statusCode).toBe(403);
    expect((await dm()).statusCode).toBe(403);
  });

  it('validates usernames, channel choices, duration and mask bounds without changing chat', async () => {
    for (const payload of [
      { username: 'player1', channels: [], duration: '5m' },
      { username: 'player1', channels: ['general', 'general'], duration: '5m' },
      { username: 'player1', channels: ['general'], duration: '3m' },
      { username: 'player1', channels: ['general'], duration: '5m', isAdmin: true },
    ]) expect((await request({ method: 'POST', url: '/api/admin/chat/mute', payload })).statusCode).toBe(400);
    expect((await request({ method: 'POST', url: '/api/admin/chat/mute', payload: { username: 'missing', channels: ['general'], duration: '5m' } })).statusCode).toBe(404);
    for (const count of [0, -1, 501, 1.5]) expect((await request({ method: 'POST', url: '/api/admin/chat/mask',
      payload: { username: 'player1', channel: 'general', language: 'tr', seasonId: f.seasonId, count } })).statusCode).toBe(400);
    expect((await general()).statusCode).toBe(200);
  });

  it('serializes a sender waiting on a concurrent mute and reads the committed restriction', async () => {
    let locked = () => { /* assigned before the transaction starts */ };
    const ready = new Promise<void>(resolve => { locked = resolve; });
    let release = () => { /* assigned before the transaction starts */ };
    const hold = new Promise<void>(resolve => { release = resolve; });
    const writer = f.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chat-moderation:${f.accountIds[1]!}`}, 0))`);
      locked(); await hold;
      await tx.execute(sql`INSERT INTO chat_mutes(account_id, channel, expires_at, created_at, actor_account_id)
        VALUES (${f.accountIds[1]!}::uuid, 'general', null, ${f.clock.now().toISOString()}::timestamptz, ${f.accountIds[0]!}::uuid)`);
    });
    await ready;
    const sender = f.db.transaction(tx => assertChatAllowed(tx, f.accountIds[1]!, 'general', f.clock));
    const result = expect(sender).rejects.toMatchObject({ code: 'CHAT_MUTED' });
    release(); await writer; await result;
  });

  async function waitForChatLock(hashFunction = 'hashtextextended'): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const waiting = await f.db.execute(sql`SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event = 'advisory'
          AND query LIKE ${`%pg_advisory_xact_lock%${hashFunction}%`}`);
      if (waiting.length > 0) return;
      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
    throw new Error('The request did not reach the expected moderation lock');
  }

  async function holdModerationLock() {
    let release = () => { /* assigned by promise */ };
    let acquired = () => { /* assigned by promise */ };
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const transaction = f.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chat-moderation:${f.accountIds[1]!}`}, 0))`);
      acquired(); await held;
    });
    await ready;
    return { release, transaction };
  }

  it.each(['general', 'clan', 'dm'] as const)('checks %s expiry after waiting for a concurrent moderation lock', async channel => {
    expect((await mute([channel])).statusCode).toBe(200);
    const held = await holdModerationLock();
    const sending = { general, clan, dm }[channel]().then(response => response);
    try {
      await waitForChatLock();
      f.clock.advance(5);
    } finally { held.release(); await held.transaction; }
    expect((await sending).statusCode).toBe(200);
  });

  it('starts the selected mute duration when its waiting mutation acquires the lock', async () => {
    const held = await holdModerationLock();
    const saving = mute(['general']).then(response => response);
    try {
      await waitForChatLock();
      f.clock.advance(10);
    } finally { held.release(); await held.transaction; }
    const result = await saving;
    expect(result.statusCode).toBe(200);
    expect(result.json<{ expiresAt: string }>().expiresAt).toBe(new Date(f.clock.now().getTime() + 5 * 60_000).toISOString());
  });

  it('retains account mutes if a seasonal player identity changes', async () => {
    await setChatMute(f.db, f.accountIds[0]!, { username: 'player1', channels: ['general'], duration: 'permanent' }, f.clock);
    await f.db.update(players).set({ name: 'Changed seasonal name' }).where(eq(players.id, f.playerIds[1]!));
    expect((await general()).statusCode).toBe(403);
  });

  it('masks exactly the selected author and language, including reply previews, and keeps private originals', async () => {
    const at = f.clock.now();
    const messages = await f.db.insert(chatMessages).values([
      ...['first', 'second', 'third'].map((content, i) => ({ seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'tr' as const, content, createdAt: new Date(at.getTime() + i) })),
      { seasonId: f.seasonId, authorPlayerId: f.playerIds[1]!, language: 'en', content: 'English', createdAt: at },
      { seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, language: 'tr', content: 'Someone else', createdAt: at },
    ]).returning();
    await f.db.insert(chatMessages).values({ seasonId: f.seasonId, authorPlayerId: f.playerIds[2]!, language: 'tr', content: 'Reply', replyToMessageId: messages[2]!.id, createdAt: new Date(at.getTime() + 3) });
    const payload = { username: 'player1', channel: 'general', language: 'tr', count: 2, seasonId: f.seasonId };
    const response = await request({ method: 'POST', url: '/api/admin/chat/mask', payload });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ masked: number }>().masked).toBe(2);
    const read = await request({ method: 'GET', url: '/api/chat/messages?language=tr' }, 2);
    const rows = read.json<{ messages: { content: string; replyTo: { content: string } | null }[] }>().messages;
    expect(rows.map(row => row.content)).toEqual(expect.arrayContaining(['first', '**', 'Someone else', 'Reply']));
    expect(rows.find(row => row.content === 'Reply')?.replyTo?.content).toBe('**');
    const english = await f.db.select().from(chatMessages).where(eq(chatMessages.id, messages[3]!.id));
    expect(english[0]?.content).toBe('English');
    const audit = await f.db.execute<{ details: { messages: { content: string }[] } }>(sql`SELECT details FROM admin_actions WHERE action = 'CHAT_MASK'`);
    expect(audit[0]?.details.messages.map(row => row.content)).toEqual(['third', 'second']);
    expect((await request({ method: 'POST', url: '/api/admin/chat/mask', payload })).json<{ masked: number }>().masked).toBe(0);
  });

  it('reads and writes selected clans without membership and never crosses clan reply/cursor boundaries', async () => {
    const [older] = await f.db.insert(clanMessages).values({ seasonId: f.seasonId, clanId, authorPlayerId: f.playerIds[1]!, content: 'Before membership', createdAt: new Date(f.clock.now().getTime() - 60_000) }).returning();
    const list = await request({ method: 'GET', url: '/api/admin/clans' });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ clans: { id: string }[] }>().clans.map(row => row.id)).toEqual(expect.arrayContaining([clanId, otherClanId]));
    const read = await request({ method: 'GET', url: `/api/admin/clans/${clanId}/chat` });
    expect(read.statusCode).toBe(200);
    expect(read.json<{ messages: { content: string }[] }>().messages[0]?.content).toBe('Before membership');
    expect((await request({ method: 'GET', url: `/api/admin/clans/${otherClanId}/chat?before=${older!.id}` })).statusCode).toBe(400);
    expect((await request({ method: 'POST', url: `/api/admin/clans/${otherClanId}/chat`, payload: { content: 'bad reply', replyToMessageId: older!.id } })).statusCode).toBe(404);
    const sent = await request({ method: 'POST', url: `/api/admin/clans/${clanId}/chat`, payload: { content: 'Operator message' } });
    expect(sent.statusCode).toBe(200);
    expect(sent.json<{ message: { username: string; admin: boolean } }>().message).toMatchObject({ username: 'Operator', admin: true });
    const memberRead = await request({ method: 'GET', url: '/api/clan/chat' }, 1);
    expect(memberRead.json<{ messages: { content: string }[] }>().messages.map(row => row.content)).toEqual(['Operator message']);
    // The previously published client requires this field, even for hidden authors.
    const legacyPage = z.object({ messages: z.array(z.object({ planetId: z.string() })) }).parse(memberRead.json());
    expect(legacyPage.messages[0]?.planetId).toBe('');
    expect(await f.db.select().from(clanMemberships).where(eq(clanMemberships.playerId, f.playerIds[0]!))).toHaveLength(0);
    expect((await request({ method: 'GET', url: '/api/clan/chat' })).statusCode).toBe(403);
  });

  it('posts into the selected clan galaxy while keeping the admin in its original galaxy', async () => {
    const other = await createSeason(f.db, { shardCode: 'other-review-galaxy', seed: 9123,
      startsAt: f.clock.now(), playerCap: 3, rulesetVersion: 4 });
    await f.db.update(clans).set({ seasonId: other.season.id }).where(eq(clans.id, otherClanId));
    const scopes = await request({ method: 'GET', url: '/api/admin/clans' });
    expect(scopes.json<{ clans: { id: string; seasonId: string }[] }>().clans.find(row => row.id === otherClanId)?.seasonId).toBe(other.season.id);
    const sent = await request({ method: 'POST', url: `/api/admin/clans/${otherClanId}/chat`, payload: { content: 'Cross-galaxy operator' } });
    expect(sent.statusCode).toBe(200);
    const [stored] = await f.db.select().from(clanMessages).where(eq(clanMessages.clanId, otherClanId));
    expect(stored).toMatchObject({ seasonId: other.season.id, authorPlayerId: f.playerIds[0]!, content: 'Cross-galaxy operator' });
    const read = await request({ method: 'GET', url: `/api/admin/clans/${otherClanId}/chat` });
    expect(read.json<{ messages: { content: string }[] }>().messages.map(row => row.content)).toEqual(['Cross-galaxy operator']);
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.seasonId).toBe(f.seasonId);
    expect((await request({ method: 'GET', url: `/api/admin/clans/${otherClanId}/chat` }, 1)).statusCode).toBe(403);
  });

  it('isolates clan masking from every other room and handles equal message timestamps deterministically', async () => {
    const at = f.clock.now();
    const rows = await f.db.insert(clanMessages).values([
      { seasonId: f.seasonId, clanId, authorPlayerId: f.playerIds[1]!, content: 'One', createdAt: at },
      { seasonId: f.seasonId, clanId, authorPlayerId: f.playerIds[1]!, content: 'Two', createdAt: at },
      { seasonId: f.seasonId, clanId: otherClanId, authorPlayerId: f.playerIds[1]!, content: 'Other clan', createdAt: at },
    ]).returning();
    const response = await request({ method: 'POST', url: '/api/admin/chat/mask', payload: { username: 'player1', channel: 'clan', clanId, count: 1 } });
    expect(response.statusCode).toBe(200);
    const expected = rows.slice(0, 2).sort((a,b) => b.id.localeCompare(a.id))[0]!;
    expect((await f.db.select().from(clanMessages).where(eq(clanMessages.id, expected.id)))[0]?.content).toBe('**');
    expect((await f.db.select().from(clanMessages).where(eq(clanMessages.id, rows[2]!.id)))[0]?.content).toBe('Other clan');
  });

  it.each([false, true])('refreshes a reply after a concurrent clan mask commits (admin send: %s)', async admin => {
    const [source] = await f.db.insert(clanMessages).values({ seasonId: f.seasonId, clanId,
      authorPlayerId: f.playerIds[1]!, content: 'Moderated original', createdAt: f.clock.now() }).returning();
    let release = () => { /* assigned before transaction */ };
    let acquired = () => { /* assigned before transaction */ };
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    // The moderation writer uses the same room lock/update/commit as masking.
    const masking = f.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-chat:${clanId}`}))`);
      await tx.update(clanMessages).set({ content: '**' }).where(eq(clanMessages.id, source!.id));
      acquired(); await held;
    });
    await ready;
    const posting = request({ method: 'POST', url: admin ? `/api/admin/clans/${clanId}/chat` : '/api/clan/chat/messages',
      headers: { ...auth[admin ? 0 : 1], 'idempotency-key': randomUUID() },
      payload: { content: 'A reply', replyToMessageId: source!.id } }, admin ? 0 : 1).then(response => response);
    try { await waitForChatLock('hashtext('); }
    finally { release(); await masking; }
    const response = await posting;
    expect(response.statusCode).toBe(200);
    expect(response.json<{ message: { replyTo: { content: string } } }>().message.replyTo.content).toBe('**');
  });

  it('returns online players, current resources without writes, and owner-attributed 24h dispatches', async () => {
    await f.db.update(players).set({ lastActiveAt: new Date(f.clock.now().getTime() - 5 * 60_000 - 1) }).where(eq(players.id, f.playerIds[2]!));
    const now = f.clock.now();
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    for (const [targetKind, craft, departAt] of [['asteroid', 3, cutoff], ['asteroid', 5, now], ['asteroid', 99, new Date(cutoff.getTime() - 1)], ['debris', 10, now]] as const) {
      if (targetKind === 'debris') continue;
      await f.db.insert(miningRuns).values({ seasonId: f.seasonId, planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[1]!, targetKind, craft, asteroidIndex: 0, holdEach: 100, departAt, arriveAt: now, status: 'done', interceptX: 0, interceptY: 0, interceptZ: 0 });
    }
    await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[1]!, pirateIndex: 0, fleet: { DART: 7 }, departAt: cutoff, arriveAt: now, status: 'done', interceptX: 0, interceptY: 0, interceptZ: 0 });
    const before = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!)))[0]!;
    f.clock.advance(1);
    // Keep the cutoff launch in the requested 24h window after advancing production.
    f.clock.set(now);
    const response = await request({ method: 'GET', url: '/api/admin/players' });
    expect(response.statusCode).toBe(200);
    const page = response.json<{ total: number; players: { playerId: string; resources: { storage: { alloy: number }; buffer: { alloy: number } }; activity: { asteroidDispatches: number; minersSent: number; pirateDispatches: number; pirateShipsSent: number } }[] }>();
    expect(page.total).toBe(2);
    expect(page.players.map(row => row.playerId)).not.toContain(f.playerIds[2]);
    const target = page.players.find(row => row.playerId === f.playerIds[1]);
    expect(target?.resources.storage.alloy).toBe(before.alloy);
    expect(target?.activity).toEqual({ asteroidDispatches: 2, minersSent: 8, pirateDispatches: 1, pirateShipsSent: 7 });
    const after = (await f.db.select().from(planets).where(and(eq(planets.id, f.planetIds[1]!), eq(planets.controllerPlayerId, f.playerIds[1]!))))[0]!;
    expect(after).toEqual(before);
  });

  it('counts online players across galaxies independently of page size and cursor', async () => {
    const otherSeason = await createSeason(f.db, { shardCode: 'online-count-galaxy', seed: 87,
      startsAt: f.clock.now(), playerCap: 3, rulesetVersion: 4 });
    await f.db.update(players).set({ seasonId: otherSeason.season.id }).where(eq(players.id, f.playerIds[2]!));
    const first = await request({ method: 'GET', url: '/api/admin/players?limit=1' });
    expect(first.statusCode).toBe(200);
    const firstPage = first.json<{ total: number; nextBefore: string; players: { playerId: string }[] }>();
    expect(firstPage.total).toBe(3);
    expect(firstPage.players).toHaveLength(1);
    const next = await request({ method: 'GET', url: `/api/admin/players?limit=1&before=${firstPage.nextBefore}` });
    expect(next.json<{ total: number }>().total).toBe(3);
    const beyond = await request({ method: 'GET', url: '/api/admin/players?before=ffffffff-ffff-4fff-bfff-ffffffffffff' });
    expect(beyond.json()).toMatchObject({ total: 3, players: [], nextBefore: null });
  });

  it('counts only human online players and includes the exact activity boundary', async () => {
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[2]!, ordinal: 0, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    const boundary = new Date(f.clock.now().getTime() - 5 * 60_000);
    await f.db.update(players).set({ lastActiveAt: boundary }).where(eq(players.id, f.playerIds[1]!));
    const first = await request({ method: 'GET', url: '/api/admin/players' });
    expect(first.json<{ total: number }>().total).toBe(2);
    await f.db.update(players).set({ lastActiveAt: new Date(boundary.getTime() - 1) }).where(eq(players.id, f.playerIds[1]!));
    const next = await request({ method: 'GET', url: '/api/admin/players' });
    expect(next.json<{ total: number }>().total).toBe(1);
    await f.db.update(players).set({ lastActiveAt: new Date(boundary.getTime() - 1) }).where(eq(players.id, f.playerIds[0]!));
    const empty = await request({ method: 'GET', url: '/api/admin/players' });
    expect(empty.json()).toMatchObject({ total: 0, players: [], nextBefore: null });
  });
});
