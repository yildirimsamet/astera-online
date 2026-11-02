import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { TEST_DATABASE_URL } from './helpers.js';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { analyticsVisitors } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(1); const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ENABLED: 'true' }) });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); }); afterAll(async () => { await (await testDb()).close(); });
it('never promotes anonymous history into a verified player account', async () => {
  const contextId = randomUUID();
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { scope: 'anonymous', policyVersion: 1,
    contextId, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  expect(visitor.statusCode).toBe(201);
  const grant = visitor.json<{ credential: string; visitorId: string }>();
  const event = { id: randomUUID(), version: 1, name: 'landing_visible', source: 'client_observation', mode: 'live',
    contextId, sessionId: randomUUID(), sequence: 0, occurredAt: f.clock.now().getTime(), elapsedMs: 0, properties: {} };
  const headers = { 'x-analytics-visitor': grant.credential };
  expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event] } })).statusCode).toBe(200);
  const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers: { ...headers, authorization }, payload: { events: [{ ...event, id: randomUUID() }] } })).statusCode).toBe(403);
  expect((await f.db.select().from(analyticsVisitors).where(eq(analyticsVisitors.id, grant.visitorId)))[0]?.accountId).toBeNull();
});
it('requires verified identity at player scope creation and does not manufacture consent', async () => {
  const payload = { scope: 'player', policyVersion: 1, contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} };
  expect((await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload })).statusCode).toBe(401);
  const reply = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload,
    headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` } });
  expect(reply.statusCode).toBe(201);
  const visitor = (await f.db.select().from(analyticsVisitors).where(eq(analyticsVisitors.id, reply.json<{ visitorId: string }>().visitorId)))[0];
  expect(visitor).toMatchObject({ accountId: f.accountIds[0], metadata: { scope: 'player', policyVersion: 1 } });
  expect(visitor?.metadata).not.toHaveProperty('consent');
});
it('does not leave an indirect anonymous-to-account link on a real command source', async () => {
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { scope: 'anonymous', policyVersion: 1,
    contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  const reply = await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers: { authorization,
    'x-analytics-visitor': visitor.json<{ credential: string }>().credential, 'x-analytics-attempt': randomUUID() }, payload: { type: 'CORE' } });
  expect(reply.statusCode).toBe(200);
  const { buildOrders } = await import('../src/db/schema.js');
  expect((await f.db.select().from(buildOrders))[0]).toMatchObject({ analyticsVisitHash: null, analyticsAttemptId: null });
});
it('finishes gameplay while the optional analytics table is locked', async () => {
  const other = createDb(TEST_DATABASE_URL, { max: 1 });
  let release: (() => void) | undefined, locked: (() => void) | undefined;
  const held = new Promise<void>(resolve => { locked = resolve; });
  const unlock = new Promise<void>(resolve => { release = resolve; });
  const locking = other.db.transaction(async tx => { await tx.execute(sql`LOCK TABLE analytics_visitors IN ACCESS EXCLUSIVE MODE`); locked?.(); await unlock; });
  try {
    await held;
    const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
    let status: number | undefined;
    const command = app.inject({ method: 'POST', url: '/api/planet/upgrade', headers: { authorization,
      'x-analytics-visitor': 'a'.repeat(43) }, payload: { type: 'CORE' } }).then(reply => { status = reply.statusCode; });
    try { await new Promise(resolve => setTimeout(resolve, 1000)); expect(status).toBe(200); }
    finally { release?.(); await command; }
  } finally { release?.(); await locking; await other.close(); }
});
