import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { seedWorld, testDb, testEnv } from './helpers.js';

/**
 * A RACE THE DATABASE LOST IS NOT A BUG. Scaling plan F1.9.
 *
 * A deadlock, a lock timeout and a serialization failure rolled the transaction back,
 * and the same request can succeed a moment later. They used to answer 500, which says
 * "something broke"; `503 RETRYABLE` is what lets the client try again by itself.
 */
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });

const failedQuery = (code: string): Error => Object.assign(new Error('Failed query: update'),
  { cause: Object.assign(new Error('database refused'), { code }) });

const collect = async (failure: Error) => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), clock: f.clock, logger: pino({ level: 'silent' }) });
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  vi.spyOn(built.app.db, 'transaction').mockRejectedValueOnce(failure);
  return built.app.inject({ method: 'POST', url: '/api/planet/collect', headers: { authorization: `Bearer ${token}` } });
};

it.each(['40P01', '55P03', '40001'])('answers %s as retryable', async (code) => {
  const res = await collect(failedQuery(code));
  expect(res.statusCode).toBe(503);
  expect(res.json()).toMatchObject({ error: 'RETRYABLE' });
});

it('still answers any other database failure as a fault', async () => {
  const res = await collect(failedQuery('23505'));
  expect(res.statusCode).toBe(500);
  expect(res.json()).toMatchObject({ error: 'INTERNAL' });
});
