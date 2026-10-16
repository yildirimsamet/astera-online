import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { sql } from 'drizzle-orm';
import { buildApp, type BuiltApp } from '../src/app.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const password = 'correct-horse-battery';
let built: BuiltApp;
afterAll(async () => { await (await testDb()).close(); });
beforeEach(async () => {
  const { db } = await testDb();
  await truncateAll(db);
  built = buildApp({ db, env: testEnv(), logger: pino({ level: 'silent' }) });
  await built.app.ready();
});
afterEach(async () => { await built.close(); });
const register = async () => {
  const response = await built.app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'Vantage', password } });
  return { account: response.json<{ accountId: string; accessToken: string }>(), cookie: String(response.headers['set-cookie']).split(';')[0]! };
};
describe('account credential migration', () => {
  it('revokes both bearer and refresh credentials after a durable version bump', async () => {
    const { account, cookie } = await register();
    await built.db.execute(sql`update accounts set auth_version = auth_version + 1 where id = ${account.accountId}`);
    const me = await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${account.accessToken}` } });
    const refresh = await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie } });
    expect(me.statusCode).toBe(401);
    expect(refresh.statusCode).toBe(401);
  });
  it('accepts only the verified email and keeps the public commander identity', async () => {
    const { account } = await register();
    await built.db.execute(sql`update accounts set email = 'pilot@example.com', email_verified_at = now(), auth_version = 1 where id = ${account.accountId}`);
    const oldLogin = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'Vantage', password } });
    expect(oldLogin.statusCode).toBe(401);
    const emailLogin = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { identifier: ' PILOT@EXAMPLE.COM ', password } });
    expect(emailLogin.statusCode).toBe(200);
    expect(emailLogin.json<{ displayName: string }>().displayName).toBe('Vantage');
    expect(emailLogin.json<{ loginEmail?: string }>().loginEmail).toBe('pilot@example.com');
    expect(emailLogin.headers['cache-control']).toBe('no-store');
    const emailCookie = String(emailLogin.headers['set-cookie']).split(';')[0]!;
    const refreshed = await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: emailCookie } });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<{ loginEmail?: string }>().loginEmail).toBe('pilot@example.com');
    const owner = await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${emailLogin.json<{ accessToken: string }>().accessToken}` } });
    expect(owner.statusCode).toBe(200);
    expect(owner.json()).not.toHaveProperty('loginEmail');
    expect(owner.json()).not.toHaveProperty('email');
  });
  it('does not provide an email hint for an account without a verified address', async () => {
    const { account, cookie } = await register();
    expect(account).not.toHaveProperty('loginEmail');
    const refreshed = await built.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie } });
    expect(refreshed.json()).not.toHaveProperty('loginEmail');
  });
});

describe('optional recovery email API', () => {
  it('does not expose account ownership or accept a pending email', async () => {
    const { account } = await register();
    const response = await built.app.inject({ url: '/api/auth/security', headers: { authorization: `Bearer ${account.accessToken}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ loginMethod: string; email: string | null }>().loginMethod).toBe('username');
    expect(response.headers['cache-control']).toBe('no-store');
    const reset = await built.app.inject({ method: 'POST', url: '/api/auth/password/reset/request', payload: { email: 'missing@example.com' } });
    expect([202, 503]).toContain(reset.statusCode);
  });
});


it('does not treat a temporary account lookup failure as a revoked session', async () => {
  const { account } = await register();
  const { vi } = await import('vitest');
  const select = vi.spyOn(built.db, 'select').mockImplementation(() => { throw new Error('temporary database outage'); });
  try {
    const response = await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${account.accessToken}` } });
    expect(response.statusCode).toBe(500);
  } finally { select.mockRestore(); }
});
