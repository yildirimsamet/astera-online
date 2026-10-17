import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { buildApp, type BuiltApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { bootstrapServers } from '../src/services/servers.js';
import { claimSchema, sessionSchema } from '../../web/src/api/schemas.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const nativeSession = sessionSchema.extend({ nativeSessionId: z.string().uuid(), refreshToken: secret });
const refreshedSession = sessionSchema.extend({ nativeSessionId: z.string().uuid() });
const password = 'native-test-correct-password';
const username = 'Native Pilot';
const nextToken = () => randomBytes(32).toString('base64url');
let built: BuiltApp;
let clock: FixedClock;

beforeEach(async () => {
  const { db } = await testDb();
  await truncateAll(db);
  clock = new FixedClock(new Date());
  built = buildApp({ db, clock, env: testEnv({ NATIVE_AUTH_ENABLED: 'true' }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
  const created = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password } });
  expect(created.statusCode).toBe(200);
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

async function login() {
  const result = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username, password } });
  expect(result.statusCode).toBe(200);
  expect(result.headers['set-cookie']).toBeUndefined();
  expect(result.headers['cache-control']).toBe('no-store');
  return nativeSession.parse(result.json<unknown>());
}
const me = (accessToken: string) => built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${accessToken}` } });
const rotate = (session: z.infer<typeof nativeSession>, next: string) => built.app.inject({ method: 'POST', url: '/api/native/auth/refresh',
  payload: { sessionId: session.nativeSessionId, refreshToken: session.refreshToken, nextRefreshToken: next } });
const logout = (session: z.infer<typeof nativeSession>) => built.app.inject({ method: 'POST', url: '/api/native/auth/logout',
  payload: { sessionId: session.nativeSessionId, refreshToken: session.refreshToken } });

describe('native sessions on the shared Astera account', () => {
  it('authenticates the web account with a short bearer and a separate native credential', async () => {
    const session = await login();
    const result = await me(session.accessToken);
    expect(result.statusCode).toBe(200);
    expect(result.json<{ accountId: string }>().accountId).toBe(session.accountId);
    const rows = await built.db.execute<{ refresh_hash: string; version: number }>(sql`select refresh_hash, version from native_sessions`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.refresh_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0]?.refresh_hash).not.toBe(session.refreshToken);
    expect(rows[0]?.version).toBe(0);
  });

  it('registers with the existing country/identity rules without setting a browser cookie', async () => {
    const response = await built.app.inject({ method: 'POST', url: '/api/native/auth/register',
      payload: { username: 'New Native Pilot', password, countryCode: 'DE' } });
    expect(response.statusCode).toBe(200);
    const session = nativeSession.parse(response.json<unknown>());
    expect(session.country).toBe('DE');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await me(session.accessToken)).statusCode).toBe(200);
    const web = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'New Native Pilot', password } });
    expect(sessionSchema.parse(web.json<unknown>()).accountId).toBe(session.accountId);
    expect(web.json()).not.toHaveProperty('refreshToken');
    expect(web.headers['set-cookie']).toContain('HttpOnly');
  });

  it('rotates and retries a lost response with the same pair, including concurrent retries', async () => {
    const session = await login(); const next = nextToken();
    const responses = await Promise.all([rotate(session, next), rotate(session, next)]);
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.json()).not.toHaveProperty('refreshToken');
      expect(refreshedSession.parse(response.json<unknown>()).nativeSessionId).toBe(session.nativeSessionId);
    }
    const again = await rotate(session, next);
    expect(again.statusCode).toBe(200);
    expect((await rotate({ ...session, refreshToken: next }, nextToken())).statusCode).toBe(200);
  });

  it('commits revocation when a previous credential is reused with a different next token', async () => {
    const session = await login(); const next = nextToken();
    expect((await rotate(session, next)).statusCode).toBe(200);
    expect((await rotate(session, nextToken())).statusCode).toBe(401);
    expect((await me(session.accessToken)).statusCode).toBe(401);
    expect((await rotate({ ...session, refreshToken: next }, nextToken())).statusCode).toBe(401);
  });

  it('does not let a guessed credential revoke a known session UUID', async () => {
    const session = await login();
    expect((await rotate({ ...session, refreshToken: nextToken() }, nextToken())).statusCode).toBe(401);
    expect((await me(session.accessToken)).statusCode).toBe(200);
    expect((await logout({ ...session, refreshToken: nextToken() })).statusCode).toBe(200);
    expect((await me(session.accessToken)).statusCode).toBe(200);
  });

  it('revokes only the signed-out native device, including its existing access token', async () => {
    const first = await login(); const second = await login();
    const web = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
    const webSession = sessionSchema.parse(web.json<unknown>());
    expect((await logout(first)).statusCode).toBe(200);
    expect((await me(first.accessToken)).statusCode).toBe(401);
    expect((await me(second.accessToken)).statusCode).toBe(200);
    expect((await me(webSession.accessToken)).statusCode).toBe(200);
    expect((await logout(first)).statusCode).toBe(200);
  });

  it('makes logout win over an in-flight refresh without resurrecting the session', async () => {
    const session = await login();
    const [refreshed, ended] = await Promise.all([rotate(session, nextToken()), logout(session)]);
    expect(ended.statusCode).toBe(200);
    expect([200, 401]).toContain(refreshed.statusCode);
    if (refreshed.statusCode === 200) expect((await me(refreshedSession.parse(refreshed.json<unknown>()).accessToken)).statusCode).toBe(401);
    expect((await me(session.accessToken)).statusCode).toBe(401);
  });

  it('checks expiry and the shared account version before refresh and access', async () => {
    const session = await login();
    await built.db.execute(sql`update accounts set auth_version = auth_version + 1 where id = ${session.accountId}`);
    expect((await me(session.accessToken)).statusCode).toBe(401);
    expect((await rotate(session, nextToken())).statusCode).toBe(401);
    const current = await login();
    clock.advance(31 * 24 * 60);
    expect((await rotate(current, nextToken())).statusCode).toBe(401);
    expect((await me(current.accessToken)).statusCode).toBe(401);
  });

  it('does not revive a deleted account or leave native credentials behind', async () => {
    const session = await login();
    await deleteAccount(built.db, clock, username);
    expect((await me(session.accessToken)).statusCode).toBe(401);
    expect((await rotate(session, nextToken())).statusCode).toBe(401);
    expect(await built.db.execute(sql`select id from native_sessions`)).toHaveLength(0);
  });

  it('never accepts the native refresh credential as a bearer or a browser refresh JWT', async () => {
    const session = await login();
    expect((await me(session.refreshToken)).statusCode).toBe(401);
    const response = await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: `bs_refresh=${session.refreshToken}` } });
    expect(response.statusCode).toBe(401);
  });

  it('rejects malformed and identical rotation credentials before changing the session', async () => {
    const session = await login();
    expect((await rotate(session, session.refreshToken)).statusCode).toBe(400);
    expect((await rotate(session, 'short')).statusCode).toBe(400);
    expect((await me(session.accessToken)).statusCode).toBe(200);
  });

  it('keeps wrong-user and wrong-password responses indistinguishable', async () => {
    const wrong = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username, password: 'wrong-password' } });
    const absent = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username: 'Unknown Native Pilot', password } });
    expect(wrong.statusCode).toBe(401);
    expect(absent.statusCode).toBe(401);
    expect(wrong.json()).toEqual(absent.json());
  });

  it('opens the same Academy claim with a native session and a parseable planet response', async () => {
    await bootstrapServers(built.db, clock, { count: 1, capacity: 6, seedBase: 1000 });
    const response = await built.app.inject({ method: 'POST', url: '/api/native/onboarding/claim',
      payload: { username: 'Native Academy', password, step: 0, countryCode: 'TR' } });
    expect(response.statusCode).toBe(200);
    const native = nativeSession.parse(response.json<unknown>());
    const claimed = claimSchema.parse(response.json<unknown>());
    expect(claimed.accountId).toBe(native.accountId);
    expect(claimed.placement.planetId).toBe(claimed.planet.planet.id);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await me(native.accessToken)).statusCode).toBe(200);
  });

  it('uses a distinct JWT purpose so old replicas cannot bypass native revocation', async () => {
    const session = await login();
    const payload = JSON.parse(Buffer.from(session.accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as unknown;
    expect(z.object({ typ: z.literal('native-access'), sid: z.string().uuid() }).parse(payload).sid).toBe(session.nativeSessionId);
  });

  it('keeps native routes closed unless explicitly enabled', async () => {
    const db = built.db;
    await built.close();
    built = buildApp({ db, clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    await built.app.ready();
    const response = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username, password } });
    expect(response.statusCode).toBe(404);
  });

  it('uses the strict login budget without making ordinary refresh share it', async () => {
    const db = built.db;
    await built.close();
    built = buildApp({ db, clock, env: testEnv({ NATIVE_AUTH_ENABLED: 'true', RATE_LIMIT_AUTH_MAX: '1' }), logger: pino({ level: 'silent' }) });
    await built.app.ready();
    const session = await login();
    const refused = await built.app.inject({ method: 'POST', url: '/api/native/auth/login', payload: { username, password } });
    expect(refused.statusCode).toBe(429);
    expect((await rotate(session, nextToken())).statusCode).toBe(200);
  });
});
