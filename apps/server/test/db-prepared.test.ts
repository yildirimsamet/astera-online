import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { createDb } from '../src/db/client.js';
import { players } from '../src/db/schema.js';
import { TEST_DATABASE_URL } from './helpers.js';

/**
 * A STATEMENT IS ONE ROUND TRIP. Capacity fix plan, item M (2026-10-31).
 *
 * Drizzle hands every query to postgres.js `unsafe`, which never prepares, and an
 * unprepared statement with parameters asks the server for their types first: two
 * round trips for every statement, which on production's box is most of a move's
 * latency. Short statements are now prepared once per connection. A long parameter
 * list is not: each length would be a separate statement held for the connection's
 * life. Plans follow the server's default: five executions planned for their own
 * parameters, then a reused plan unless it looks costlier (query plan, 2026-11-03).
 */
const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
afterAll(close);

const preparedLike = async (fragment: string): Promise<number> => {
  const rows = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from pg_prepared_statements where statement like ${`%${fragment}%`}`);
  return rows[0]!.count;
};

it('prepares a short statement once per connection', async () => {
  await db.select({ id: players.id }).from(players).where(eq(players.id, randomUUID()));
  await db.select({ id: players.id }).from(players).where(eq(players.id, randomUUID()));
  expect(await preparedLike('from "players" where "players"."id" = $1')).toBe(1);
});

it('does not prepare a statement with a long parameter list', async () => {
  const ids = Array.from({ length: 33 }, () => randomUUID());
  await db.select({ id: players.id }).from(players).where(inArray(players.id, ids));
  expect(await preparedLike('$33')).toBe(0);
});

it('lets the server reuse a plan once it is as good as a fresh one', async () => {
  const [row] = await db.execute<{ plan_cache_mode: string }>(sql`show plan_cache_mode`);
  expect(row!.plan_cache_mode).toBe('auto');
  const reused = () => db.select({ id: players.id }).from(players).where(eq(players.accountId, randomUUID()));
  for (let run = 0; run < 7; run += 1) await reused();
  const [plans] = await db.execute<{ generic_plans: number }>(sql`select generic_plans::int from pg_prepared_statements
    where statement like '%from "players" where "players"."account_id" = $1'`);
  expect(plans!.generic_plans).toBeGreaterThan(0);
});
