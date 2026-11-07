import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, schema } from '../src/db/client.js';
import { vessels } from '../src/db/schema.js';
import { starterGalaxyView } from '../src/services/starter/publicView.js';
import { testDb, TEST_DATABASE_URL } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';

const pool = createDb(TEST_DATABASE_URL, { max: 1 });
const queries: string[] = [];
const counted = drizzle(pool.sql, { schema, logger: { logQuery(query) { queries.push(query); } } });
afterAll(async () => { await pool.close(); await (await testDb()).close(); });

describe('the galaxy read under load', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const read = async (accountId: string) => {
    queries.length = 0;
    await starterGalaxyView(counted, accountId, world.f.clock);
    return queries.length;
  };

  it('asks the same number of questions for four ships as for twenty-four', async () => {
    const me = await aboard(world, 'Me', { TELESCOPE: 3 });
    for (let index = 0; index < 3; index++) await aboard(world, `Few${String(index)}`);
    const few = await read(me.id);
    for (let index = 0; index < 20; index++) await aboard(world, `Many${String(index)}`);
    const shown = await world.f.db.select({ id: vessels.id }).from(vessels).where(eq(vessels.status, 'ACTIVE'));
    expect(shown).toHaveLength(24);
    expect(await read(me.id)).toBe(few);
  });
});
