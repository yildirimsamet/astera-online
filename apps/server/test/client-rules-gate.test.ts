import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { ECONOMY_PROFILE } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { planets, players } from '../src/db/schema.js';
import { makeAccount, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let built: ReturnType<typeof buildApp> | undefined;
beforeEach(async () => { f = await seedWorld(1); });
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });

async function start(enabled = true, minimumBuild = 0) {
  built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }),
    env: testEnv({ REQUIRE_CURRENT_RULES: String(enabled), MIN_NATIVE_BUILD: String(minimumBuild), NATIVE_APP_ORIGINS: 'https://localhost' }) });
  return { app: built.app, authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}` };
}

describe('client rules at the season boundary', () => {
  it.each([undefined, 'season-30-v1', 'unknown'])('refuses stale placed reads with profile %s', async profile => {
    const { app, authorization } = await start();
    const response = await app.inject({ url: '/api/planet', headers: {
      authorization, ...(profile === undefined ? {} : { 'x-astera-rules': profile }),
    } });
    expect(response.statusCode).toBe(426);
    expect(response.json()).toMatchObject({ error: 'UPDATE_REQUIRED' });
  });

  it('refuses a stale write without ticking or collecting the world', async () => {
    const { app, authorization } = await start();
    const before = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const response = await app.inject({ method: 'POST', url: '/api/planet/collect', headers: { authorization }, payload: {} });
    expect(response.statusCode).toBe(426);
    expect(await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!))).toEqual(before);
  });

  it.each(['read', 'join'])('also refuses a stale %s before the first seasonal placement', async action => {
    const { app } = await start();
    const account = await makeAccount(f.db, 'RulesNewcomer');
    const authorization = `Bearer ${await app.tokens.issueAccess(account.id)}`;
    const request = action === 'read' ? { method: 'GET' as const, url: '/api/planet' }
      : { method: 'POST' as const, url: `/api/servers/EU-TEST-${String(f.seed)}/join`, payload: {} };
    const response = await app.inject({ ...request, headers: { authorization } });
    expect(response.statusCode).toBe(426);
    expect(await f.db.select().from(players).where(eq(players.accountId, account.id))).toEqual([]);
    if (action === 'join') {
      expect((await app.inject({ ...request, headers: { authorization, 'x-astera-rules': ECONOMY_PROFILE.id } })).statusCode).toBe(200);
      expect(await f.db.select().from(players).where(eq(players.accountId, account.id))).toHaveLength(1);
    }
  });

  it('admits the current web or native profile and leaves the rollout opt-in', async () => {
    const { app, authorization } = await start();
    const response = await app.inject({ url: '/api/planet', headers: { authorization, 'x-astera-rules': ECONOMY_PROFILE.id } });
    expect(response.statusCode).toBe(200);
  });

  it('does not activate during compatibility preparation', async () => {
    const { app, authorization } = await start(false);
    expect((await app.inject({ url: '/api/planet', headers: { authorization } })).statusCode).toBe(200);
  });

  it.each([
    ['season-30-v1', '1', 426],
    ['season-30-v1', '2', 426],
    ['season-60-v1', '1', 426],
    ['season-60-v1', '2', 200],
    ['season-60-v1', undefined, 200],
  ] as const)('combines profile %s with native build %s at the cutover', async (profile, build, status) => {
    const { app, authorization } = await start(true, 2);
    const response = await app.inject({ url: '/api/planet', headers: {
      authorization, 'x-astera-rules': profile, ...(build === undefined ? {} : { 'x-astera-build': build }),
    } });
    expect(response.statusCode).toBe(status);
  });

  it('preserves account security access for an older client', async () => {
    const { app, authorization } = await start();
    expect((await app.inject({ url: '/api/auth/security', headers: { authorization } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} })).statusCode).toBe(400);
  });

  it('allows the profile header in native preflight', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/planet', headers: {
      origin: 'https://localhost', 'access-control-request-method': 'GET',
      'access-control-request-headers': 'x-astera-rules',
    } });
    expect(response.statusCode).toBe(204);
    expect(String(response.headers['access-control-allow-headers'])).toContain('x-astera-rules');
  });
});
