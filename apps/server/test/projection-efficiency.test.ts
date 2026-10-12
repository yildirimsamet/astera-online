import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { z } from 'zod';
import { createDb, schema } from '../src/db/client.js';
import { asteroidClaims } from '../src/db/schema.js';
import { loadMiningSnapshot } from '../src/services/mining.js';
import { loadTrafficSnapshot } from '../src/services/traffic.js';
import { TEST_DATABASE_URL, seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('loads ore claims only for rocks retained by the current snapshot', async () => {
  const f = await seedWorld(1);
  const initial = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
  const index = initial.asteroids[0]!.index;
  await f.db.insert(asteroidClaims).values([
    { seasonId: f.seasonId, index, oreTaken: 30, updatedAt: f.clock.now() },
    { seasonId: f.seasonId, index: 2_000_000_000, oreTaken: 10, updatedAt: f.clock.now() },
  ]);
  const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
  expect([...snapshot.oreTaken]).toEqual([[index, 30]]);
  expect(await f.db.select().from(asteroidClaims).where(eq(asteroidClaims.seasonId, f.seasonId))).toHaveLength(2);
});

it('uses the existing active-run index with a large completed mining history', async () => {
  const f = await seedWorld(1);
  await f.db.execute(sql`
    insert into mining_runs (season_id, planet_id, owner_player_id, asteroid_index,
      status, craft, hold_each, intercept_x, intercept_y, intercept_z, depart_at, arrive_at)
    select ${f.seasonId}, ${f.planetIds[0]!}, ${f.playerIds[0]!}, 0,
      case when n = 1 then 'outbound'::mining_status
           when n = 2 then 'returning'::mining_status else 'done'::mining_status end,
      1, 1, 0, 0, 0, ${f.clock.now().toISOString()}::timestamptz, ${f.clock.now().toISOString()}::timestamptz
    from generate_series(1, 5000) n
  `);
  await f.db.execute(sql`analyze mining_runs`);
  const pool = createDb(TEST_DATABASE_URL);
  let statement: { query: string; params: unknown[] } | undefined;
  const observed = drizzle(pool.sql, { schema, logger: { logQuery(query, params) {
    if (query.includes('from "mining_runs"')) statement = { query, params };
  } } });
  try {
    const snapshot = await loadTrafficSnapshot(observed, f.seasonId, f.clock.now());
    expect(snapshot.miningRows.map(({ run }) => run.status).sort()).toEqual(['outbound', 'returning']);
    if (!statement) throw new Error('traffic read did not query mining runs');
    const planRows = await pool.sql.unsafe(`EXPLAIN (FORMAT JSON) ${statement.query}`,
      z.array(z.string()).parse(statement.params));
    const plan = z.array(z.object({ Plan: z.object({ 'Node Type': z.string() }).passthrough() }))
      .parse(planRows[0]?.['QUERY PLAN']);
    expect(plan[0]?.Plan['Node Type'], 'a season with two active runs must not scan 5000 historical rows')
      .not.toBe('Seq Scan');
  } finally { await pool.close(); }
});
