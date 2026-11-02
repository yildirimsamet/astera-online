import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { accounts, analyticsEvents, analyticsSessions, analyticsVisitors } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>, headers: { authorization: string };
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(accounts).set({ username: 'analyticsowner' }).where(eq(accounts.id, f.accountIds[0]!));
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ADMIN_ENABLED: 'true', ADMIN_USERNAMES: 'analyticsowner' }) });
  app = built.app; close = built.close; await app.ready();
  headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });
async function visit(source: string, accountId: string | null) {
  const visitorId = randomUUID(), contextId = randomUUID(), sessionId = randomUUID();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, contextId, accountId, credentialHash: randomUUID(), createdAt: f.clock.now(), expiresAt: f.clock.now(),
    metadata: { contextId, scope: 'anonymous', policyVersion: 1, build: 'test', platform: 'web', locale: 'tr', campaign: { utm_source: source } } });
  await f.db.insert(analyticsSessions).values({ id: sessionId, visitorId, contextId, accountId, firstAt: f.clock.now(), lastAt: f.clock.now() });
  await f.db.insert(analyticsEvents).values({ id: randomUUID(), visitorId, sessionId, accountId, name: 'training_scene_visible', mode: 'training', source: 'client_observation',
    sequence: 0, occurredAt: f.clock.now(), receivedAt: f.clock.now(), timeTrusted: true, payloadHash: randomUUID(), properties: { step: 4, scene: 'sight' } });
  return visitorId;
}
it('keeps first observed and current campaign separate without claiming lifetime acquisition', async () => {
  await visit('twitter', f.accountIds[1]!); f.clock.advance(1); await visit('return-link', f.accountIds[1]!);
  const reply = await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers });
  expect(reply.statusCode).toBe(200);
  const body = reply.json<{ players: unknown[] }>(); expect(body.players).toHaveLength(1);
  expect(body.players[0]).toMatchObject({ firstVisit: { campaign: { utm_source: 'twitter' } }, currentVisit: { campaign: { utm_source: 'return-link' } } });
  const absent = await app.inject({ url: '/api/admin/analytics?inactiveHours=0&username=does-not-exist', headers });
  expect(absent.json()).toMatchObject({ players: [], quality: { visits: 0, measuredAccounts: 0 }, cohorts: [] });
});
it('lets only an admin inspect a bounded anonymous journey without returning visit capabilities', async () => {
  const id = await visit('twitter', null); await visit('other', f.accountIds[1]!);
  expect((await app.inject('/api/admin/analytics/visits')).statusCode).toBe(401);
  const list = await app.inject({ url: '/api/admin/analytics/visits?limit=1', headers });
  expect(list.statusCode).toBe(200); expect(list.json()).toMatchObject({ visits: [{ id }], nextAfter: null });
  expect(list.body).not.toMatch(/credential|password|authorization/);
  const timeline = await app.inject({ url: `/api/admin/analytics/visits/${id}/events`, headers });
  expect(timeline.statusCode).toBe(200); expect(timeline.json()).toMatchObject({ events: [{ name: 'training_scene_visible', properties: { step: 4 } }] });
  expect((await app.inject({ url: '/api/admin/analytics/visits?limit=1000', headers })).statusCode).toBe(400);
});
