import { sql, type SQLWrapper } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
const windowSchema = z.object({ mature: z.number(), returned: z.number(), pending: z.number() });
const rowSchema = z.object({ platform: z.string(), build: z.string(), locale: z.string(), source: z.string().nullable(),
  visits: z.number(), accounts: z.number(), anchorAccounts: z.number(),
  retention: z.object({ d1: windowSchema, d3: windowSchema, d7: windowSchema }) });

/** Cohorts use the first observed ready visit in retained history. Returns may occur on a later build. */
export async function analyticsCohorts(db: Db, start: Date, now: Date, eligible: SQLWrapper) {
  const rows = await db.execute(sql`
    WITH eligible AS (${eligible}), visits AS (
      SELECT v.*, v.metadata->>'platform' platform, v.metadata->>'build' build,
        v.metadata->>'locale' locale, v.metadata->'campaign'->>'utm_source' source
      FROM analytics_visitors v INNER JOIN eligible x ON x.id=v.id
    ), ordered AS (
      SELECT e.*, lag(e.occurred_at) OVER (PARTITION BY e.account_id ORDER BY e.occurred_at,e.id) previous
      FROM analytics_events e WHERE e.account_id IS NOT NULL AND e.time_trusted AND e.mode='live'
        AND e.occurred_at >= ${start.toISOString()}::timestamptz
        AND ((e.source='client_observation' AND e.name IN ('game_ready','interaction','foreground_started','foreground_ended'))
          OR (e.source='server_fact' AND e.name='command_accepted'))
    ), numbered AS (
      SELECT *, sum(CASE WHEN previous IS NULL OR occurred_at-previous >= interval '30 minutes' THEN 1 ELSE 0 END)
        OVER (PARTITION BY account_id ORDER BY occurred_at,id) session_number FROM ordered
    ), anchors AS (
      SELECT DISTINCT ON (account_id) account_id, visitor_id, occurred_at anchor_at, session_number
      FROM numbered WHERE name='game_ready' AND source='client_observation' ORDER BY account_id,occurred_at,id
    ), evaluated AS (
      SELECT a.*, day,
        ${now.toISOString()}::timestamptz >= a.anchor_at + (day+1)*interval '1 day' mature,
        EXISTS (SELECT 1 FROM numbered n WHERE n.account_id=a.account_id AND n.session_number>a.session_number
          AND n.name IN ('game_ready','command_accepted') AND n.occurred_at >= a.anchor_at+day*interval '1 day'
          AND n.occurred_at < a.anchor_at+(day+1)*interval '1 day') returned
      FROM anchors a CROSS JOIN (VALUES(1),(3),(7)) d(day)
    ), grouped AS (
      SELECT v.platform,v.build,v.locale,v.source,count(*)::int visits,count(distinct v.account_id)::int accounts,
        count(distinct a.account_id)::int anchor_accounts,
        ${sql.join([1, 3, 7].map(day => sql`
          jsonb_build_object('mature',count(*) FILTER (WHERE e.day=${day} AND e.mature)::int,
            'returned',count(*) FILTER (WHERE e.day=${day} AND e.mature AND e.returned)::int,
            'pending',count(*) FILTER (WHERE e.day=${day} AND NOT e.mature)::int) AS ${sql.identifier(`d${day}`)}`), sql`, `)}
      FROM visits v LEFT JOIN anchors a ON a.visitor_id=v.id
      LEFT JOIN evaluated e ON e.account_id=a.account_id
      GROUP BY v.platform,v.build,v.locale,v.source
    ) SELECT platform,build,locale,source,
      (SELECT count(*)::int FROM visits v WHERE (v.platform,v.build,v.locale)=(g.platform,g.build,g.locale) AND v.source IS NOT DISTINCT FROM g.source) visits,
      (SELECT count(distinct v.account_id)::int FROM visits v WHERE (v.platform,v.build,v.locale)=(g.platform,g.build,g.locale) AND v.source IS NOT DISTINCT FROM g.source) accounts,
      anchor_accounts AS "anchorAccounts", jsonb_build_object('d1',d1,'d3',d3,'d7',d7) retention
    FROM grouped g ORDER BY visits DESC LIMIT 51`);
  return z.array(rowSchema).parse(rows);
}

const signupSchema = z.object({ accounts: z.number(), measured: z.number(), d1: windowSchema, d3: windowSchema, d7: windowSchema });

/**
 * THE PRIMARY SERIES: D1/D3/D7 from the account's own creation (plan 2026-11-08 F1). Unlike the
 * first-ready cohort it keeps whoever never reached a ready scene. An account with no client visit
 * on record is counted apart: nothing says it did not come back, so it is no failure either.
 */
export async function signupRetention(db: Db, now: Date, cohort: SQLWrapper) {
  const [row] = await db.execute(sql`
    WITH anchors AS (SELECT c.id account_id, c.created_at anchor_at FROM (${cohort}) c),
    measured AS (SELECT a.* FROM anchors a WHERE EXISTS (SELECT 1 FROM analytics_visitors v
      WHERE v.account_id=a.account_id AND v.metadata->>'scope' <> 'server_player')),
    evaluated AS (
      SELECT d.day, ${now.toISOString()}::timestamptz >= m.anchor_at + (d.day+1)*interval '1 day' mature,
        EXISTS (SELECT 1 FROM analytics_events e WHERE e.account_id=m.account_id AND e.time_trusted AND e.mode='live'
          AND ((e.source='client_observation' AND e.name='game_ready') OR (e.source='server_fact' AND e.name='command_accepted'))
          AND e.occurred_at >= m.anchor_at + d.day*interval '1 day' AND e.occurred_at < m.anchor_at + (d.day+1)*interval '1 day') returned
      FROM measured m CROSS JOIN (VALUES (1),(3),(7)) d(day)
    )
    SELECT (SELECT count(*)::int FROM anchors) accounts, (SELECT count(*)::int FROM measured) measured,
      ${sql.join([1, 3, 7].map(day => sql`jsonb_build_object('mature', count(*) FILTER (WHERE day=${day} AND mature)::int,
        'returned', count(*) FILTER (WHERE day=${day} AND mature AND returned)::int,
        'pending', count(*) FILTER (WHERE day=${day} AND NOT mature)::int) AS ${sql.identifier(`d${day}`)}`), sql`, `)}
    FROM evaluated`);
  return signupSchema.parse(row);
}
