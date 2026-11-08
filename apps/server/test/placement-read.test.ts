import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { accounts, monuments, monumentWaves, players, seasons, watches } from '../src/db/schema.js';
import { sendMonument } from '../src/services/monument.js';
import { PLACEMENT_READ_ROUTES } from '../src/services/placementGate.js';
import { giveInstrument, giveSatellite, giveUnits, grant, seedWorld, setLevel, testDb, testEnv, TEST_DATABASE_URL } from './helpers.js';

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

/**
 * THE READS THAT 503'D AT 200 COMMANDERS. Load run 2026-11-03.
 *
 * These only read, yet held one of two lease connections for their whole handler, so
 * at 200 commanders they queued two seconds behind one another and were refused. Each
 * was checked by reading its handler: `/api/intel`'s one write is the guarded telescope
 * confirmation `/api/galaxy` makes, and the rest write nothing. `/api/monuments` is not
 * here: it applies due transitions on read.
 */
it.each(['/api/intel', '/api/unknown-signals', '/api/return-applications', '/api/commander-ship'])(
  'answers %s while every placement connection is held by a write', async (url) => {
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
      const read = built!.app.inject({ url, headers: { authorization } });
      const outcome = await Promise.race([read, delay(1_000).then(() => 'blocked' as const)]);
      expect(outcome === 'blocked' ? 'blocked' : outcome.statusCode).toBe(200);
    } finally {
      release();
      await hold;
    }
  });

/**
 * THE REST OF WHAT 503'D AT 150–250 COMMANDERS. Load run 2026-11-04.
 *
 * Almost every 5xx of that run was this queue, on routes that were 6.5 % of the requests.
 * Each handler below was read for writes: none has one, except the two whose write needs a
 * lease only when it happens (see below). The maintenance notice and a session refresh
 * have nothing to do with a placement at all.
 */
async function whileLeaseHeld<T>(f: Awaited<ReturnType<typeof seedWorld>>, run: (authorization: string) => Promise<T>): Promise<T> {
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
    return await run(authorization);
  } finally {
    release();
    await hold;
  }
}

it.each(['/api/maintenance', '/api/servers', '/api/session/brand-recall', '/api/session/return', '/api/clan/support',
  '/api/chat/messages', '/api/dm/conversations', '/api/community/policy', '/api/leaderboard', '/api/announcements',
  '/api/chronicle', '/api/monuments', '/api/legacy/me/reveals'])(
  'answers %s while every placement connection is held by a write', async (url) => {
    const f = await seedWorld(1);
    const outcome = await whileLeaseHeld(f, async authorization => {
      const read = built!.app.inject({ url, headers: { authorization } });
      return Promise.race([read, delay(1_000).then(() => 'blocked' as const)]);
    });
    expect(outcome === 'blocked' ? 'blocked' : outcome.statusCode).toBe(200);
  });

it('answers a session refresh while every placement connection is held by a write', async () => {
  const f = await seedWorld(1);
  const outcome = await whileLeaseHeld(f, async authorization => {
    const refresh = built!.app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { authorization } });
    return Promise.race([refresh, delay(1_000).then(() => 'blocked' as const)]);
  });
  // No cookie here: reaching the handler at all is the point.
  expect(outcome === 'blocked' ? 'blocked' : outcome.json()).toMatchObject({ error: 'NO_SESSION' });
});

/**
 * A READ THAT ONLY SOMETIMES WRITES ASKS FOR THE LEASE WHEN IT DOES.
 *
 * `/api/monuments` applies a transition that fell due, and the first reveal read of a
 * session evaluates the ledger. Neither happens on the ordinary read, so the ordinary read
 * holds nothing. The moment a write is needed the attempt is dropped and answered again
 * under the lease, so a write never straddles a relocation.
 */
it('evaluates the legacy ledger only under the lease', async () => {
  const f = await seedWorld(1);
  let pending: Promise<{ statusCode: number }> | undefined;
  const outcome = await whileLeaseHeld(f, async authorization => {
    pending = built!.app.inject({ url: '/api/legacy/me/reveals?refresh=1', headers: { authorization } });
    return Promise.race([pending, delay(500).then(() => 'blocked' as const)]);
  });
  expect(outcome).toBe('blocked');
  expect((await pending!).statusCode).toBe(200);
});

it('evaluates the legacy ledger for a commander with no galaxy', async () => {
  const f = await seedWorld(1);
  await appFor(f);
  const [account] = await f.db.insert(accounts).values({ username: 'no_galaxy', passwordHash: 'disabled', displayName: 'Nobody' }).returning();
  const authorization = `Bearer ${await built!.app.tokens.issueAccess(account!.id)}`;
  const response = await built!.app.inject({ url: '/api/legacy/me/reveals?refresh=1', headers: { authorization } });
  expect(response.statusCode).toBe(200);
});

describe('a commander with a wave at a monument', () => {
  async function waveOut() {
    const f = await seedWorld(2, 20261010);
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, f.planetIds[0]!, 'HANGAR', 10);
    await grant(f.db, f.planetIds[0]!, 100000, 100000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 20, COURIER: 10 });
    const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, difficulty: 'HARD',
      x: 6000, y: 0, z: 0, capacity: 7270, productionPerMinute: 8, garrison: {}, settledAt: f.clock.now() }).returning();
    const { wave } = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      monumentId: target!.id, fleet: { DART: 2 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
    return { f, wave };
  }

  it('reads it without a lock or a write while nothing is due', async () => {
    const { f } = await waveOut();
    const wire: string[] = [];
    const client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
      debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
    try {
      built = buildApp({ db: drizzle(client, { schema }), env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
      const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
      expect((await built.app.inject({ url: '/api/season', headers: { authorization } })).statusCode).toBe(200);
      wire.length = 0;
      const response = await built.app.inject({ url: '/api/monuments', headers: { authorization } });
      expect(response.statusCode).toBe(200);
      expect(response.json<{ waves: unknown[] }>().waves).toHaveLength(1);
      expect(wire.filter(query =>
        /\bfor (update|share|no key update|key share)\b|^\s*(update|insert|delete)\b|advisory/.test(query))).toEqual([]);
    } finally {
      await built?.close();
      built = undefined;
      await client.end();
    }
  });

  it('does not queue behind a writer of the season row', async () => {
    const { f } = await waveOut();
    const authorization = await appFor(f);
    let outcome: { statusCode: number } | 'blocked' | undefined;
    await f.db.transaction(async tx => {
      await tx.update(seasons).set({ spawnGateThrough: f.clock.now() }).where(eq(seasons.id, f.seasonId));
      const read = built!.app.inject({ url: '/api/monuments', headers: { authorization } });
      outcome = await Promise.race([read, delay(1_000).then(() => 'blocked' as const)]);
    });
    expect(outcome === 'blocked' ? 'blocked' : outcome?.statusCode).toBe(200);
  });

  it('takes the lease to apply a transition that fell due, and applies it', async () => {
    const { f, wave } = await waveOut();
    f.clock.set(new Date(new Date(wave.arriveAt!).getTime() + 1_000));
    let pending: Promise<{ statusCode: number }> | undefined;
    const outcome = await whileLeaseHeld(f, async authorization => {
      pending = built!.app.inject({ url: '/api/monuments', headers: { authorization } });
      return Promise.race([pending, delay(500).then(() => 'blocked' as const)]);
    });
    expect(outcome).toBe('blocked');
    expect((await pending!).statusCode).toBe(200);
    const [after] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, wave.id));
    expect(after!.status).not.toBe('OUTBOUND');
  });
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

it('still answers a stale client on the return status, which is how it finds its way back', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f);
  const response = await built!.app.inject({ url: '/api/return-applications', headers: { authorization, 'x-placement': 'stale:999' } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ placement: { playerId: f.playerIds[0] } });
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

/**
 * THE GALAXY IS A READ WITH ONE GUARDED WRITE. Capacity fix plan, item 3 (2026-11-01).
 *
 * `/api/galaxy` held a placement lease only because it confirms telescope readings, and
 * a 150-commander opening wave queued behind two lease slots and failed with 503. The
 * confirmation is one statement that re-reads each watch under its row lock and skips
 * any a relocation has detached, so it cannot write across a move; the read checks the
 * placement before and after like every other hot read.
 */
async function watching(f: Awaited<ReturnType<typeof seedWorld>>) {
  for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
  await giveInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', 5);
  await giveSatellite(f.db, f.planetIds[0]!, 'UPLINK');
  await f.db.insert(watches).values({ observerPlayerId: f.playerIds[0]!, observerPlanetId: f.planetIds[0]!,
    targetPlanetId: f.planetIds[1]!, slot: 0 });
}

it('answers the galaxy while a relocation holds the exclusive placement fence', async () => {
  const f = await seedWorld(1);
  const authorization = await appFor(f);
  let outcome: { statusCode: number } | 'blocked' | undefined;
  let pending: Promise<unknown> | undefined;
  await f.db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${f.seasonId}`}, 0))`);
    const request = built!.app.inject({ url: '/api/galaxy', headers: { authorization } });
    pending = request;
    outcome = await Promise.race([request, delay(2_000).then(() => 'blocked' as const)]);
  });
  await pending;
  expect(outcome === 'blocked' ? 'blocked' : outcome?.statusCode).toBe(200);
});

it('writes nothing but the telescope confirmation when the galaxy is read', async () => {
  const f = await seedWorld(2);
  await watching(f);
  const wire: string[] = [];
  const client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  try {
    built = buildApp({ db: drizzle(client, { schema }), env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
    const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
    expect((await built.app.inject({ url: '/api/season', headers: { authorization } })).statusCode).toBe(200);
    wire.length = 0;
    expect((await built.app.inject({ url: '/api/galaxy', headers: { authorization } })).statusCode).toBe(200);
    const writes = wire.filter(query => /\bfor (update|share|no key update|key share)\b|^\s*(update|insert|delete)\b|advisory/.test(query));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/update watches as w\s+set last_status = confirmed.status, last_confirmed_at = confirmed.confirmed_at/);
    expect((await f.db.select().from(watches))[0]!.lastConfirmedAt).not.toBeNull();
  } finally {
    await built?.close();
    built = undefined;
    await client.end();
  }
});

it('cannot confirm a watch a relocation detaches under it, and refuses the moved read', async () => {
  const f = await seedWorld(2);
  await watching(f);
  const authorization = await appFor(f);
  // Spend presence's once-a-minute stamp: it would otherwise wait on the relocation's player row.
  expect((await built!.app.inject({ url: '/api/season', headers: { authorization } })).statusCode).toBe(200);
  let pending: Promise<{ statusCode: number }> | undefined;
  await f.db.transaction(async tx => {
    // A relocation, uncommitted: its exclusive fence, the watch detached, the placement moved.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${f.seasonId}`}, 0))`);
    await tx.update(watches).set({ detachedAt: f.clock.now(), lastStatus: null, lastConfirmedAt: null });
    await tx.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
    pending = built!.app.inject({ url: '/api/galaxy', headers: { authorization } });
    // The read saw the watch still attached and now waits on its row for the confirmation.
    await vi.waitFor(async () => {
      const [row] = await f.db.execute<{ waiting: number }>(sql`select count(*)::int as waiting from pg_stat_activity
        where wait_event_type = 'Lock' and query ilike '%update watches%'`);
      expect(row!.waiting).toBe(1);
    }, { timeout: 5_000 });
  });
  const response = await pending!;
  expect(response.statusCode).toBe(409);
  const [watch] = await f.db.select().from(watches);
  expect(watch!.detachedAt).not.toBeNull();
  expect(watch!.lastConfirmedAt).toBeNull();
});
