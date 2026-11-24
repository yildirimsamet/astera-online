import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { accounts } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/* Ay review B5: the moon usage counts are an admin read, for the F10 week and the bot calibration (§10.1). */
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(2, 21_124);
  await f.db.update(accounts).set({ username: 'analyticsowner' }).where(eq(accounts.id, f.accountIds[0]!));
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }),
    env: testEnv({ ANALYTICS_ADMIN_ENABLED: 'true', ADMIN_USERNAMES: 'analyticsowner' }) });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });

it('serves moon usage to admins only, for a window of days', async () => {
  expect((await app.inject('/api/admin/analytics/moons')).statusCode).toBe(401);
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[1]!)}` };
  expect((await app.inject({ url: '/api/admin/analytics/moons', headers })).statusCode).toBe(403);
  headers.authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  const reply = await app.inject({ url: `/api/admin/analytics/moons?seasonId=${f.seasonId}&days=7`, headers });
  expect(reply.statusCode).toBe(200);
  expect(reply.json()).toMatchObject({ days: 7, commanders: { hops: 0 }, roster: { hops: 0 }, moonsStanding: 0 });
  expect((await app.inject({ url: '/api/admin/analytics/moons?days=0', headers })).statusCode).toBe(400);
});
