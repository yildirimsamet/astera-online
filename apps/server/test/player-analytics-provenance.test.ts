import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { buildApp } from '../src/app.js';
import { buildOrders } from '../src/db/schema.js';
import { upgradeBuilding } from '../src/services/build.js';
import { cancelBuildOrder } from '../src/services/buildQueue.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(1);
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv() });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });
it('persists acceptance time and original manual actor while queue scheduling changes', async () => {
  const acceptedAt = f.clock.now();
  const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  for (const type of ['CORE', 'REFINERY']) {
    const reply = await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers: { authorization }, payload: { type } });
    expect(reply.statusCode).toBe(200);
  }
  const orders = await f.db.select().from(buildOrders).orderBy(buildOrders.slot);
  expect(orders[1]!.startedAt.getTime()).toBeGreaterThan(acceptedAt.getTime());
  expect(orders[1]).toMatchObject({ orderedAt: acceptedAt, actorAccountId: f.accountIds[0], actorPlayerId: f.playerIds[0], origin: 'manual_http' });
  // Cancel the tail and verify its immutable metadata survives cancellation.
  await cancelBuildOrder(f.db, f.planetIds[0]!, orders[1]!.id, f.clock);
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, orders[1]!.id)))[0])
    .toMatchObject({ orderedAt: acceptedAt, actorAccountId: f.accountIds[0], origin: 'manual_http' });
});
it('does not classify internal service calls as player commands', async () => {
  await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
  expect((await f.db.select().from(buildOrders))[0]).toMatchObject({ orderedAt: f.clock.now(), origin: 'internal', actorAccountId: null });
});

it('expires optional command identity metadata without changing the original acceptance time', async () => {
  const at = f.clock.now();
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`, 'x-analytics-visitor': 'a'.repeat(43) };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  f.clock.advance(30 * 24 * 60);
  const { purgeAnalytics } = await import('../src/services/playerAnalytics.js');
  await purgeAnalytics(f.db, f.clock);
  expect((await f.db.select().from(buildOrders))[0]).toMatchObject({ orderedAt: at, actorAccountId: null, actorPlayerId: null, analyticsVisitHash: null });
});

it('preserves the original dispatch actor and time for a manual harvest', async () => {
  const { giveDebris, giveUnits } = await import('./helpers.js');
  const { miningRuns } = await import('../src/db/schema.js');
  await giveUnits(f.db, f.planetIds[0]!, { PROSPECTOR: 1 });
  const field = await giveDebris(f.db, f.seasonId, f.planetIds[0]!, { alloy: 10_000, crystal: 0, createdAt: f.clock.now() });
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const result = await app.inject({ method: 'POST', url: '/api/mining/harvest', headers, payload: { fieldId: field.id, craft: 1 } });
  expect(result.statusCode).toBe(200);
  const [run] = await f.db.select().from(miningRuns);
  expect(run).toMatchObject({ orderedAt: f.clock.now(), actorAccountId: f.accountIds[0], actorPlayerId: f.playerIds[0], commandSource: 'manual_http' });
});

it('does not retain a visit credential in gameplay records while collection is disabled', async () => {
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`, 'x-analytics-visitor': 'x'.repeat(43) };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  expect((await f.db.select().from(buildOrders))[0]?.analyticsVisitHash).toBeNull();
});

it('removes visit and attempt correlation from durable commands when that permission is withdrawn', async () => {
  await close();
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ENABLED: 'true' }) });
  app = built.app; close = built.close; await app.ready();
  const { randomUUID } = await import('node:crypto');
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { contextId: randomUUID(),
    scope: 'player', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`,
    'x-analytics-visitor': visit.json<{ credential: string }>().credential, 'x-analytics-attempt': randomUUID() };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  expect((await f.db.select().from(buildOrders))[0]?.analyticsVisitHash).not.toBeNull();
  expect((await app.inject({ method: 'DELETE', url: '/api/analytics/visitors', headers })).statusCode).toBe(204);
  expect((await f.db.select().from(buildOrders))[0]).toMatchObject({ orderedAt: f.clock.now(), analyticsVisitHash: null, analyticsAttemptId: null });
});
