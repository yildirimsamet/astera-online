import { setTimeout as delay } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { seedWorld, testDb, testEnv } from './helpers.js';

/**
 * A HUNG HANDLER MAY NOT HOLD A TRANSACTION FOREVER. Resource analysis 2026-10-13.
 *
 * Production ran with `idle_in_transaction_session_timeout = 0`: one handler stuck
 * between statements would keep its row locks and one of the two placement
 * connections until the process restarted. The API roles now bound it; the worker
 * and the CLIs keep their own long transactions.
 */
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { await (await testDb()).close(); });

const idle = (db: ReturnType<typeof buildApp>['db']) => db.transaction(async tx => {
  await tx.execute(sql`select 1`);
  await delay(900);
  await tx.execute(sql`select 1`);
});

it('ends an API transaction left idle past the limit', async () => {
  await seedWorld(1);
  built = buildApp({ env: testEnv({ ROLE: 'api', DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: '300' }), logger: pino({ level: 'silent' }) });
  await expect(idle(built.db)).rejects.toThrow();
  // The pool recovers: the next transaction gets a healthy connection.
  await expect(built.db.execute(sql`select 1`)).resolves.toBeDefined();
});

it('leaves worker transactions unbounded', async () => {
  await seedWorld(1);
  built = buildApp({ env: testEnv({ ROLE: 'worker', DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: '300' }), logger: pino({ level: 'silent' }) });
  await expect(idle(built.db)).resolves.toBeUndefined();
});

it('bounds a leased handler’s placement transaction on the API', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv({ ROLE: 'api', DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: '300' }), logger: pino({ level: 'silent' }) });
  const { requireAuth } = await import('../src/routes/auth.js');
  built.app.post('/api/placement-idle-test', { preHandler: requireAuth }, async () => {
    await delay(900);
    return { ok: true };
  });
  const authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
  const stuck = await built.app.inject({ method: 'POST', url: '/api/placement-idle-test', headers: { authorization } });
  expect(stuck.statusCode).toBe(500);
});
