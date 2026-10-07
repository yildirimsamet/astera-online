import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { MONUMENT_SEASON_DEFAULTS } from '@astera/rules';
import type { Queryable } from '../db/client.js';

const honoreeRow = z.object({ rank: z.coerce.number().int(), name: z.string().nullable() });

/**
 * LAST SEASON'S FIVE NAMES, ONE PER MONUMENT. Owner decision, 2026-10-06: "Geçen sezondaki ilk
 * 5 kişinin adı gerekli her yerde anıtların önüne yazılacak" — "Vantasia • Kadim Yıldız Geçidi".
 *
 * Index N − 1 is monument N, and it holds the commander who finished rank N (owner: rank N to
 * monument N; the five monuments are identical). `null` where nobody finished that rank: the
 * monument keeps its plain name.
 *
 * THIS GALAXY'S LAST SEASON: the season the cycle before this one ran on the SAME shard,
 * and if a force wipe left more than one there, the one that closed last. Production runs two
 * galaxies at once; reading every main galaxy wrote both rank-1 commanders into one slot. A
 * galaxy that is new this cycle has no last season, and its monuments keep their plain names.
 * THE SAME NAME THE ARCHIVE PRINTS: the record's frozen `recap.commanderName`, not today's
 * display name — the monument honours who won, as the leaderboard recorded it.
 */
export async function monumentHonorees(db: Queryable, seasonId: string): Promise<(string | null)[]> {
  const count = MONUMENT_SEASON_DEFAULTS.count;
  const rows = await db.execute(sql`
    WITH previous AS (
      SELECT previous_season.id
        FROM seasons current_season
        JOIN season_cycles current_cycle ON current_cycle.id = current_season.cycle_id
        JOIN season_cycles previous_cycle ON previous_cycle.ordinal = current_cycle.ordinal - 1
        JOIN seasons previous_season ON previous_season.cycle_id = previous_cycle.id
         AND previous_season.shard_id = current_season.shard_id
         AND previous_season.status IN ('frozen', 'wiped')
       WHERE current_season.id = ${seasonId}::uuid
       ORDER BY previous_season.closed_at DESC NULLS LAST, previous_season.starts_at DESC
       LIMIT 1
    )
    SELECT r.final_rank AS rank, r.recap ->> 'commanderName' AS name
      FROM previous
      JOIN season_results r ON r.season_id = previous.id
     WHERE r.final_rank BETWEEN 1 AND ${count}
     ORDER BY r.final_rank
  `);
  const names: (string | null)[] = Array.from({ length: count }, () => null);
  for (const raw of rows) {
    const row = honoreeRow.parse(raw);
    const name = row.name?.trim() ?? '';
    if (name !== '' && row.rank >= 1 && row.rank <= count) names[row.rank - 1] = name;
  }
  return names;
}
