import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { testDb } from './helpers.js';

/**
 * A RECLAIM CHECKS EVERY TABLE THAT POINTS AT WHAT IT DELETES. Scaling plan F1.8 (N6).
 *
 * Reclaim deletes the commander, their worlds and their missions. For each row
 * deleted Postgres asks every referencing table "does anyone still point here?",
 * and a column with no index of its own answers that by reading the whole table
 * while the reclaim holds its locks. Every key into those three tables leads an index.
 */
afterAll(async () => { await (await testDb()).close(); });

it('gives every key into a commander, a world or a mission an index of its own', async () => {
  const { db } = await testDb();
  const unindexed = await db.execute<{ key: string }>(sql`
    select c.conrelid::regclass::text || '.' || a.attname as key
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and array_length(c.conkey, 1) = 1
       and c.confrelid in ('players'::regclass, 'planets'::regclass, 'missions'::regclass)
       and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
     order by 1`);
  expect(unindexed.map(row => row.key)).toEqual([]);
});
