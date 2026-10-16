import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';
import { loadLocked } from '../src/services/planet.js';
import { seedWorld, testDb, TEST_DATABASE_URL } from './helpers.js';

const statements: string[] = [];
const connection = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined });
const db = drizzle(connection, { schema, logger: { logQuery: query => { statements.push(query); } } });
afterAll(async () => { await connection.end(); await (await testDb()).close(); });

it('reuses the locked planet hardware read when recording its Aegis protection epoch', async () => {
  const f = await seedWorld(1);
  await f.db.update(schema.seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  statements.length = 0;
  await db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  for (const table of ['buildings', 'satellites', 'planet_faults']) {
    expect(statements.filter(query => query.startsWith('select ') && query.includes(`from "${table}"`)), table).toHaveLength(1);
  }
  const [epoch] = await f.db.select().from(schema.planetAegisEpochs).where(eq(schema.planetAegisEpochs.planetId, f.planetIds[0]!));
  expect(epoch).toBeDefined();
});
