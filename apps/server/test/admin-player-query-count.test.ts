import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { createDb, schema } from '../src/db/client.js';
import { miningRuns, pirateRaids, planets } from '../src/db/schema.js';
import { listAdminPlayers } from '../src/services/adminPlayers.js';
import { readPlanetState } from '../src/services/planet.js';
import { seedWorld, setLevel, testDb, TEST_DATABASE_URL } from './helpers.js';

const pool = createDb(TEST_DATABASE_URL, { max: 1 });
const queries: string[] = [];
const db = drizzle(pool.sql, { schema, logger: { logQuery(query) { queries.push(query); } } });
afterAll(async () => { await pool.close(); await (await testDb()).close(); });

it('uses the same number of read queries for one and three commanders and projects current lazy production without writes', async () => {
  const f = await seedWorld(3);
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 8);
  await setLevel(f.db, f.planetIds[0]!, 'REFINERY', 8);
  f.clock.advance(30);
  await f.db.execute(sql`UPDATE players SET last_active_at = ${f.clock.now().toISOString()}::timestamptz`);
  const before = await f.db.select().from(planets);
  queries.length = 0;
  await listAdminPlayers(db, { limit: 1 }, f.clock.now());
  const one = queries.length;
  queries.length = 0;
  const page = await listAdminPlayers(db, { limit: 3 }, f.clock.now());
  expect(page.players).toHaveLength(3);
  expect(queries).toHaveLength(one);
  expect(queries.some(query => /\b(update|insert|delete)\b/iu.test(query))).toBe(false);
  expect(await f.db.select().from(planets)).toEqual(before);
  const expected = await f.db.transaction(tx => readPlanetState(tx, f.planetIds[0]!, f.clock));
  const actual = page.players.find(row => row.playerId === f.playerIds[0])!;
  expect(actual.resources.storage).toEqual({ alloy: expected.alloy, crystal: expected.crystal, deuterium: expected.deuterium });
  expect(actual.resources.buffer).toEqual({ alloy: expected.bufferAlloy, crystal: expected.bufferCrystal, deuterium: expected.bufferDeuterium });
  expect(actual.resources.buffer.alloy).toBeGreaterThan(0);
});

it('indexes admin 24h activity by launch owner and departure time', async () => {
  const { db: source } = await testDb();
  // Query-plan support is a schema contract: no per-page scan of all historical launches.
  for (const table of [miningRuns, pirateRaids]) {
    const name = table === miningRuns ? 'mining_runs' : 'pirate_raids';
    const rows = await source.execute<{ indexdef: string }>(sql`SELECT indexdef FROM pg_indexes WHERE tablename = ${name}`);
    expect(rows.some(row => row.indexdef.includes('(owner_player_id, depart_at)'))).toBe(true);
  }
});
