import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { purgeAnalytics } from '../src/services/playerAnalytics.js';
import * as dailyAnalytics from '../src/services/analyticsDaily.js';

describe('first-party analytics isolation', () => {
  let f: Fixture, app: FastifyInstance, close: () => Promise<void>;
  const contextId = randomUUID(), sessionId = randomUUID();
  const visit = { scope: 'anonymous', policyVersion: 1, contextId, platform: 'web', locale: 'tr', build: 'test', campaign: {} };
  const event = () => ({ id: randomUUID(), version: 1, name: 'game_ready', source: 'client_observation', mode: 'live',
    contextId, sessionId, sequence: 1, occurredAt: f.clock.now().getTime(), elapsedMs: 0, properties: {} });
  beforeEach(async () => {
    f = await seedWorld(2, 9012);
    const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ANALYTICS_ENABLED: 'true' }) });
    app = built.app; close = built.close; await app.ready();
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { await (await testDb()).close(); });
  const grant = async () => {
    const reply = await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { ...visit, scope: 'player' }, headers: { authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` } });
    expect(reply.statusCode).toBe(201);
    return reply.json<{ visitorId: string; credential: string }>();
  };
  it('requires a valid scope and a private visit credential', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: { ...visit, scope: 'invalid' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', payload: { events: [event()] } })).statusCode).toBe(401);
  });
  it('deduplicates events and never renews gameplay presence or progress', async () => {
    const g = await grant();
    const before = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    f.clock.advance(1);
    const headers = { 'x-analytics-visitor': g.credential, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
    const payload = { events: [event()] };
    for (let i = 0; i < 2; i++) expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload })).statusCode).toBe(200);
    expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!))).toEqual(before);
    const rows = await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_events WHERE visitor_id=${g.visitorId}::uuid`);
    expect(rows[0]?.n).toBe(1);
    expect(app.metrics.status().operations['analytics.events']).toEqual({ accepted: 1, duplicate: 1 });
  });
  it('refuses a changed replay, a foreign context, and a different account linking the same visit', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
    const e = event();
    const post = (events: object[], h = headers) => app.inject({ method: 'POST', url: '/api/analytics/events', headers: h, payload: { events } });
    expect((await post([e])).statusCode).toBe(200);
    expect((await post([{ ...e, name: 'surface_visible' }])).statusCode).toBe(409);
    expect((await post([{ ...event(), contextId: randomUUID() }])).statusCode).toBe(403);
    expect((await post([event()], { ...headers, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[1]!)}` })).statusCode).toBe(403);
  });
  it('keeps the same private visit writable after a verified binding when no bearer session has opened yet', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event()] } })).statusCode).toBe(200);
    const next = { ...event(), name: 'surface_visible', properties: { surface: 'placement_error' } };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers: { 'x-analytics-visitor': g.credential }, payload: { events: [next] } })).statusCode).toBe(200);
    const { analyticsEvents } = await import('../src/db/schema.js');
    expect((await f.db.select().from(analyticsEvents).where(eq(analyticsEvents.id, next.id)))[0]?.accountId).toBe(f.accountIds[0]);
  });
  it('revokes queued delivery and removes linked raw observations', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event()] } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: '/api/analytics/visitors', headers })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event()] } })).statusCode).toBe(401);
    expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_events WHERE visitor_id=${g.visitorId}::uuid`))[0]?.n).toBe(0);
  });
  it('expires the capability, bounds payloads and removes raw data before day thirty', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers,
      payload: { events: Array.from({ length: 33 }, event) } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers,
      payload: { events: [event()], padding: 'x'.repeat(33 * 1024) } })).statusCode).toBe(413);
    f.clock.advance(24 * 60 + 1);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event()] } })).statusCode).toBe(401);
    f.clock.advance(30 * 24 * 60);
    await purgeAnalytics(f.db, f.clock);
    expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_visitors WHERE id=${g.visitorId}::uuid`))[0]?.n).toBe(0);
  });
  it('keeps suspect client time separately and does not label delayed observations with current placement', async () => {
    const g = await grant();
    const sent = { ...event(), occurredAt: 0 };
    const headers = { 'x-analytics-visitor': g.credential, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [sent] } })).statusCode).toBe(200);
    const [row] = await f.db.execute<{ client_at: number; player_id: string | null; time_trusted: boolean }>(sql`SELECT client_at, player_id, time_trusted FROM analytics_events WHERE id=${sent.id}::uuid`);
    expect(row).toMatchObject({ client_at: 0, player_id: null, time_trusted: false });
  });
  it('still expires old visits when rebuilding daily totals fails at server startup', async () => {
    const g = await grant(); f.clock.advance(31 * 24 * 60);
    const refresh = vi.spyOn(dailyAnalytics, 'refreshDailyAnalytics').mockRejectedValueOnce(new Error('Optional summary unavailable'));
    try {
      await app.listen({ host: '127.0.0.1', port: 0 });
      await vi.waitFor(async () => {
        const rows = await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_visitors WHERE id=${g.visitorId}::uuid`);
        expect(rows[0]?.n).toBe(0);
      });
      expect(refresh).toHaveBeenCalledOnce();
    } finally { refresh.mockRestore(); }
  });
  it('deletes expired visits in bounded statements instead of one mass cascade', async () => {
    const indexes = await f.db.execute<{ indexname: string }>(sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('analytics_visitors','paid_alerts')`);
    expect(indexes.map(row => row.indexname)).toContain('analytics_visitors_created_idx');
    expect(indexes.map(row => row.indexname)).toContain('paid_alerts_analytics_settled_idx');
    const { analyticsVisitors } = await import('../src/db/schema.js');
    const old = new Date(f.clock.now().getTime() - 31 * 86400000);
    await f.db.insert(analyticsVisitors).values(Array.from({ length: 257 }, () => {
      const contextId = randomUUID();
      return { contextId, credentialHash: randomUUID(), createdAt: old, expiresAt: old,
        metadata: { ...visit, contextId, scope: 'anonymous' as const, policyVersion: 1 as const, platform: 'web' as const } };
    }));
    await f.db.execute(sql`CREATE FUNCTION analytics_test_delete_bound() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF (SELECT count(*) FROM removed_visits) > 256 THEN RAISE EXCEPTION 'unbounded analytics deletion'; END IF; RETURN NULL; END $$`);
    await f.db.execute(sql`CREATE TRIGGER analytics_test_delete_bound AFTER DELETE ON analytics_visitors
      REFERENCING OLD TABLE AS removed_visits FOR EACH STATEMENT EXECUTE FUNCTION analytics_test_delete_bound()`);
    try {
      await purgeAnalytics(f.db, f.clock);
      expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_visitors`))[0]?.n).toBe(0);
    } finally {
      await f.db.execute(sql`DROP TRIGGER analytics_test_delete_bound ON analytics_visitors`);
      await f.db.execute(sql`DROP FUNCTION analytics_test_delete_bound()`);
    }
  });
  it('takes a bounded number of database statements for a full batch, and serializes concurrent retries', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential };
    const payload = { events: Array.from({ length: 32 }, (_, sequence) => ({ ...event(), sequence })) };
    const responses = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload })));
    expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
    const accepted = responses.map(r => r.json<{ accepted: number }>().accepted);
    expect(accepted.sort((a, b) => a - b)).toEqual([0, 32]);
    expect(Number(responses.find(r => r.json<{ accepted: number }>().accepted === 32)?.headers['x-db-statements'])).toBeLessThanOrEqual(12);
  });
  it('removes account-linked raw observations when the actual account erasure service runs', async () => {
    const g = await grant();
    const headers = { 'x-analytics-visitor': g.credential, authorization: `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}` };
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events', headers, payload: { events: [event()] } })).statusCode).toBe(200);
    const { accounts, buildOrders } = await import('../src/db/schema.js');
    const { upgradeBuilding } = await import('../src/services/build.js');
    await upgradeBuilding(f.db, f.planetIds[1]!, 'CORE', f.clock);
    // A surviving order on somebody else's world keeps its original actor snapshot after control changes.
    await f.db.update(buildOrders).set({ actorAccountId: f.accountIds[0]!, actorPlayerId: f.playerIds[0]!,
      actorSeasonId: f.seasonId, analyticsVisitHash: 'original-visit', analyticsAttemptId: randomUUID() });
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
    if (!account) throw new Error('Missing account fixture');
    const { deleteAccount } = await import('../src/services/accountDeletion.js');
    await deleteAccount(f.db, f.clock, account.username);
    expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_visitors WHERE id=${g.visitorId}::uuid`))[0]?.n).toBe(0);
    expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_events WHERE visitor_id=${g.visitorId}::uuid`))[0]?.n).toBe(0);
    expect((await f.db.select().from(buildOrders))[0]).toMatchObject({ orderedAt: f.clock.now(), status: 'BUILDING',
      actorAccountId: null, actorPlayerId: null, actorSeasonId: null, analyticsVisitHash: null, analyticsAttemptId: null });
  });
  it('keeps collection disabled by default', async () => {
    const g = await grant();
    await close();
    const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv() });
    app = built.app; close = built.close; await app.ready();
    expect((await app.inject({ method: 'POST', url: '/api/analytics/visitors', payload: visit })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/api/analytics/visitors', headers: { 'x-analytics-visitor': g.credential } })).statusCode).toBe(204);
    expect((await f.db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM analytics_visitors WHERE id=${g.visitorId}::uuid`))[0]?.n).toBe(0);
  });
  it('cannot bypass visit issuance limits by rotating untrusted headers', async () => {
    for (let i = 0; i < 12; i++) expect((await app.inject({ method: 'POST', url: '/api/analytics/visitors',
      headers: { 'x-analytics-visitor': randomUUID() }, payload: visit })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/visitors',
      headers: { 'x-analytics-visitor': randomUUID() }, payload: visit })).statusCode).toBe(429);
  });
  it('bounds forged visit keys by caller address before they can grow independent context budgets', async () => {
    for (let i = 0; i < 120; i++) {
      const reply = await app.inject({ method: 'POST', url: '/api/analytics/events', remoteAddress: '10.61.1.9',
        headers: { 'x-analytics-visitor': `forged${String(i)}`.padEnd(43, 'x') }, payload: { events: [event()] } });
      expect(reply.statusCode).toBe(401);
    }
    const refused = await app.inject({ method: 'POST', url: '/api/analytics/events', remoteAddress: '10.61.1.9',
      headers: { 'x-analytics-visitor': 'different'.padEnd(43, 'x') }, payload: { events: [event()] } });
    expect(refused.statusCode).toBe(429);
  });
  it('limits delivery per context and across contexts of one account', async () => {
    const grants = await Promise.all([grant(), grant(), grant()]);
    const authorization = `Bearer ${await app.tokens.issueAccess(f.accountIds[0]!)}`;
    for (const g of grants.slice(0, 2)) {
      const visitSession = randomUUID();
      for (let i = 0; i < 6; i++) expect((await app.inject({ method: 'POST', url: '/api/analytics/events',
        headers: { authorization, 'x-analytics-visitor': g.credential }, payload: { events: [{ ...event(), sessionId: visitSession }] } })).statusCode).toBe(200);
    }
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events',
      headers: { authorization, 'x-analytics-visitor': grants[2].credential }, payload: { events: [event()] } })).statusCode).toBe(429);
    expect((await app.inject({ method: 'POST', url: '/api/analytics/events',
      headers: { 'x-analytics-visitor': grants[0].credential }, payload: { events: [event()] } })).statusCode).toBe(429);
  });
});
