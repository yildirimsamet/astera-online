import { performance } from 'node:perf_hooks';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv } from './helpers.js';
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });
it('rejects old browser intents after relocation and publishes the current placement on me', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  await built.app.ready();
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  await f.db.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
  const old = await built.app.inject({ method: 'POST', url: `/api/planets/${f.planetIds[0]!}/collect`, headers: { authorization } });
  expect(old.statusCode).toBe(409);
  expect(old.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
  const me = await built.app.inject({ url: '/api/auth/me', headers: { authorization } });
  expect(me.statusCode).toBe(200);
  expect(me.headers['x-placement']).toBe(`${f.playerIds[0]}:1`);
  const current = await built.app.inject({ url: '/api/galaxy', headers: { authorization, 'x-placement': `${f.playerIds[0]}:1` } });
  expect(current.statusCode).toBe(200);
});
it('keeps the galaxy placement stable throughout an authenticated handler', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  let locked = false;
  built.app.get('/api/placement-test', { preHandler: requireAuth }, async () => {
    locked = await f.db.transaction(async tx => {
      const [row] = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(hashtextextended(${`placement:${f.seasonId}`}, 0)) as acquired`);
      return row?.acquired === false;
    });
    return { ok: true };
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  expect((await built.app.inject({ url: '/api/placement-test', headers: { authorization } })).statusCode).toBe(200);
  expect(locked).toBe(true);
});

it.each<{ configuration: Record<string, string>; capacity: number }>([
  { configuration: {}, capacity: 2 },
  { configuration: { PLACEMENT_POOL_MAX: '3' }, capacity: 3 },
])('bounds concurrent handlers at $capacity and releases queued requests', async ({ configuration, capacity }) => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(configuration), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  let release = () => { /* assigned synchronously by the promise constructor */ };
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = 0;
  let requested = 0;
  built.app.get('/api/placement-capacity-test', {
    preHandler: [requireAuth, (_req, _reply, done) => { requested += 1; done(); }],
  }, async () => {
    entered += 1;
    await held;
    return { ok: true };
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const requests = Array.from({ length: capacity + 1 }, () =>
    built!.app.inject({ url: '/api/placement-capacity-test', headers: { authorization } }).then(response => response),
  );
  try {
    await vi.waitFor(() => {
      expect(requested).toBe(capacity + 1);
      expect(entered).toBe(capacity);
    }, { timeout: 2000 });
    expect(built.metrics.status().placementPool.transactionStartMs.samples).toBe(capacity);
  } finally {
    release();
    await Promise.all(requests);
  }
  const responses = await Promise.all(requests);
  expect(responses.every(response => response.statusCode === 200)).toBe(true);
  expect(built.metrics.status().placementPool).toMatchObject({
    transactionStartErrors: 0, transactionStartMs: { samples: capacity + 1 },
  });
  const metrics = await built.app.inject('/metrics');
  expect(metrics.json()).toMatchObject({ database: {
    configuredPlacementPoolMax: capacity,
    placementTransactionStartErrors: 0,
    placementTransactionStartMs: { samples: capacity + 1 },
  } });
});

it('releases a failed handler lease without counting it as a transaction startup failure', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv({ PLACEMENT_POOL_MAX: '1' }), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  let attempts = 0;
  built.app.get('/api/placement-failure-test', { preHandler: requireAuth }, () => {
    if (++attempts === 1) throw new Error('handler failed');
    return Promise.resolve({ ok: true });
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  expect((await built.app.inject({ url: '/api/placement-failure-test', headers: { authorization } })).statusCode).toBe(500);
  expect((await built.app.inject({ url: '/api/placement-failure-test', headers: { authorization } })).statusCode).toBe(200);
  expect(built.metrics.status().placementPool).toMatchObject({
    transactionStartErrors: 0, transactionStartMs: { samples: 2 },
  });
});
it('invalidates a warm commander projection even before the transfer notification arrives', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  built.app.get('/api/placement-cache-test', { preHandler: requireAuth }, async () => built!.projections.commander(f.accountIds[0]!));
  await built.bus.start();
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  await built.app.inject({ url: '/api/placement-cache-test', headers: { authorization } });
  const { createSeason } = await import('../src/services/season.js');
  const { planets } = await import('../src/db/schema.js');
  const target = await createSeason(f.db, { shardCode: 'CACHE-WAIT', seed: 7, startsAt: f.clock.now(), role: 'WAITING' });
  await f.db.update(players).set({ placementVersion: 1, seasonId: target.season.id });
  await f.db.update(planets).set({ seasonId: target.season.id }).where(eq(planets.id, f.planetIds[0]!));
  const current = await built.app.inject({ url: '/api/placement-cache-test', headers: { authorization, 'x-placement': `${f.playerIds[0]}:1` } });
  expect(current.json()).toMatchObject({ seasonId: target.season.id });
});

/** Scaling plan F1.6: under overload the lease queue answers instead of growing without bound. */
it('refuses a request that waited two seconds for a lease as retryable, and leaks no lease', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv({ PLACEMENT_POOL_MAX: '1' }), db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  let release = () => { /* assigned synchronously by the promise constructor */ };
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = 0;
  built.app.get('/api/placement-queue-test', { preHandler: requireAuth }, async () => {
    if (++entered === 1) await held;
    return { ok: true };
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const holder = built.app.inject({ url: '/api/placement-queue-test', headers: { authorization } });
  await vi.waitFor(() => { expect(entered).toBe(1); });
  const startedAt = performance.now();
  const queued = await built.app.inject({ url: '/api/placement-queue-test', headers: { authorization } });
  const waited = performance.now() - startedAt;
  release();
  expect(queued.statusCode).toBe(503);
  expect(queued.json()).toMatchObject({ error: 'RETRYABLE' });
  expect(waited).toBeGreaterThanOrEqual(1_900);
  expect(waited).toBeLessThan(3_000);
  expect(entered).toBe(1);
  expect((await holder).statusCode).toBe(200);
  expect((await built.app.inject({ url: '/api/placement-queue-test', headers: { authorization } })).statusCode).toBe(200);
  expect(built.metrics.status().placementPool.transactionStartErrors).toBe(1);
});
