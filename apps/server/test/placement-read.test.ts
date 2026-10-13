import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { players } from '../src/db/schema.js';
import { PLACEMENT_READ_ROUTES } from '../src/services/placementGate.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL } from './helpers.js';

/**
 * HOT READS DO NOT QUEUE FOR A PLACEMENT LEASE. Resource analysis 2026-10-13.
 *
 * Every authenticated handler used to hold one of two placement connections per API
 * for its whole duration: placement start p95 was 1.3–1.6 s while the ordinary pool
 * answered in 0.5 ms, and a cache-hit traffic read waited behind a planet view. A
 * read now checks the placement before and after the handler instead. A relocation
 * bumps `placement_version` in the same transaction that moves the commander, so any
 * read statement that saw the moved state implies the after-check sees the new
 * version — the response is refused, exactly as a stale header is.
 */
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { vi.restoreAllMocks(); await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });

async function appFor(f: Awaited<ReturnType<typeof seedWorld>>, env: Record<string, string> = {}) {
  built = buildApp({ db: f.db, env: testEnv(env), clock: f.clock, logger: pino({ level: 'silent' }) });
  return `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
}

it('answers a hot read while a relocation holds the exclusive placement fence', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f);
  let outcome: { statusCode: number } | 'blocked' | undefined;
  let pending: Promise<unknown> | undefined;
  await f.db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${f.seasonId}`}, 0))`);
    const request = built!.app.inject({ url: '/api/galaxy/traffic', headers: { authorization } });
    pending = request;
    outcome = await Promise.race([request, delay(2_000).then(() => 'blocked' as const)]);
  });
  await pending;
  expect(outcome).not.toBe('blocked');
  expect(outcome === 'blocked' ? 0 : outcome?.statusCode).toBe(200);
});

it('answers a hot read while every placement connection is held by a write', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f, { PLACEMENT_POOL_MAX: '1' });
  const { requireAuth } = await import('../src/routes/auth.js');
  let release = () => { /* assigned synchronously by the promise constructor */ };
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false;
  built!.app.post('/api/placement-hold-test', { preHandler: requireAuth }, async () => {
    entered = true;
    await held;
    return { ok: true };
  });
  const hold = built!.app.inject({ method: 'POST', url: '/api/placement-hold-test', headers: { authorization } });
  try {
    await vi.waitFor(() => { expect(entered).toBe(true); }, { timeout: 2000 });
    const read = built!.app.inject({ url: '/api/mining/field', headers: { authorization } });
    const outcome = await Promise.race([read, delay(2_000).then(() => 'blocked' as const)]);
    expect(outcome === 'blocked' ? 'blocked' : outcome.statusCode).toBe(200);
  } finally {
    release();
    await hold;
  }
});

it('refuses a read whose galaxy moved while it was being answered', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f);
  const original = built!.projections.trafficSnapshot.bind(built!.projections);
  vi.spyOn(built!.projections, 'trafficSnapshot').mockImplementation(async (...args) => {
    // A relocation commits mid-response: same transaction bumps the version.
    await f.db.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
    return original(...args);
  });
  const response = await built!.app.inject({ url: '/api/galaxy/traffic', headers: { authorization } });
  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
});

it('keeps the stale-header rule and publishes the placement on hot reads', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f);
  await f.db.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
  const stale = await built!.app.inject({ url: '/api/galaxy/traffic', headers: { authorization } });
  expect(stale.statusCode).toBe(409);
  expect(stale.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
  const current = await built!.app.inject({ url: '/api/galaxy/traffic',
    headers: { authorization, 'x-placement': `${f.playerIds[0]}:1` } });
  expect(current.statusCode).toBe(200);
  expect(current.headers['x-placement']).toBe(`${f.playerIds[0]}:1`);
});

it('lists only registered routes that read without writes, row locks or a placement lease', async () => {
  const f = await seedWorld(1);
  const wire: string[] = [];
  const client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  try {
    built = buildApp({ db: drizzle(client, { schema }), env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
    const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
    // Spend presence's once-a-minute stamp: that write belongs to authentication.
    expect((await built.app.inject({ url: '/api/season', headers: { authorization } })).statusCode).toBe(200);
    expect(PLACEMENT_READ_ROUTES.size).toBeGreaterThan(10);
    for (const key of PLACEMENT_READ_ROUTES) {
      const [method, path] = key.split(' ') as [string, string];
      expect(method).toBe('GET');
      wire.length = 0;
      const response = await built.app.inject({ url: path.replace(':planetId', f.planetIds[0]!), headers: { authorization } });
      expect(response.statusCode, key).toBe(200);
      expect(wire.filter(query =>
        /\bfor (update|share|no key update|key share)\b|^\s*(update|insert|delete)\b|advisory/.test(query)), key).toEqual([]);
    }
  } finally {
    await built?.close();
    built = undefined;
    await client.end();
  }
});
