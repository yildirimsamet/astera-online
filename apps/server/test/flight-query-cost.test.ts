import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';
import { baysInUse } from '../src/services/flight.js';
import { seedWorld, testDb, TEST_DATABASE_URL } from './helpers.js';

const queries: string[] = [];
const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined });
const db = drizzle(sql, { schema, logger: { logQuery: q => { queries.push(q); } } });
afterAll(async () => { await sql.end(); await (await testDb()).close(); });

it('counts all flight lanes in one database statement', async () => {
  const f = await seedWorld(1);
  queries.length = 0;
  expect(await baysInUse(db, f.planetIds[0]!)).toBe(0);
  expect(queries).toHaveLength(1);
});
