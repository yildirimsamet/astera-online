import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { players } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL } from './helpers.js';

/**
 * NOTHING THE API ASKS MAY WAIT FOR EVER. Scaling plan F0.8 (Q12).
 *
 * One stuck statement or lock queue held a pool connection until someone noticed.
 * The longest ordinary statement on production is under two seconds, so the bounds
 * are generous: they catch what is stuck, not what is slow. A lock timeout answers
 * `503 RETRYABLE` (F1.9). The worker and the CLIs run long work and stay unbounded.
 */
const pools: { close: () => Promise<unknown> }[] = [];
const pool = (opts: Parameters<typeof createDb>[1]) => {
  const made = createDb(TEST_DATABASE_URL, opts);
  pools.push(made);
  return made;
};
afterEach(async () => { await Promise.all(pools.splice(0).map(each => each.close())); });
afterAll(async () => { await (await testDb()).close(); });

it('cancels a statement past its bound', async () => {
  const { db } = pool({ max: 1, statementTimeoutMs: 100 });
  await expect(db.execute(sql`select pg_sleep(2)`)).rejects.toMatchObject({ cause: { code: '57014' } });
});

it('gives up on a lock past its bound, rolls the command back and holds nothing', async () => {
  const f = await seedWorld(1);
  const id = f.playerIds[0]!;
  const { db } = pool({ max: 1, lockTimeoutMs: 100 });
  await f.db.transaction(async holder => {
    await holder.select({ id: players.id }).from(players).where(eq(players.id, id)).for('update');
    await expect(db.transaction(async tx => {
      await tx.update(players).set({ wealth: 777 }).where(eq(players.id, id));
    })).rejects.toMatchObject({ cause: { code: '55P03' } });
  });
  const [after] = await db.select({ wealth: players.wealth }).from(players).where(eq(players.id, id));
  expect(after?.wealth).not.toBe(777);
  await db.update(players).set({ wealth: 1 }).where(eq(players.id, id));
});

const settings = async (role: 'api' | 'worker') => {
  const built = buildApp({ env: testEnv({ ROLE: role }), logger: pino({ level: 'silent' }) });
  pools.push(built);
  const [row] = await built.app.db.execute<{ statement: string; lock: string }>(
    sql`select current_setting('statement_timeout') as statement, current_setting('lock_timeout') as lock`);
  return row;
};

it('bounds the API generously', async () => {
  expect(await settings('api')).toEqual({ statement: '30s', lock: '10s' });
});

it('leaves the worker unbounded', async () => {
  expect(await settings('worker')).toEqual({ statement: '0', lock: '0' });
});
