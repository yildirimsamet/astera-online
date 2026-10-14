import { setTimeout as delay } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { addMinutes, type Clock } from '../src/clock.js';
import * as schema from '../src/db/schema.js';
import { planets, seasons } from '../src/db/schema.js';
import { loadLocked, readPlanetState } from '../src/services/planet.js';
import { grant, seedWorld, testDb, testEnv, TEST_DATABASE_URL } from './helpers.js';

/**
 * A PRIVATE VIEW IS A READ. Resource analysis 2026-10-13.
 *
 * The owned-world GETs used to lock the season FOR SHARE and the world FOR
 * UPDATE, then persist the lazy tick. A resync asks for all of them at once, so a
 * commander's own reads queued behind each other and the worker queued behind
 * them: 12% of production activity samples had a lock waiter, ~90% of them these
 * reads. The economy is a pure function of the stored row and the clock, and every
 * mutation ticks under its own lock first, so a view needs neither the lock nor
 * the write.
 */
// `/api/rewards` reads world levels the same way and had the same locked tick.
const GETS = ['/api/planet', '/api/planets', '/api/planets/:id', '/api/rewards'] as const;

let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });

async function appFor(f: Awaited<ReturnType<typeof seedWorld>>) {
  built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const app = built.app;
  return (url: string) => app.inject({ url: url.replace(':id', f.planetIds[0]!), headers: { authorization } });
}

it.each(GETS)('serves %s while a lifecycle writer holds the season and the world', async url => {
  const f = await seedWorld(1);
  const get = await appFor(f);
  let outcome: Awaited<ReturnType<typeof get>> | 'blocked' | undefined;
  let pending: Promise<unknown> | undefined;
  await f.db.transaction(async tx => {
    await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, f.seasonId)).for('update');
    await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, f.planetIds[0]!)).for('update');
    const request = get(url);
    pending = request;
    outcome = await Promise.race([request, delay(2_000).then(() => 'blocked' as const)]);
  });
  await pending;
  expect(outcome).not.toBe('blocked');
  expect(outcome === 'blocked' ? 0 : outcome?.statusCode).toBe(200);
});

it.each(GETS)('does not persist the lazy tick when %s is read', async url => {
  const f = await seedWorld(1);
  const get = await appFor(f);
  const read = async () => (await f.db.select({ lastTickAt: planets.lastTickAt, alloy: planets.alloy })
    .from(planets).where(eq(planets.id, f.planetIds[0]!)))[0];
  const before = await read();
  f.clock.advance(45);
  expect((await get(url)).statusCode).toBe(200);
  expect(await read()).toEqual(before);
});

it('publishes the same economy a locked tick at that instant would store', async () => {
  const f = await seedWorld(1);
  const get = await appFor(f);
  await grant(f.db, f.planetIds[0]!, 5_000, 3_000);
  f.clock.advance(37);
  const response = await get('/api/planets/:id');
  const view = response.json<{ planet: Record<string, number> }>().planet;
  const locked = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock, { requireLive: false }));
  for (const key of ['alloy', 'crystal', 'deuterium', 'bufferAlloy', 'bufferCrystal', 'bufferDeuterium'] as const) {
    expect(view[key], key).toBe(Math.floor(locked[key]));
  }
});

it('advances the economy to the same state in one step or two', async () => {
  const f = await seedWorld(1);
  const planetId = f.planetIds[0]!;
  await grant(f.db, planetId, 1_000, 500);
  const start = f.clock.now();
  const at = (minutes: number): Clock => ({ now: () => addMinutes(start, minutes) });
  const oneStep = await f.db.transaction(tx => readPlanetState(tx, planetId, at(600), { requireLive: false }));
  await f.db.transaction(tx => loadLocked(tx, planetId, at(173), { requireLive: false }));
  const twoSteps = await f.db.transaction(tx => readPlanetState(tx, planetId, at(600), { requireLive: false }));
  // Sub-unit float drift between step sizes predates this change; a view that no
  // longer persists ticks only removes intermediate steps.
  for (const key of ['alloy', 'crystal', 'deuterium', 'bufferAlloy', 'bufferCrystal', 'bufferDeuterium', 'shield'] as const) {
    expect(twoSteps[key], key).toBeCloseTo(oneStep[key], 4);
  }
});

it.each(GETS)('reads %s in a read-only snapshot without row locks or writes', async url => {
  const f = await seedWorld(1);
  const wire: string[] = [];
  const client = postgres(TEST_DATABASE_URL, { max: 2, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  try {
    built = buildApp({ db: drizzle(client, { schema }), env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
    const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
    const request = () => built!.app.inject({ url: url.replace(':id', f.planetIds[0]!), headers: { authorization } });
    // The first request spends presence's once-a-minute stamp; that write belongs to
    // authentication, not to the view. Half a minute later only the view runs.
    expect((await request()).statusCode).toBe(200);
    f.clock.advance(0.5);
    wire.length = 0;
    const response = await request();
    expect(response.statusCode).toBe(200);
    // PostgreSQL itself now refuses a view that tries to write or lock.
    expect(wire.some(query => query.includes('read only'))).toBe(true);
    expect(wire.filter(query => /\bfor (update|share)\b|^\s*(update|insert|delete)\b/.test(query))).toEqual([]);
  } finally {
    await built?.close();
    built = undefined;
    await client.end();
  }
});
