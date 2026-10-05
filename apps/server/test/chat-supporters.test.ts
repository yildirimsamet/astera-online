import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, clanMemberships, clans, cosmeticEntitlements, players, seasonCycles, seasons } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const badgeId = 'badge-supporter';
const posted = z.object({ message: z.object({ supporter: z.boolean().optional(), admin: z.boolean().optional() }), conversationId: z.string().optional() });
const history = z.object({ messages: z.array(z.object({ supporter: z.boolean().optional() })) });

describe('manually assigned permanent chat supporters', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];
  let username: string;

  beforeEach(async () => {
    f = await seedWorld(2, 8320);
    const rows = await f.db.select().from(accounts);
    username = rows.find((row) => row.id === f.accountIds[1])!.username;
    const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }),
      env: testEnv({ ADMIN_USERNAMES: rows.find((row) => row.id === f.accountIds[0])!.username }) });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = await Promise.all(f.accountIds.map(async (id) => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const set = (supporter: boolean, name = username) => app.inject({ method: 'POST', url: '/api/admin/supporters',
    headers: auth[0], payload: { username: name, supporter } });
  const rights = () => f.db.select().from(cosmeticEntitlements).where(and(
    eq(cosmeticEntitlements.accountId, f.accountIds[1]!), eq(cosmeticEntitlements.cosmeticId, badgeId),
  ));

  it('requires admin authorization and rejects malformed or authority-forging bodies', async () => {
    const payload = { username, supporter: true };
    expect((await app.inject({ method: 'POST', url: '/api/admin/supporters', payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/admin/supporters', headers: auth[1], payload })).statusCode).toBe(403);
    for (const invalid of [{ username }, { username, supporter: 'true' }, { ...payload, admin: true }, { ...payload, username: '' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/supporters', headers: auth[0], payload: invalid })).statusCode).toBe(400);
    }
    expect(await rights()).toHaveLength(0);
  });

  it('reports an unknown account without granting a right', async () => {
    const response = await set(true, 'NobodyExists');
    expect(response.statusCode, response.body).toBe(404);
    expect(response.json()).toMatchObject({ error: 'ACCOUNT_NOT_FOUND' });
    expect(await rights()).toHaveLength(0);
  });

  it('case-folds the username and stores the manual right on the account, without admin authority or skin ownership', async () => {
    const response = await set(true, username.toUpperCase());
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ accountId: f.accountIds[1], supporter: true });
    expect(await rights()).toEqual([expect.objectContaining({ accountId: f.accountIds[1],
      source: 'MANUAL', grantedByAccountId: f.accountIds[0], revokedAt: null })]);
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: auth[1] })).json()).toMatchObject({ ownedSkinIds: [] });
    expect((await app.inject({ method: 'POST', url: `/api/skins/planets/${f.planetIds[1]}`, headers: auth[1],
      payload: { skinId: badgeId } })).statusCode).toBe(400);
    const result = await app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[1], payload: { content: 'Thank you' } });
    expect(posted.parse(result.json()).message).toMatchObject({ supporter: true, admin: false });
  });

  it('serializes concurrent grants, keeps repeat grants stable, and can revoke then regrant', async () => {
    const responses = await Promise.all([set(true), set(true)]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(responses[0].json()).toEqual(responses[1].json());
    expect(await rights()).toHaveLength(1);
    expect((await set(false)).statusCode).toBe(200);
    expect((await set(false)).statusCode).toBe(200);
    expect((await rights())[0]!.revokedAt).not.toBeNull();
    expect((await set(true)).statusCode).toBe(200);
    const ledger = await rights();
    expect(ledger).toHaveLength(2);
    expect(ledger.filter((row) => row.revokedAt === null)).toHaveLength(1);
    expect(new Set(ledger.map((row) => row.orderRef)).size).toBe(2);
  });

  it('allows a grant before an account joins a galaxy', async () => {
    const [account] = await f.db.insert(accounts).values({ username: 'offline', displayName: 'Offline', passwordHash: 'not-a-real-hash' }).returning();
    expect((await set(true, 'Offline')).json()).toMatchObject({ accountId: account!.id, supporter: true });
  });

  it('retains the account badge across a new season/player and display-name changes', async () => {
    const [account] = await f.db.insert(accounts).values({ username: 'badgewipe', displayName: 'Before', passwordHash: 'not-a-real-hash' }).returning();
    const [oldPlayer] = await f.db.insert(players).values({ accountId: account!.id, seasonId: f.seasonId, name: 'Before' }).returning();
    expect((await set(true, 'badgewipe')).statusCode).toBe(200);
    const [current] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [cycle] = await f.db.insert(seasonCycles).values({ ordinal: 2, startsAt: current!.endsAt,
      endsAt: new Date(current!.endsAt.getTime() + 86_400_000) }).returning();
    const [next] = await f.db.insert(seasons).values({ shardId: current!.shardId, cycleId: cycle!.id,
      seed: 8321, status: 'pending', startsAt: cycle!.startsAt, endsAt: cycle!.endsAt }).returning();
    await f.db.delete(players).where(eq(players.id, oldPlayer!.id));
    const [player] = await f.db.insert(players).values({ accountId: account!.id, seasonId: next!.id, name: 'Reborn' }).returning();
    await f.db.update(accounts).set({ displayName: 'Renamed' }).where(eq(accounts.id, account!.id));
    const { supporterPlayers } = await import('../src/services/supporters.js');
    expect(await supporterPlayers(f.db, [player!.id])).toEqual(new Set([player!.id]));
    expect(await supporterPlayers(f.db, [oldPlayer!.id])).toEqual(new Set());
    expect(await supporterPlayers(f.db, [])).toEqual(new Set());
  });

  it.each(['general', 'clan', 'dm'] as const)('decorates immediate posts and existing %s history, and removes revoked badges', async (channel) => {
    let postUrl = '/api/chat/messages';
    let readUrl = '/api/chat/messages';
    let payload: { content: string; recipientPlayerId?: string } = { content: 'A supporter message' };
    if (channel === 'clan') {
      const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Supporters', nameKey: 'supporters', tag: 'SUP', createdAt: f.clock.now() }).returning();
      await f.db.insert(clanMemberships).values(f.playerIds.map((playerId, slot) => ({
        seasonId: f.seasonId, clanId: clan!.id, playerId, slot, role: slot === 0 ? 'LEADER' as const : 'MEMBER' as const,
        joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now(),
      })));
      postUrl = '/api/clan/chat/messages';
      readUrl = '/api/clan/chat';
    } else if (channel === 'dm') {
      postUrl = '/api/dm/messages';
      payload = { ...payload, recipientPlayerId: f.playerIds[0]! };
    }
    expect((await set(true)).statusCode).toBe(200);
    const result = await app.inject({ method: 'POST', url: postUrl,
      headers: { ...auth[1], 'idempotency-key': `supporter-${channel}` }, payload });
    expect(result.statusCode, result.body).toBe(200);
    const post = posted.parse(result.json());
    expect(post.message.supporter).toBe(true);
    if (channel === 'dm') readUrl = `/api/dm/conversations/${post.conversationId}/messages`;
    const read = () => app.inject({ method: 'GET', url: readUrl, headers: auth[0] });
    expect(history.parse((await read()).json()).messages[0]?.supporter).toBe(true);
    expect((await set(false)).statusCode).toBe(200);
    expect(history.parse((await read()).json()).messages[0]?.supporter).not.toBe(true);
    expect((await set(true)).statusCode).toBe(200);
    expect(history.parse((await read()).json()).messages[0]?.supporter).toBe(true);
  });

  it('does not award supporter status merely because a planet skin was purchased', async () => {
    await f.db.insert(cosmeticEntitlements).values({ accountId: f.accountIds[1]!, cosmeticId: 'planet-lava', source: 'MANUAL', orderRef: 'paid-skin' });
    const result = await app.inject({ method: 'POST', url: '/api/chat/messages', headers: auth[1], payload: { content: 'A buyer' } });
    expect(posted.parse(result.json()).message.supporter).not.toBe(true);
    const active = await f.db.select().from(cosmeticEntitlements).where(isNull(cosmeticEntitlements.revokedAt));
    expect(active).toHaveLength(1);
  });
});
