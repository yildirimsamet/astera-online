import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';

/** Coarse, unlinked UTC totals. All groups, including small ones, expire within thirty days. */
export async function refreshDailyAnalytics(db: Db, clock: Clock, excludedNames: ReadonlySet<string> = new Set()): Promise<void> {
  const cutoff = new Date(clock.now().getTime() - (30 * 86_400_000 - 3_600_000)).toISOString();
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('analytics:daily'))`);
    // Rebuild atomically: revocation/deletion cannot leave stale small-group totals behind.
    await tx.execute(sql`DELETE FROM analytics_daily_aggregates`);
    const excluded = excludedNames.size ? sql`AND (a.id IS NULL OR a.username NOT IN (${sql.join([...excludedNames].map(name => sql`${name}`), sql`, `)}))` : sql``;
    await tx.execute(sql`INSERT INTO analytics_daily_aggregates (id, day, name, mode, events, visitors)
      SELECT concat(to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), ':', e.name, ':', e.mode),
        date_trunc('day', e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', e.name, e.mode,
        count(*)::int, count(distinct e.visitor_id)::int
      FROM analytics_events e LEFT JOIN accounts a ON a.id=e.account_id
      LEFT JOIN bot_profiles b ON b.account_id=e.account_id
      WHERE e.occurred_at >= ${cutoff}::timestamptz AND e.time_trusted AND b.account_id IS NULL ${excluded}
      GROUP BY 1,2,3,4`);
  });
}
