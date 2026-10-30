import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets, pushDevices } from '../src/db/schema.js';
import { grant, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/** Bildirim Merkezi HTTP surface. docs/bildirim-merkezi-plani-2026-10-30.md. */
describe('notification centre routes', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);

  beforeEach(async () => {
    f = await seedWorld(2, 9120);
    const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv() });
    app = built.app; close = built.close;
    await app.ready();
    auth = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, who = 0) =>
    app.inject({ method, url, headers: auth[who], ...(payload ? { payload } : {}) });

  it('answers only a signed-in commander', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/notification-center' })).statusCode).toBe(401);
    const view = await call('GET', '/api/notification-center');
    expect(view.statusCode).toBe(200);
    expect(view.json()).toMatchObject({ built: false, wallet: 0, timing: 'T5', prices: { incoming_attack: { T5: 30 } } });
  });

  it('builds, funds and tunes the centre, each answering with the whole view', async () => {
    const home = f.planetIds[0]!;
    await grant(f.db, home, 10_000, 10_000);
    await f.db.update(planets).set({ deuterium: 500 }).where(eq(planets.id, home));
    expect((await call('POST', '/api/notification-center/build', { planetId: home })).json()).toMatchObject({ built: true });
    expect((await call('POST', '/api/notification-center/fund', { planetId: home, amount: 200, confirm: true })).json())
      .toMatchObject({ wallet: 200 });
    expect((await call('PUT', '/api/notification-center/settings', { timing: 'RADAR', muted: ['probe_detected'] })).json())
      .toMatchObject({ timing: 'RADAR', muted: ['probe_detected'] });
  });

  it('refuses malformed and foreign requests', async () => {
    const [home, theirs] = f.planetIds as [string, string];
    expect((await call('POST', '/api/notification-center/build', { planetId: 'nope' })).statusCode).toBe(400);
    expect((await call('POST', '/api/notification-center/build', { planetId: home, extra: 1 })).statusCode).toBe(400);
    expect((await call('POST', '/api/notification-center/fund', { planetId: home, amount: 5 })).statusCode).toBe(400);
    expect((await call('PUT', '/api/notification-center/settings', { timing: 'T7' })).statusCode).toBe(400);
    await grant(f.db, theirs, 10_000, 10_000);
    expect((await call('POST', '/api/notification-center/build', { planetId: theirs })).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('registers an app install and forgets it on sign-out', async () => {
    const device = { token: 'fcm-token-1', platform: 'android', locale: 'tr' };
    expect((await call('POST', '/api/push/devices', device)).statusCode).toBe(204);
    expect((await call('POST', '/api/push/devices', { ...device, locale: 'xx' })).statusCode).toBe(400);
    expect((await call('POST', '/api/push/devices', { ...device, platform: 'web' })).statusCode).toBe(400);
    expect(await f.db.select().from(pushDevices)).toHaveLength(1);
    // Someone else cannot remove it.
    expect((await call('DELETE', '/api/push/devices', { token: 'fcm-token-1' }, 1)).statusCode).toBe(204);
    expect(await f.db.select().from(pushDevices)).toHaveLength(1);
    expect((await call('DELETE', '/api/push/devices', { token: 'fcm-token-1' })).statusCode).toBe(204);
    expect(await f.db.select().from(pushDevices)).toHaveLength(0);
  });
});
