import { analyticsAdminSchema } from '../../web/src/api/analyticsAdminSchemas.js';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { accounts, analyticsEvents, analyticsSessions, analyticsVisitors, botProfiles, players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(accounts).set({ username: 'analyticsowner' }).where(eq(accounts.id, f.accountIds[0]!));
  const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }),
    env: testEnv({ ANALYTICS_ADMIN_ENABLED: 'true', ADMIN_USERNAMES: 'analyticsowner' }) });
  app = built.app; close = built.close; await app.ready();
});
afterEach(async () => { await close(); });
afterAll(async () => { await (await testDb()).close(); });
it('requires admin access and preserves unknown coverage for unmeasured players', async () => {
  expect((await app.inject('/api/admin/analytics')).statusCode).toBe(401);
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[1]!)}` };
  expect((await app.inject({ url: '/api/admin/analytics', headers })).statusCode).toBe(403);
  headers.authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
  const reply = await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers });
  expect(reply.statusCode).toBe(200);
  expect(reply.json()).toMatchObject({ quality: { totalAccounts: 1, measuredAccounts: 0 },
    players: [expect.objectContaining({ accountId: f.accountIds[1], coverage: 'unmeasured', summary: null })] });
});
it('returns eleven training steps, bounded timelines and observed account activity without changing that player', async () => {
  const visitorId = randomUUID(), sessionId = randomUUID(), contextId = randomUUID(), now = f.clock.now();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, credentialHash: randomUUID(), contextId, accountId: f.accountIds[1],
    metadata: { contextId, scope: 'anonymous', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} }, createdAt: now, expiresAt: now });
  await f.db.insert(analyticsSessions).values({ id: sessionId, visitorId, contextId, accountId: f.accountIds[1], firstAt: now, lastAt: now });
  await f.db.insert(analyticsEvents).values({ id: randomUUID(), visitorId, sessionId, accountId: f.accountIds[1], name: 'training_scene_visible',
    source: 'client_observation', mode: 'training', sequence: 0, occurredAt: now, receivedAt: now, timeTrusted: true, payloadHash: 'test', properties: { step: 4, scene: 'sight', attemptId: randomUUID() } });
  const before = await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!));
  const [template] = await f.db.select().from(analyticsEvents);
  if (!template) throw new Error('Missing scene fixture');
  await f.db.insert(analyticsEvents).values(['landing_visible', 'play_clicked'].map(name => ({
    ...template, id: randomUUID(), name, mode: 'live' as const, properties: { surface: 'public_landing' },
  })));
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const reply = await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers });
  expect(reply.statusCode).toBe(200);
  const result = reply.json<{ steps: { step: number; attempts: number }[]; quality: { measuredAccounts: number }; landing: { visibleVisits: number; playVisits: number }; cohorts: { platform: string; visits: number }[] }>();
  expect(result.landing).toMatchObject({ visibleVisits: 1, playVisits: 1 });
  expect(result.cohorts).toContainEqual(expect.objectContaining({ platform: 'web', visits: 1 }));
  expect(result.steps).toHaveLength(11); expect(result.steps.find(s => s.step === 4)?.attempts).toBe(1);
  expect(result.quality.measuredAccounts).toBe(1);
  const timeline = await app.inject({ url: `/api/admin/analytics/accounts/${f.accountIds[1]}/events?limit=1`, headers });
  expect(timeline.statusCode).toBe(200); expect(timeline.json<{ events: unknown[] }>().events).toHaveLength(1);
  expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!))).toEqual(before);
});

it('does not add database reads for every extra account on an admin page', async () => {
  await f.db.insert(accounts).values(Array.from({ length: 8 }, (_, i) => ({ username: `unmeasured${i}`, displayName: `Unmeasured ${i}`, passwordHash: 'unused-fixture', createdAt: f.clock.now() })));
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const one = await app.inject({ url: '/api/admin/analytics?inactiveHours=0&limit=1', headers });
  const many = await app.inject({ url: '/api/admin/analytics?inactiveHours=0&limit=50', headers });
  expect(one.statusCode).toBe(200); expect(many.statusCode).toBe(200);
  expect(many.json<{ players: unknown[] }>().players).toHaveLength(9);
  expect(Number(many.headers['x-db-statements']) - Number(one.headers['x-db-statements'])).toBeLessThanOrEqual(2);
});

it('does not label a newly created unplaced account as absent for twenty-four hours', async () => {
  const [fresh] = await f.db.insert(accounts).values({ username: 'fresh', displayName: 'Fresh', passwordHash: 'unused-fixture', createdAt: f.clock.now() }).returning();
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const reply = await app.inject({ url: '/api/admin/analytics?inactiveHours=24', headers });
  expect(reply.statusCode).toBe(200);
  expect(reply.json<{ players: { accountId: string }[] }>().players.some(p => p.accountId === fresh!.id)).toBe(false);
});

it('filters measured history by build and supports the 48/72 hour absence lists without mixing denominators', async () => {
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  expect((await app.inject({ url: '/api/admin/analytics?inactiveHours=48', headers })).statusCode).toBe(200);
  expect((await app.inject({ url: '/api/admin/analytics?inactiveHours=72', headers })).statusCode).toBe(200);
  const now = f.clock.now(), contextId = randomUUID();
  await f.db.insert(analyticsVisitors).values({ contextId, credentialHash: randomUUID(), accountId: f.accountIds[1],
    metadata: { contextId, scope: 'anonymous', policyVersion: 1, platform: 'web', locale: 'tr', build: 'old-build', campaign: { utm_source: 'twitter' } }, createdAt: now, expiresAt: now });
  const empty = await app.inject({ url: '/api/admin/analytics?inactiveHours=0&build=new-build', headers });
  expect(empty.statusCode).toBe(200);
  expect(empty.json()).toMatchObject({ players: [], cohorts: [], quality: { measuredAccounts: 0, visits: 0 } });
  const old = await app.inject({ url: '/api/admin/analytics?inactiveHours=0&build=old-build&source=twitter&platform=web', headers });
  expect(old.statusCode).toBe(200);
  expect(old.json()).toMatchObject({ players: [expect.objectContaining({ accountId: f.accountIds[1] })],
    cohorts: [expect.objectContaining({ build: 'old-build', source: 'twitter', visits: 1 })], quality: { measuredAccounts: 1, visits: 1 } });
});

it('keeps starter scenes separate and counts sessions, return, permission and crates', async () => {
  const now = f.clock.now(), accountId = f.accountIds[1]!, contextId = randomUUID(), visitorId = randomUUID(), first = randomUUID(), second = randomUUID();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, credentialHash: randomUUID(), contextId, accountId,
    metadata: { contextId, scope: 'player', policyVersion: 1, platform: 'android', locale: 'tr', build: 'test', campaign: {} }, createdAt: now, expiresAt: now });
  await f.db.insert(analyticsSessions).values([first, second].map(id => ({ id, visitorId, contextId, accountId, firstAt: now, lastAt: now })));
  const rows = [
    { name: 'foreground_started', properties: {}, sessionId: first },
    { name: 'foreground_started', properties: {}, sessionId: second },
    { name: 'training_scene_visible', properties: { scene: 'welcome', trainingVersion: 'starter-tutorial.v1' }, sessionId: first },
    { name: 'training_scene_visible', properties: { scene: 'openCrates', trainingVersion: 'starter-tutorial.v1' }, sessionId: first },
    { name: 'training_scene_visible', properties: { scene: 'welcome', step: 1, trainingVersion: 'flight-school.v1' }, sessionId: second },
    { name: 'alert_permission', properties: { variant: 'push', code: 'granted' }, sessionId: first },
    { name: 'outcome_visible', properties: { surface: 'starter_crate', count: 2 }, sessionId: first },
  ];
  await f.db.insert(analyticsEvents).values(rows.map((row, sequence) => ({ ...row, id: randomUUID(), visitorId, accountId, source: 'client_observation' as const, mode: 'live' as const, sequence, occurredAt: now, receivedAt: now, timeTrusted: true, payloadHash: String(sequence) })));
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const response = await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers });
  expect(response.statusCode).toBe(200);
  const body = analyticsAdminSchema.parse(response.json<unknown>());
  expect(body).toMatchObject({ starter: { accounts: 1, sessions: 2, returnedAccounts: 1, push: { asked: 1, granted: 1, denied: 0 }, crates: { accounts: 1, opened: 2 } } });
  expect(body.starter?.steps).toContainEqual({ scene: 'welcome', accounts: 1, dropoff: 0 });
  expect(body.starter?.steps).toContainEqual({ scene: 'openCrates', accounts: 1, dropoff: 0 });
});

it('follows a ship order to its result, to the player reading it, to the next order, and measures the first haul net', async () => {
  const now = f.clock.now(), later = new Date(now.getTime() + 60_000);
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  async function pilot(accountId: string, rows: { name: string; source: 'client_observation' | 'server_fact'; properties: Record<string, unknown>; at?: Date }[]) {
    const contextId = randomUUID(), visitorId = randomUUID();
    await f.db.insert(analyticsVisitors).values({ id: visitorId, credentialHash: randomUUID(), contextId, accountId,
      metadata: { contextId, scope: 'player', policyVersion: 1, platform: 'web', locale: 'tr', build: 'test', campaign: {} }, createdAt: now, expiresAt: new Date(now.getTime() + 86400000) });
    await f.db.insert(analyticsSessions).values({ id: visitorId, visitorId, contextId, accountId, firstAt: now, lastAt: now });
    await f.db.insert(analyticsEvents).values([{ name: 'vessel_enlisted', source: 'client_observation' as const, properties: {} }, ...rows].map((row, sequence) => ({
      name: row.name, source: row.source, properties: row.properties, id: randomUUID(), visitorId, sessionId: visitorId, accountId, mode: 'live' as const, sequence,
      occurredAt: 'at' in row && row.at ? row.at : now, receivedAt: now, timeTrusted: true, payloadHash: String(sequence) })));
  }
  const [one, two] = [randomUUID(), randomUUID()];
  await pilot(f.accountIds[1]!, [
    { name: 'command_accepted', source: 'server_fact', properties: { subject: 'VESSEL_MINE', code: 'MINE', count: 1, refId: one } },
    { name: 'outcome_resolved', source: 'server_fact', properties: { subject: 'VESSEL_MINE', code: 'FLEET_HOME', count: 0, value: 40, refId: one } },
    { name: 'outcome_visible', source: 'client_observation', properties: { refId: one, surface: 'toast', code: 'FLEET_HOME' } },
    { name: 'command_accepted', source: 'server_fact', properties: { code: 'collect', phase: 'response_confirmed' }, at: later },
  ]);
  const [extra] = await f.db.insert(accounts).values({ username: `pilot_${randomUUID().slice(0, 8)}`, passwordHash: 'x', displayName: 'Pilot' }).returning();
  await pilot(extra!.id, [
    { name: 'command_accepted', source: 'server_fact', properties: { subject: 'VESSEL_MINE', code: 'MINE', count: 1, refId: two } },
    { name: 'outcome_resolved', source: 'server_fact', properties: { subject: 'VESSEL_MINE', code: 'FLEET_HOME', count: 12, value: 0, refId: two } },
    // Another result the player read does not stand for this one.
    { name: 'outcome_visible', source: 'client_observation', properties: { refId: randomUUID(), surface: 'signals', code: 'REPAIR_DONE' } },
  ]);
  const response = await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers });
  expect(response.statusCode).toBe(200);
  const body = analyticsAdminSchema.parse(response.json<unknown>());
  expect(body.starter).toMatchObject({ chain: { accepted: 2, resolved: 2, viewed: 1, decided: 1 }, mining: { returned: 2, gained: 1, wasted: 1 } });
});

it('reports the sign-up cohort beside the first-ready one, without the admin or a bot in it', async () => {
  const headers = { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
  const [bot] = await f.db.insert(accounts).values({ username: `bot_${randomUUID().slice(0, 8)}`, passwordHash: 'x', displayName: 'Bot' }).returning();
  await f.db.insert(botProfiles).values({ accountId: bot!.id, ordinal: 900_002, persona: 'steady', nextActionAt: f.clock.now(), createdAt: f.clock.now() });
  await f.db.update(accounts).set({ createdAt: f.clock.now() });
  const body = analyticsAdminSchema.parse((await app.inject({ url: '/api/admin/analytics?inactiveHours=0', headers })).json<unknown>());
  expect(body.signups).toMatchObject({ accounts: 1, measured: 0, d1: { mature: 0, returned: 0, pending: 0 } });
});
