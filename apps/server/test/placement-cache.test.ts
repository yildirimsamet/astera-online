import { eq, sql } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * WHERE THE CALLER LIVES, READ ONCE. Scaling plan F1.8 (C2 + Q8).
 *
 * A hot read checked the caller's placement before the handler and again after it,
 * two SELECTs on every poll even when the answer came out of a cache. The before
 * check now comes from memory, kept honest by the same trigger events that close a
 * stream (`placement_changed`, a commander deleted). The after check stays for any
 * handler that read the database: a relocation that committed under it is still
 * refused. A handler served wholly from memory read nothing a move could have
 * changed, so its answer and its placement are the same moment.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: ReturnType<typeof buildApp>;
let authorization: string;

beforeEach(async () => {
  f = await seedWorld(1);
  built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
  await built.app.ready();
  await built.bus.start();
  authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
});
afterEach(async () => { vi.restoreAllMocks(); await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

const statements = (response: LightMyRequestResponse) => Number(response.headers['x-db-statements']);
const read = (url: string, placement?: string) => built.app.inject({ url,
  headers: { authorization, ...(placement === undefined ? {} : { 'x-placement': placement }) } });
const moved = (version: number) => `${f.playerIds[0]!}:${String(version)}`;

it('answers a warm traffic read with no SQL at all', async () => {
  await read('/api/galaxy/traffic');
  const warm = await read('/api/galaxy/traffic');
  expect(warm.statusCode).toBe(200);
  expect(warm.headers['x-placement']).toBe(moved(0));
  expect(statements(warm)).toBe(0);
});

it('sees a relocation the moment its event lands, and keeps the stale-header rule', async () => {
  await read('/api/galaxy/traffic');
  await f.db.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
  await vi.waitFor(async () => { expect((await read('/api/galaxy/traffic')).statusCode).toBe(409); }, { timeout: 2_000, interval: 20 });
  const current = await read('/api/galaxy/traffic', moved(1));
  expect(current.statusCode).toBe(200);
  expect(current.headers['x-placement']).toBe(moved(1));
});

it('refuses a database read whose galaxy moved under it, even when no event ever comes', async () => {
  await read('/api/notifications');
  // A move this process never hears of: only the after check can see it.
  await f.db.transaction(async tx => {
    await tx.execute(sql`alter table players disable trigger players_stream_placement`);
    await tx.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
    await tx.execute(sql`alter table players enable trigger players_stream_placement`);
  });
  const response = await read('/api/notifications');
  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
  // Refused once, the database's placement is the one remembered.
  expect((await read('/api/notifications', moved(1))).statusCode).toBe(200);
});

it('asks the database before refusing a browser that heard of its move first', async () => {
  await read('/api/galaxy/traffic');
  await f.db.transaction(async tx => {
    await tx.execute(sql`alter table players disable trigger players_stream_placement`);
    await tx.update(players).set({ placementVersion: 1 }).where(eq(players.id, f.playerIds[0]!));
    await tx.execute(sql`alter table players enable trigger players_stream_placement`);
  });
  const response = await read('/api/galaxy/traffic', moved(1));
  expect(response.statusCode).toBe(200);
  expect(response.headers['x-placement']).toBe(moved(1));
});

it('reads the placement before and after every hot read while the bus is down', async () => {
  await read('/api/galaxy/traffic');
  await built.bus.stop();
  expect(statements(await read('/api/galaxy/traffic'))).toBeGreaterThanOrEqual(2);
});
