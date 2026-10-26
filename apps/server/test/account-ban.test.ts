import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { z } from 'zod';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { buildApp, type BuiltApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { accountDeletionRequests, accounts, adminActions, nativeSessions } from '../src/db/schema.js';
import { banAccount } from '../src/services/accountBan.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const sessionSchema = z.object({ accountId: z.string().uuid(), accessToken: z.string() });
const nativeSchema = sessionSchema.extend({ nativeSessionId: z.string().uuid(), refreshToken: z.string() });
const password = 'account-ban-test-password';
let built: BuiltApp;
let clock: FixedClock;
let target: z.infer<typeof sessionSchema>;
let other: z.infer<typeof sessionSchema>;
beforeEach(async () => {
  const { db } = await testDb();
  await truncateAll(db);
  clock = new FixedClock(new Date());
  built = buildApp({ db, clock, env: testEnv({ NATIVE_AUTH_ENABLED: 'true' }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
  const create = async (username: string) => {
    const r = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password, communityPolicyVersion: COMMUNITY_POLICY_VERSION } });
    expect(r.statusCode).toBe(200);
    return sessionSchema.parse(r.json<unknown>());
  };
  target = await create('BanTarget'); other = await create('OtherPilot');
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });
const ban = () => banAccount(built.db, { accountId: target.accountId, reason: 'Owner moderation decision', at: clock.now() });
const me = (token: string) => built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } });

describe('account access bans', () => {
  it('blocks browser/native login, current and old access, and both refresh paths without deletion', async () => {
    const web = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'BanTarget', password } });
    const setCookie = web.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    const n = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username: 'BanTarget', password } });
    const native = nativeSchema.parse(n.json<unknown>());
    await ban();
    for (const url of ['/api/auth/login', '/api/native/auth/login']) {
      expect((await built.app.inject({ method: 'POST', url, payload: { username: 'BanTarget', password } })).statusCode).toBe(401);
    }
    expect((await me(target.accessToken)).statusCode).toBe(401);
    expect((await me(native.accessToken)).statusCode).toBe(401);
    expect((await me(await built.app.tokens.issueAccess(target.accountId, 1))).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie } })).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'POST', url: '/api/native/auth/refresh', payload: {
      sessionId: native.nativeSessionId, refreshToken: native.refreshToken, nextRefreshToken: randomBytes(32).toString('base64url'),
    } })).statusCode).toBe(401);
    const [a] = await built.db.select().from(accounts).where(eq(accounts.id, target.accountId));
    expect(a?.deletionApprovedAt).toBeNull(); expect(a?.authVersion).toBe(1);
    expect(await built.db.select().from(accountDeletionRequests)).toHaveLength(0);
    const [s] = await built.db.select().from(nativeSessions).where(eq(nativeSessions.id, native.nativeSessionId));
    expect(s?.revokedAt).not.toBeNull();
  });

  it('leaves unrelated accounts usable and repeats a ban without extra revocations or audit rows', async () => {
    await ban(); await ban();
    expect((await me(other.accessToken)).statusCode).toBe(200);
    const login = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'OtherPilot', password } });
    expect(login.statusCode).toBe(200);
    const [a] = await built.db.select().from(accounts).where(eq(accounts.id, target.accountId));
    expect(a?.authVersion).toBe(1);
    expect(await built.db.select().from(adminActions).where(and(eq(adminActions.targetAccountId, target.accountId), eq(adminActions.action, 'ACCOUNT_BANNED')))).toHaveLength(1);
    expect(await built.db.select().from(accounts)).toHaveLength(2);
  });

  it('refuses unknown account IDs and does not create an unrelated ban', async () => {
    await expect(banAccount(built.db, { accountId: '00000000-0000-4000-8000-000000000001', reason: 'test', at: clock.now() })).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    expect(await built.db.select().from(adminActions)).toHaveLength(0);
  });

  it('serializes concurrent bans into one decision', async () => {
    await Promise.all([ban(), ban(), ban()]);
    const [a] = await built.db.select().from(accounts).where(eq(accounts.id, target.accountId));
    expect(a?.authVersion).toBe(1);
    expect(await built.db.select().from(adminActions)).toHaveLength(1);
  });

  it('blocks verified email login too', async () => {
    await built.db.update(accounts).set({ email: 'ban-target@example.com', emailVerifiedAt: clock.now() }).where(eq(accounts.id, target.accountId));
    const login = () => built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'ban-target@example.com', password } });
    expect((await login()).statusCode).toBe(200);
    await ban();
    expect((await login()).statusCode).toBe(401);
  });

  it('blocks a timed ban until its expiry and permits fresh login after expiry without reviving old sessions', async () => {
    const now = clock.now().getTime();
    const timedBan = banAccount(built.db, { accountId: target.accountId, reason: 'One month',
      at: new Date(now - 86400000), expiresAt: new Date(now + 30 * 86400000) });
    const receipt = await timedBan;
    expect(receipt?.details.expiresAt).toBe(new Date(now + 30 * 86400000).toISOString());
    expect((await me(target.accessToken)).statusCode).toBe(401);
    expect((await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'BanTarget', password } })).statusCode).toBe(401);
    await built.db.update(adminActions).set({ details: { reason: 'One month', expiresAt: new Date(now - 1000).toISOString() } })
      .where(eq(adminActions.id, receipt!.id));
    const login = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'BanTarget', password } });
    expect(login.statusCode).toBe(200);
    expect((await me(sessionSchema.parse(login.json<unknown>()).accessToken)).statusCode).toBe(200);
    expect((await me(target.accessToken)).statusCode).toBe(401);
  });

  it('honors an explicit later unban while old sessions stay invalid', async () => {
    await ban();
    await built.db.insert(adminActions).values({ targetAccountId: target.accountId, action: 'ACCOUNT_UNBANNED',
      details: { reason: 'Owner reversal' }, createdAt: new Date(clock.now().getTime() + 1000) });
    const login = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'BanTarget', password } });
    expect(login.statusCode).toBe(200);
    expect((await me(sessionSchema.parse(login.json<unknown>()).accessToken)).statusCode).toBe(200);
    expect((await me(target.accessToken)).statusCode).toBe(401);
  });

  it('can ban an account again after an earlier timed ban expired', async () => {
    const now = clock.now().getTime();
    await banAccount(built.db, { accountId: target.accountId, reason: 'Previous ban',
      at: new Date(now - 86400000), expiresAt: new Date(now - 1000) });
    await ban();
    const [a] = await built.db.select().from(accounts).where(eq(accounts.id, target.accountId));
    expect(a?.authVersion).toBe(2);
    expect(await built.db.select().from(adminActions)).toHaveLength(2);
    expect((await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'BanTarget', password } })).statusCode).toBe(401);
  });

  it('rejects invalid expiry without mutating the account', async () => {
    for (const expiresAt of [clock.now(), new Date(0), new Date('invalid')]) {
      await expect(banAccount(built.db, { accountId: target.accountId, reason: 'Invalid', at: clock.now(), expiresAt }))
        .rejects.toMatchObject({ code: 'INVALID_BAN_EXPIRY' });
    }
    expect(await built.db.select().from(adminActions)).toHaveLength(0);
    expect((await me(target.accessToken)).statusCode).toBe(200);
  });
});
