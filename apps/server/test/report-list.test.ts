import { desc, eq, inArray, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';
import { battleReports } from '../src/db/schema.js';
import { recentReportRows } from '../src/services/reports.js';
import { seedWorld, testDb, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * A COMMANDER'S LATEST REPORTS, ONE INDEX PER DOOR. Scaling plan F1.8 (Q4).
 *
 * The list asked for `attacker OR defender OR a joint result OR a support result`,
 * newest first, twenty: Postgres gathered every report of the commander's season to
 * sort them and keep twenty. Each door now takes its own newest twenty from its own
 * index and only the union is sorted. Same reports, same order.
 */
let f: Fixture;
const start = () => new Date('2026-01-01T00:00:00Z').getTime();

async function file(attacker: number, defender: number, minutesAgo: number): Promise<string> {
  const rows = await f.db.execute(sql`with mission as (
      insert into missions (season_id, kind, origin_planet_id, target_planet_id, fleet, distance, depart_at, arrive_at, owner_player_id, fuel_paid)
      values (${f.seasonId}, 'attack', ${f.planetIds[attacker]!}, ${f.planetIds[defender]!}, '{}'::jsonb, 1, now(), now(), ${f.playerIds[attacker]!}, 0) returning id)
    insert into battle_reports (season_id, mission_id, target_planet_id, attacker_player_id, defender_player_id, grade, rounds, loot,
      attacker_losses, defender_losses, created_at)
    select ${f.seasonId}, mission.id, ${f.planetIds[defender]!}, ${f.playerIds[attacker]!}, ${f.playerIds[defender]!}, 'DRAW',
      '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ${new Date(start() - minutesAgo * 60_000).toISOString()}::timestamptz from mission
    returning id`);
  return String(rows[0]!.id);
}

beforeEach(async () => { f = await seedWorld(3); });
afterAll(async () => { await (await testDb()).close(); });

it('lists the same reports in the same order as the one query over every door', async () => {
  const me = f.playerIds[0]!;
  let minute = 0;
  for (let i = 0; i < 15; i++) await file(0, 1, minute++);
  for (let i = 0; i < 10; i++) await file(2, 0, minute++);
  // Battles between the other two that this commander joined or supported.
  const others: string[] = [];
  for (let i = 0; i < 10; i++) others.push(await file(1, 2, minute++ - 30));
  const joined = others.filter((_, i) => i % 3 === 0);

  const wire: string[] = [];
  const client = postgres(TEST_DATABASE_URL, { max: 2, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  const db = drizzle(client, { schema });
  try {
    for (const limit of [1, 7, 20, 50]) {
      const expected = await db.select({ id: battleReports.id }).from(battleReports)
        .where(or(eq(battleReports.attackerPlayerId, me), eq(battleReports.defenderPlayerId, me), inArray(battleReports.id, joined)))
        .orderBy(desc(battleReports.createdAt), desc(battleReports.id)).limit(limit);
      wire.length = 0;
      const listed = await recentReportRows(db, me, joined, limit);
      expect(listed.map(row => row.id), `limit ${String(limit)}`).toEqual(expected.map(row => row.id));
      expect(wire.some(query => query.includes('union all')), 'one index per door').toBe(true);
    }
    expect((await recentReportRows(db, me, [], 50)).length).toBe(25);
  } finally { await client.end(); }
});
