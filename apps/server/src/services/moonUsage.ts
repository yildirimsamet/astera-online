import { sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';

/** One side's moon orders in a window (Ay plan §6.23, §10.1). */
export interface MoonUsageCounts {
  hops: number;
  jumps: number;
  scans: number;
  retargets: number;
  moonRaids: number;
  moonStrikes: number;
  builds: number;
}

export interface MoonUsage {
  /** Real commanders. */
  commanders: MoonUsageCounts;
  /** The roster (bot_profiles), counted apart so its habits can be tuned to the commanders' (§10.1). */
  roster: MoonUsageCounts;
  births: number;
  destroyed: number;
  moonsStanding: number;
}

const ACTIONS = ['hops', 'jumps', 'scans', 'retargets', 'moonRaids', 'moonStrikes', 'builds'] as const;
const isAction = (action: string): action is keyof MoonUsageCounts => (ACTIONS as readonly string[]).includes(action);

interface Row extends Record<string, unknown> { action: string; roster: boolean; n: number }

/**
 * MOON USAGE SINCE A MOMENT (review B5). Every count is read from rows the game already keeps — moves,
 * scans, missions, build orders, the chronicle — so it adds no write to any order's transaction.
 */
export async function moonUsage(db: Queryable, seasonId: string, since: Date): Promise<MoonUsage> {
  const from = since.toISOString();
  const rows = await db.execute<Row>(sql`
    WITH acts AS (
      SELECT CASE WHEN kind = 'JUMP' THEN 'jumps' ELSE 'hops' END AS action, owner_player_id AS player_id
        FROM moon_moves WHERE season_id = ${seasonId} AND depart_at >= ${from}
      UNION ALL
      SELECT 'scans', scanner_player_id FROM moon_scans WHERE season_id = ${seasonId} AND scanned_at >= ${from}
      UNION ALL
      SELECT 'retargets', owner_player_id FROM missions
        WHERE season_id = ${seasonId} AND retargeted_at >= ${from}
      UNION ALL
      SELECT CASE WHEN kind = 'attack' THEN 'moonRaids' ELSE 'moonStrikes' END, owner_player_id FROM missions
        WHERE season_id = ${seasonId} AND target_body = 'MOON' AND kind IN ('attack', 'death_star') AND depart_at >= ${from}
      UNION ALL
      SELECT 'builds', p.player_id FROM build_orders o INNER JOIN planets p ON p.id = o.planet_id
        WHERE p.season_id = ${seasonId} AND o.kind = 'MOON' AND o.started_at >= ${from}
    )
    SELECT a.action, (b.account_id IS NOT NULL) AS roster, count(*)::int AS n
    FROM acts a
    LEFT JOIN players pl ON pl.id = a.player_id
    LEFT JOIN bot_profiles b ON b.account_id = pl.account_id
    GROUP BY a.action, roster`);
  const [world] = await db.execute<{ births: number; destroyed: number; standing: number } & Record<string, unknown>>(sql`
    SELECT
      (SELECT count(*)::int FROM moons m INNER JOIN planets p ON p.id = m.planet_id
        WHERE p.season_id = ${seasonId} AND m.origin = 'BATTLE' AND m.born_at >= ${from}) AS births,
      (SELECT count(*)::int FROM galaxy_events
        WHERE season_id = ${seasonId} AND kind = 'moon_destroyed' AND occurred_at >= ${from}) AS destroyed,
      (SELECT count(*)::int FROM moons m INNER JOIN planets p ON p.id = m.planet_id
        WHERE p.season_id = ${seasonId}) AS standing`);
  const empty = (): MoonUsageCounts => ({ hops: 0, jumps: 0, scans: 0, retargets: 0, moonRaids: 0, moonStrikes: 0, builds: 0 });
  const usage: MoonUsage = {
    commanders: empty(), roster: empty(),
    births: world?.births ?? 0, destroyed: world?.destroyed ?? 0, moonsStanding: world?.standing ?? 0,
  };
  for (const row of rows) {
    const side = row.roster ? usage.roster : usage.commanders;
    if (isAction(row.action)) side[row.action] = row.n;
  }
  return usage;
}
