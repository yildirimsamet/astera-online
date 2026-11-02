import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { honorObservations } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { seedWorld, testDb, truncateAll } from './helpers.js';

/** Every test starts from nothing: no row in any table, and ids count from one again. */
afterAll(async () => { await (await testDb()).close(); });

const rowsLeft = async (db: Awaited<ReturnType<typeof testDb>>['db']) => {
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const left: string[] = [];
  for (const { tablename } of tables) {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(tablename)}`);
    if (row?.n !== 0) left.push(tablename);
  }
  return left;
};

it('leaves no row in any table', async () => {
  const f = await seedWorld(2);
  expect((await rowsLeft(f.db)).length).toBeGreaterThan(0);
  await truncateAll(f.db);
  expect(await rowsLeft(f.db)).toEqual([]);
});

it('counts ids from one again', async () => {
  const f = await seedWorld(1);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[0]!, f.clock.now()));
  const g = await seedWorld(1);
  await g.db.transaction(tx => prepareHonorSeason(tx, g.seasonId, 'SHADOW', g.clock));
  const [first] = await g.db.select({ id: honorObservations.id }).from(honorObservations).orderBy(honorObservations.id).limit(1);
  expect(first?.id).toBe(1);
});
