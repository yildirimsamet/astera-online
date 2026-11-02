import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { analyticsEvents, paidAlerts } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { flushServerAnalytics } from '../src/services/analyticsServerFacts.js';
import * as serverPlacement from '../src/services/servers.js';
import { GameError } from '../src/services/planet.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(1);
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ENABLED: 'true', NATIVE_AUTH_ENABLED: 'true' }) });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });
it('records actual account creation once, and an existing-account claim separately', async () => {
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { contextId: randomUUID(),
    scope: 'anonymous', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const headers = { 'x-analytics-visitor': visit.json<{ credential: string }>().credential };
  const payload = { username: 'AnalyticNova', password: 'Password123', communityPolicyVersion: COMMUNITY_POLICY_VERSION, communityPolicyLocale: 'tr', intents: [] };
  for (let i = 0; i < 2; i++) {
    expect((await app.inject({ method: 'POST', url: '/api/onboarding/claim', headers, payload })).statusCode).toBe(200);
    await flushServerAnalytics(app);
  }
  const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.source, 'server_fact'));
  expect(rows.filter(row => row.name === 'account_created')).toHaveLength(1);
  expect(rows.filter(row => row.name === 'authenticated_existing')).toHaveLength(1);
  expect(rows.filter(row => row.name === 'placement_completed')).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain('Password123');
});
it('records native registration and existing-account sign-in from their actual server results', async () => {
  const visit = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { contextId: randomUUID(),
    scope: 'anonymous', policyVersion: 1, platform: 'android', locale: 'tr', build: 'test', campaign: {} } });
  const headers = { 'x-analytics-visitor': visit.json<{ credential: string }>().credential };
  const credentials = { username: 'NativeNova', password: 'Password123' };
  expect((await app.inject({ method: 'POST', url: '/api/native/auth/register', headers, payload: {
    ...credentials, communityPolicyVersion: COMMUNITY_POLICY_VERSION, communityPolicyLocale: 'tr',
  } })).statusCode).toBe(200);
  await flushServerAnalytics(app);
  expect((await app.inject({ method: 'POST', url: '/api/native/auth/login', headers, payload: credentials })).statusCode).toBe(200);
  await flushServerAnalytics(app);
  const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.source, 'server_fact'));
  expect(rows.filter(row => row.name === 'account_created')).toHaveLength(1);
  expect(rows.filter(row => row.name === 'authenticated_existing')).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain('Password123');
});

it('keeps a committed account fact queued through a temporary analytics transaction failure', async () => {
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { contextId: randomUUID(),
    scope: 'anonymous', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const { queueServerAnalytics } = await import('../src/services/analyticsServerFacts.js');
  const request = { id: randomUUID(), headers: { 'x-analytics-visitor': visitor.json<{ credential: string }>().credential } };
  const transaction = vi.spyOn(app.db, 'transaction').mockRejectedValueOnce(new Error('Optional analytics unavailable'));
  try {
    queueServerAnalytics(app, request, { accountId: f.accountIds[0]!, name: 'authenticated_existing' });
    await flushServerAnalytics(app);
    const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'authenticated_existing'));
    expect(rows).toHaveLength(1);
  } finally { transaction.mockRestore(); }
});
it('attributes a provider response only to the actual alert recipient with a currently permitted visit', async () => {
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { contextId: randomUUID(),
    scope: 'player', policyVersion: 1, platform: 'android', locale: 'tr', build: 'test', campaign: {} } });
  const { queueServerAnalytics, queueProviderAnalytics } = await import('../src/services/analyticsServerFacts.js');
  queueServerAnalytics(app, { id: randomUUID(), headers: { 'x-analytics-visitor': visitor.json<{ credential: string }>().credential } },
    { accountId: f.accountIds[0]!, name: 'authenticated_existing' });
  await flushServerAnalytics(app);
  const refId = randomUUID();
  const [alert] = await f.db.insert(paidAlerts).values({ playerId: f.playerIds[0]!, kind: 'probe_detected', refId,
    sendAt: f.clock.now(), createdAt: f.clock.now(), settledAt: f.clock.now(), status: 'SENT', payload: { targetPlanetName: 'private world' } }).returning();
  if (!alert) throw new Error('Missing alert fixture');
  queueProviderAnalytics(app, { alertId: alert.id, accepted: 1, rejected: 1 });
  await flushServerAnalytics(app);
  const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'alert_transport_result'));
  expect(rows).toEqual([expect.objectContaining({ accountId: f.accountIds[0], source: 'server_fact', properties: {
    refId, phase: 'provider_response', code: 'accepted_and_rejected', count: 1, value: 1, variant: 'push',
  } })]);
  expect(JSON.stringify(rows)).not.toContain('private world');
  expect(rows.some(row => row.name === 'alert_delivered')).toBe(false);
  await app.inject({ method: 'DELETE', url: '/api/analytics/visitors', headers: { 'x-analytics-visitor': visitor.json<{ credential: string }>().credential } });
  queueProviderAnalytics(app, { alertId: alert.id, accepted: 1, rejected: 0 }); await flushServerAnalytics(app);
  expect(await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'alert_transport_result'))).toHaveLength(0);
});
it('recovers distinct no-device, unfunded, cancelled and charged alert states without claiming delivery', async () => {
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` }, payload: { contextId: randomUUID(),
    scope: 'player', policyVersion: 1, platform: 'android', locale: 'tr', build: 'test', campaign: {} } });
  const { queueServerAnalytics } = await import('../src/services/analyticsServerFacts.js');
  queueServerAnalytics(app, { id: randomUUID(), headers: { 'x-analytics-visitor': visitor.json<{ credential: string }>().credential } },
    { accountId: f.accountIds[0]!, name: 'authenticated_existing' });
  await flushServerAnalytics(app);
  const statuses = ['NO_DEVICE', 'UNFUNDED', 'CANCELLED', 'SENT'] as const;
  await f.db.insert(paidAlerts).values(statuses.map((status): typeof paidAlerts.$inferInsert => ({ playerId: f.playerIds[0]!, kind: 'probe_detected', refId: randomUUID(),
    sendAt: f.clock.now(), createdAt: f.clock.now(), settledAt: f.clock.now(), status, payload: { secret: 'never project this' } })));
  const { recoverAnalyticsCommands } = await import('../src/services/analyticsFacts.js');
  await recoverAnalyticsCommands(f.db, f.clock); await recoverAnalyticsCommands(f.db, f.clock);
  const rows = await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.name, 'alert_state'));
  expect(rows.map(row => row.properties.code).sort()).toEqual([...statuses].sort());
  expect(rows.every(row => row.properties.phase === 'ledger_state')).toBe(true);
  expect(JSON.stringify(rows)).not.toContain('never project this');
});
it('keeps successful account creation distinct from a failed placement', async () => {
  const visitor = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { contextId: randomUUID(),
    scope: 'anonymous', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
  const placement = vi.spyOn(serverPlacement, 'resolveJoinTarget').mockRejectedValue(new GameError('NO_SEASON', 'Fixture unavailable', 409));
  try {
    const reply = await app.inject({ method: 'POST', url: '/api/onboarding/claim',
      headers: { 'x-analytics-visitor': visitor.json<{ credential: string }>().credential },
      payload: { username: 'NoPlacementNova', password: 'Password123', communityPolicyVersion: COMMUNITY_POLICY_VERSION, communityPolicyLocale: 'tr', intents: [] } });
    expect(reply.statusCode).toBe(409); await flushServerAnalytics(app);
    const rows = await f.db.select().from(analyticsEvents);
    expect(rows.filter(row => row.name === 'account_created')).toHaveLength(1);
    expect(rows.filter(row => row.name === 'placement_failed')).toEqual([expect.objectContaining({ properties: { code: 'NO_SEASON' }, source: 'server_fact' })]);
    expect(rows.some(row => row.name === 'placement_completed')).toBe(false);
  } finally { placement.mockRestore(); }
});
