import type { LightMyRequestResponse } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE HOTTEST ROUTES HAVE A STATEMENT BUDGET. Query plan, 2026-11-03.
 *
 * Production's database spends most of its time on statement count: a planet view was
 * 33 statements for 10 KB, a collect 67 with two writes. These budgets are for a
 * commander with nothing in flight, the common case; a new read joins the reads already
 * asked for together, and one that cannot has to raise a number here and say why.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: ReturnType<typeof buildApp>;
let authorization: string;

beforeEach(async () => {
  f = await seedWorld(2);
  built = buildApp({ db: f.db, env: testEnv(), clock: f.clock, logger: silent });
  await built.app.ready();
  await built.bus.start();
  authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

const statements = (response: LightMyRequestResponse) => {
  expect(response.statusCode, response.body).toBe(200);
  return Number(response.headers['x-db-statements']);
};
const warm = async (method: 'GET' | 'POST', url: string) => {
  const call = () => built.app.inject({ method, url, headers: { authorization, 'idempotency-key': crypto.randomUUID() } });
  await call();
  return call();
};

it.each([
  ['GET', '/api/planets', 11],
  ['GET', '/api/planet', 11],
  ['GET', '/api/session/pending', 4],
  ['GET', '/api/rewards', 10],
  ['GET', '/api/season', 6],
  ['POST', '/api/planet/collect', 30],
] as const)('%s %s stays within %i statements', async (method, url, budget) => {
  expect(statements(await warm(method, url))).toBeLessThanOrEqual(budget);
});
