import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { buildApp } from '../src/app.js';
import { analyticsEvents, analyticsVisitors, buildOrders } from '../src/db/schema.js';
import { recoverAnalyticsCommands } from '../src/services/analyticsFacts.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(1);
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ENABLED: 'true' }) });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });
it('recovers committed manual orders once, with original actor and acceptance time, outside the game transaction', async () => {
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { scope: 'player', policyVersion: 1,
    contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const g = visit.json<{ credential: string; visitorId: string }>();
  const attemptId = randomUUID();
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`, 'x-analytics-visitor': g.credential, 'x-analytics-attempt': attemptId };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  // Recovery uses durable command metadata, not a callback that existed only in the API process.
  await recoverAnalyticsCommands(f.db, f.clock); await recoverAnalyticsCommands(f.db, f.clock);
  const facts = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.source, 'server_fact'));
  expect(facts).toHaveLength(1);
  expect(facts[0]).toMatchObject({ accountId: f.accountIds[0], playerId: f.playerIds[0], seasonId: f.seasonId,
    occurredAt: f.clock.now(), name: 'command_accepted', properties: { subject: 'BUILDING', code: 'CORE', count: 1, attemptId } });
  await f.db.delete(analyticsVisitors).where(eq(analyticsVisitors.id, g.visitorId));
  await recoverAnalyticsCommands(f.db, f.clock);
  expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_events WHERE source='server_fact'`))[0]?.n).toBe(0);
});
it('does not create optional behaviour records for a commander without a permitted visit', async () => {
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  await recoverAnalyticsCommands(f.db, f.clock);
  expect((await f.db.select().from(analyticsEvents))).toHaveLength(0);
});

it('records success and failure of optional recovery without changing the command response', async () => {
  const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  const response = await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers: { authorization }, payload: { type: 'CORE' } });
  expect(response.statusCode).toBe(200);
  // A capability that does not exist cannot cause a game mutation to fail.
  const second = await app.inject({ method: 'POST', url: '/api/planet/upgrade',
    headers: { authorization, 'x-analytics-visitor': 'x'.repeat(43) }, payload: { type: 'REFINERY' } });
  expect(second.statusCode).toBe(200);
  await recoverAnalyticsCommands(f.db, f.clock); expect((await f.db.select().from(analyticsEvents))).toHaveLength(0);
});

it('recovers a manual harvest with its original dispatch reference', async () => {
  const { giveDebris, giveUnits } = await import('./helpers.js');
  await giveUnits(f.db, f.planetIds[0]!, { PROSPECTOR: 1 });
  const field = await giveDebris(f.db, f.seasonId, f.planetIds[0]!, { alloy: 1000, crystal: 0, createdAt: f.clock.now() });
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { scope: 'player', policyVersion: 1,
    contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`, 'x-analytics-visitor': visit.json<{ credential: string }>().credential };
  expect((await app.inject({ method: 'POST', url: '/api/mining/harvest', headers, payload: { fieldId: field.id, craft: 1 } })).statusCode).toBe(200);
  await recoverAnalyticsCommands(f.db, f.clock);
  const events = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'command_accepted'));
  expect(events).toHaveLength(1); expect(events[0]?.properties).toMatchObject({ subject: 'MINING', code: 'debris', count: 1 });
});

it('separates committed work completion from command acceptance and never fabricates a result view', async () => {
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { scope: 'player', policyVersion: 1,
    contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`, 'x-analytics-visitor': visit.json<{ credential: string }>().credential };
  expect((await app.inject({ method: 'POST', url: '/api/planet/upgrade', headers, payload: { type: 'CORE' } })).statusCode).toBe(200);
  await recoverAnalyticsCommands(f.db, f.clock);
  expect(await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'outcome_resolved'))).toHaveLength(0);
  const [order] = await f.db.select().from(buildOrders);
  if (!order) throw new Error('Missing build order fixture');
  f.clock.set(new Date(order.readyAt.getTime() + 60000));
  const { applyBuildCompletion } = await import('../src/services/buildQueue.js');
  expect(await f.db.transaction(tx => applyBuildCompletion(tx, order.id, order.readyAt.toISOString(), f.clock))).toBe(true);
  await recoverAnalyticsCommands(f.db, f.clock); await recoverAnalyticsCommands(f.db, f.clock);
  const rows = await f.db.select().from(analyticsEvents);
  expect(rows.filter(row => row.name === 'command_accepted')).toHaveLength(1);
  const resolved = rows.filter(row => row.name === 'outcome_resolved'); expect(resolved).toHaveLength(1);
  expect(resolved[0]).toMatchObject({ occurredAt: order.readyAt, source: 'server_fact',
    properties: { refId: order.id, subject: 'BUILDING', code: 'COMPLETED', phase: 'effective_completion' } });
  expect(rows.some(row => row.name === 'outcome_visible')).toBe(false);
});
it('captures successful non-durable collect after the response without storing its payload', async () => {
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { scope: 'player', policyVersion: 1,
    contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const attemptId = randomUUID();
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`,
    'x-analytics-visitor': visit.json<{ credential: string }>().credential, 'x-analytics-attempt': attemptId,
    'idempotency-key': 'private-retry-input-never-store-raw' };
  expect((await app.inject({ method: 'POST', url: '/api/planet/collect', headers })).statusCode).toBe(200);
  const { flushServerAnalytics } = await import('../src/services/analyticsServerFacts.js');
  await flushServerAnalytics(app);
  const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'command_accepted'));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.properties).toEqual({ code: 'collect', phase: 'response_confirmed', attemptId });
  expect(JSON.stringify(rows)).not.toContain('private-retry-input-never-store-raw');
});

it('projects committed result notifications with bounded metadata, never message text or a fabricated result view', async () => {
  const { notify } = await import('../src/services/notifications.js');
  const { visitorHash } = await import('../src/services/playerAnalytics.js');
  const now = f.clock.now(), visitorId = randomUUID();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, contextId: randomUUID(), credentialHash: visitorHash('a'.repeat(43)),
    accountId: f.accountIds[0], createdAt: now, expiresAt: new Date(now.getTime() + 86400000),
    metadata: { scope: 'player', policyVersion: 1, contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const refId = randomUUID(); f.clock.advance(1);
  await f.db.transaction(tx => notify(tx, { playerId: f.playerIds[0]!, kind: 'raid_result', at: f.clock.now(), refId,
    payload: { unitsLost: 7, targetUsername: 'secret-target', body: 'private-content', grade: 'DECISIVE' } }));
  await recoverAnalyticsCommands(f.db, f.clock); await recoverAnalyticsCommands(f.db, f.clock);
  const rows = await f.db.select().from(analyticsEvents);
  expect(rows).toEqual([expect.objectContaining({ name: 'outcome_resolved', source: 'server_fact',
    occurredAt: f.clock.now(), seasonId: null, properties: { refId, code: 'raid_result', count: 7, phase: 'result_recorded', subject: 'notification' } })]);
  expect(JSON.stringify(rows)).not.toMatch(/secret-target|private-content/);
  await f.db.delete(analyticsVisitors).where(eq(analyticsVisitors.id, visitorId));
  await recoverAnalyticsCommands(f.db, f.clock);
  expect(await f.db.select().from(analyticsEvents)).toHaveLength(0);
});

it('projects an actual Silent Space transfer without moving old observations to the new season', async () => {
  const { visitorHash } = await import('../src/services/playerAnalytics.js');
  const { ensureWaitingSeason } = await import('../src/services/waitingServers.js');
  const { transferCommander } = await import('../src/services/commanderTransfer.js');
  f.clock.advance(48 * 60);
  const now = f.clock.now(), visitorId = randomUUID(), contextId = randomUUID();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, contextId, credentialHash: visitorHash('a'.repeat(43)),
    accountId: f.accountIds[0], createdAt: now, expiresAt: new Date(now.getTime() + 86400000),
    metadata: { scope: 'player', policyVersion: 1, contextId, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  if (!target) throw new Error('Missing waiting season fixture');
  expect((await transferCommander(f.db, f.playerIds[0]!, target.id, f.clock)).status).toBe('MOVED');
  await recoverAnalyticsCommands(f.db, f.clock); await recoverAnalyticsCommands(f.db, f.clock);
  const rows = await f.db.select().from(analyticsEvents);
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ name: 'commander_transfer', seasonId: f.seasonId,
    accountId: f.accountIds[0], occurredAt: now, properties: { code: 'OUT', phase: 'transfer_committed' } });
});
