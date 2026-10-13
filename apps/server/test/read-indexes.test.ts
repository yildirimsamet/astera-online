import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { testDb } from './helpers.js';

/**
 * TWO HOT READS THAT HAD NO USABLE INDEX. Resource analysis 2026-10-13.
 *
 * Production EXPLAIN showed both as sequential scans: the probe cooldown read behind
 * every `GET /api/intel` (414 full scans of `missions` in 23 minutes) and the
 * physical-fleet lookup behind traffic, pending and monuments (5,350 full scans of
 * `units`, whose primary key leads with `planet_id`). Both tables only grow.
 *
 * "Not a Seq Scan" is not enough: with sequential scans disabled the planner walks a
 * non-selective index end to end instead (the status index, or the units primary key
 * filtered on its third column). The plan must use an index that LEADS with the column
 * being searched.
 */
afterAll(async () => { await (await testDb()).close(); });

async function plan(query: ReturnType<typeof sql>): Promise<string> {
  const { db } = await testDb();
  return db.transaction(async tx => {
    await tx.execute(sql`set local enable_seqscan = off`);
    const rows = await tx.execute<{ 'QUERY PLAN': string }>(sql`explain ${query}`);
    return rows.map(row => row['QUERY PLAN']).join('\n');
  });
}

it('finds a commander’s recent probes without scanning every mission', async () => {
  const text = await plan(sql`select target_planet_id, depart_at from missions
    where kind = 'probe' and parent_mission_id is null
      and owner_player_id = '00000000-0000-4000-8000-000000000001'
      and status in ('in_flight', 'resolved') and depart_at > now() - interval '5 minutes'`);
  expect(text).toMatch(/\bmissions_owner_kind_depart_idx\b/);
});

it('finds the ships aboard named flights without scanning every unit', async () => {
  const text = await plan(sql`select location, hull, count from units
    where location in ('pirate:00000000-0000-4000-8000-000000000001', 'trade:00000000-0000-4000-8000-000000000002')`);
  expect(text).toMatch(/\bunits_location_idx\b/);
});
