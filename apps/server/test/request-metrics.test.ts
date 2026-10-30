import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { scheduledEvents } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { seedWorld, testEnv, TEST_DATABASE_URL } from './helpers.js';

/**
 * EVERY REQUEST KNOWS ITS SQL COST. Scaling plan F0.2.
 *
 * Optimising without this is guessing: latency says a route is slow, not that it
 * ran forty statements where four would do. Each request and each worker event
 * counts the statements it issued; the routes keep the distribution for /metrics.
 * Outside production the response also says it, so a test or a developer can see
 * the cost of one call without reading logs.
 */
const silent = pino({ level: 'silent' });
const pool = createDb(TEST_DATABASE_URL, { max: 2 });
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await pool.close(); });

const statements = (response: LightMyRequestResponse) => Number(response.headers['x-db-statements']);

async function app(seats: number, env: Record<string, string> = {}) {
  const f = await seedWorld(seats);
  // Caches would make the second identical request cheaper than the first.
  built = buildApp({ env: testEnv({ PROJECTION_CACHE_ENABLED: 'false', ...env }), clock: f.clock, logger: silent });
  const tokens = await Promise.all(f.accountIds.map(id => built!.app.tokens.issueAccess(id)));
  return { f, built, get: (url: string, seat = 0) => built!.app.inject({ url, headers: { authorization: `Bearer ${tokens[seat]!}` } }) };
}

it('reports the statements one request ran and keeps the per-route distribution', async () => {
  const { built, get } = await app(1);
  const response = await get('/api/planets');
  expect(response.statusCode).toBe(200);
  const count = statements(response);
  expect(Number.isInteger(count) && count > 0, String(response.headers['x-db-statements'])).toBe(true);
  await vi.waitFor(() => { expect(built.metrics.status().routes['GET /api/planets']?.statements).toMatchObject({ samples: 1, max: count }); });
});

it('never mixes the counts of concurrent requests', async () => {
  const { get } = await app(2);
  // Two routes of different cost: a world list costs the same for one world or four (F1.4).
  const list = () => get('/api/planets');
  const one = () => get('/api/auth/me', 1);
  await list(); await one();
  const [listCost, oneCost] = [statements(await list()), statements(await one())];
  expect(listCost).not.toBe(oneCost);
  const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? one() : list())));
  for (const [i, response] of responses.entries()) {
    expect(response.statusCode).toBe(200);
    expect(statements(response), `request ${i}`).toBe(i % 2 ? oneCost : listCost);
  }
});

it('keeps counting after a request body is read', async () => {
  // Body parsing resumes from socket events; the handler after it must still count.
  // A real socket: light-my-request's in-memory body never leaves the request's scope.
  const { f, built } = await app(1);
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  const origin = await built.app.listen({ port: 0, host: '127.0.0.1' });
  const response = await fetch(`${origin}/api/notifications/seen`, { method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ids: [randomUUID()] }) });
  expect(response.status, await response.clone().text()).toBe(200);
  expect(Number(response.headers.get('x-db-statements'))).toBeGreaterThan(0);
});

it('keeps the count internal in production', async () => {
  const { built, get } = await app(1, { NODE_ENV: 'production' });
  const response = await get('/api/planets');
  expect(response.statusCode).toBe(200);
  expect(response.headers['x-db-statements']).toBeUndefined();
  await vi.waitFor(() => { expect(built.metrics.status().routes['GET /api/planets']?.statements.max).toBeGreaterThan(0); });
});

it('counts the statements each worker event ran, by kind', async () => {
  const f = await seedWorld(1);
  await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'unknown_signal_expire', refId: randomUUID(),
    resolveAt: new Date(f.clock.now().getTime() - 1000) });
  const worker = new EventWorker(pool.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
  await worker.tick();
  // The handler's own work only: one UPDATE that finds no open signal. Queue bookkeeping is the tick's.
  expect(worker.status().eventStatements.unknown_signal_expire).toMatchObject({ events: 1, statements: { samples: 1, max: 1 } });
});
