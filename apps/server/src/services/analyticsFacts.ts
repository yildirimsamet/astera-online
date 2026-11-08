import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { analyticsEvents, analyticsSessions, analyticsVisitors } from '../db/schema.js';

interface RecoveredFact extends Record<string, unknown> { id: string; at: Date | string; account_id: string; player_id: string | null; season_id: string | null;
  attempt_id: string | null; visitor_id: string; context_id: string; subject: string; code: string; count: number; value?: number | null; ref_id?: string; phase?: string }

/** The resources at `path` in a ship's result payload, summed; a missing or non-numeric amount counts as none. */
const held = (path: 'cargo' | 'wasted') => sql.raw(['alloy', 'crystal', 'deuterium'].map(key =>
  `CASE WHEN jsonb_typeof(n.payload #> '{${path},${key}}') = 'number' THEN (n.payload #>> '{${path},${key}}')::float8 ELSE 0 END`).join(' + '));

/** Recover immutable command rows after commit. Optional writes never share gameplay's transaction. */
export async function recoverAnalyticsCommands(db: Db, clock: Clock): Promise<void> {
  const cutoff = new Date(clock.now().getTime() - (30 * 86_400_000 - 3_600_000)).toISOString();
  const rows = await db.execute<RecoveredFact>(sql`
    WITH commands AS (
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        kind AS subject, subject AS code, count FROM build_orders WHERE origin='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'RESEARCH', project_id, level FROM research_orders WHERE origin='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'MINING', target_kind, craft FROM mining_runs WHERE command_source='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'MISSION', kind::text, 1 FROM missions WHERE command_source='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'TRADE', 'trade', 1 FROM trade_runs WHERE command_source='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'PIRATE', 'raid', 1 FROM pirate_raids WHERE command_source='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'MONUMENT', purpose, 1 FROM monument_waves WHERE command_source='manual_http' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT o.id, o.ordered_at, s.account_id, NULL::uuid, NULL::uuid, o.analytics_visit_hash, o.analytics_attempt_id,
        'VESSEL_' || o.queue, o.subject || ':' || o.stage::text, o.count FROM vessel_orders o INNER JOIN vessels s ON s.id=o.vessel_id
        WHERE o.analytics_visit_hash IS NOT NULL AND o.ordered_at >= ${cutoff}
      UNION ALL
      SELECT m.id, m.ordered_at, s.account_id, NULL::uuid, NULL::uuid, m.analytics_visit_hash, m.analytics_attempt_id,
        'VESSEL_' || m.kind, m.kind, 1 FROM vessel_missions m INNER JOIN vessels s ON s.id=m.owner_vessel_id
        WHERE m.analytics_visit_hash IS NOT NULL AND m.ordered_at >= ${cutoff}
    )
    SELECT c.id, c.ordered_at AS at, c.actor_account_id AS account_id, c.actor_player_id AS player_id,
      c.actor_season_id AS season_id, c.analytics_attempt_id AS attempt_id, v.id AS visitor_id, v.context_id, c.subject, c.code, c.count
    FROM commands c INNER JOIN analytics_visitors v ON v.credential_hash=c.analytics_visit_hash
    LEFT JOIN analytics_events e ON e.id=c.id LEFT JOIN bot_profiles b ON b.account_id=c.actor_account_id
    WHERE e.id IS NULL AND b.account_id IS NULL AND c.actor_account_id IS NOT NULL
      AND v.account_id=c.actor_account_id
      AND c.ordered_at BETWEEN v.created_at AND v.expires_at
    ORDER BY c.ordered_at LIMIT 256`);
  for (const row of rows) {
    await storeRecoveredFact(db, clock, row, 'command_accepted');
  }
  // A completed status is the evidence; ready_at alone never proves completion.
  const outcomes = await db.execute<RecoveredFact>(sql`
    WITH work AS (
      SELECT id, ordered_at, ready_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        kind AS subject FROM build_orders WHERE origin='manual_http' AND status='COMPLETED' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, ordered_at, ready_at, actor_account_id, actor_player_id, actor_season_id, analytics_visit_hash, analytics_attempt_id,
        'RESEARCH' FROM research_orders WHERE origin='manual_http' AND status='COMPLETED' AND ordered_at >= ${cutoff}
    ), identified AS (
      SELECT *, overlay(overlay(md5('astera:completion:' || id::text) placing '3' from 13 for 1) placing 'a' from 17 for 1)::uuid AS event_id FROM work
    )
    SELECT w.event_id AS id, w.id AS ref_id, w.ready_at AS at, w.actor_account_id AS account_id,
      w.actor_player_id AS player_id, w.actor_season_id AS season_id, w.analytics_attempt_id AS attempt_id,
      v.id AS visitor_id, v.context_id, w.subject, 'COMPLETED' AS code, 1 AS count
    FROM identified w INNER JOIN analytics_visitors v ON v.credential_hash=w.analytics_visit_hash
    LEFT JOIN analytics_events e ON e.id=w.event_id LEFT JOIN bot_profiles b ON b.account_id=w.actor_account_id
    WHERE e.id IS NULL AND b.account_id IS NULL AND w.actor_account_id IS NOT NULL
      AND v.account_id=w.actor_account_id
      AND w.ordered_at BETWEEN v.created_at AND v.expires_at AND w.ready_at <= ${clock.now().toISOString()}::timestamptz
    ORDER BY w.ready_at LIMIT 256`);
  for (const row of outcomes) await storeRecoveredFact(db, clock, row, 'outcome_resolved');
  // A ship's result is the note it was told by, under the order's id. A return carries what reached
  // the ship (`value`, cargo less what the full works could not take) and what was lost (`count`).
  const voyages = await db.execute<RecoveredFact>(sql`
    WITH sources AS (
      SELECT id, vessel_id, ordered_at, analytics_visit_hash, analytics_attempt_id, 'VESSEL_' || queue AS subject
        FROM vessel_orders WHERE analytics_visit_hash IS NOT NULL AND status='DONE' AND ordered_at >= ${cutoff}
      UNION ALL
      SELECT id, owner_vessel_id, ordered_at, analytics_visit_hash, analytics_attempt_id, 'VESSEL_' || kind
        FROM vessel_missions WHERE analytics_visit_hash IS NOT NULL AND ordered_at >= ${cutoff}
    ), results AS (
      SELECT s.*, n.kind AS code, n.created_at AS at,
        CASE WHEN n.kind='FLEET_HOME' THEN least(1000000, round(${held('wasted')}))::int ELSE 1 END AS count,
        CASE WHEN n.kind='FLEET_HOME' THEN least(1000000000, greatest(0, round(${held('cargo')} - (${held('wasted')})))) END AS value,
        overlay(overlay(md5('astera:vessel-result:' || n.id::text) placing '3' from 13 for 1) placing 'a' from 17 for 1)::uuid AS event_id
      FROM sources s INNER JOIN vessel_notifications n ON n.vessel_id=s.vessel_id AND n.ref_id=s.id
        AND n.kind IN ('REPAIR_DONE', 'YARD_DONE', 'RESEARCH_DONE', 'DOCK_DONE', 'FLEET_HOME', 'FLEET_TURNED_BACK', 'PROBE_REPORT')
    )
    SELECT r.event_id AS id, r.id AS ref_id, r.at, vs.account_id, NULL::uuid AS player_id, NULL::uuid AS season_id,
      r.analytics_attempt_id AS attempt_id, v.id AS visitor_id, v.context_id, r.subject, r.code, r.count, r.value, 'result_recorded' AS phase
    FROM results r INNER JOIN vessels vs ON vs.id=r.vessel_id
    INNER JOIN analytics_visitors v ON v.credential_hash=r.analytics_visit_hash
    LEFT JOIN analytics_events e ON e.id=r.event_id LEFT JOIN bot_profiles b ON b.account_id=vs.account_id
    WHERE e.id IS NULL AND b.account_id IS NULL AND v.account_id=vs.account_id AND r.ordered_at BETWEEN v.created_at AND v.expires_at
    ORDER BY r.at LIMIT 256`);
  for (const row of voyages) await storeRecoveredFact(db, clock, row, 'outcome_resolved');
  const alerts = await db.execute<RecoveredFact>(sql`
    WITH identified AS (
      SELECT a.*, overlay(overlay(md5('astera:alert-state:' || a.id::text) placing '3' from 13 for 1) placing 'a' from 17 for 1)::uuid AS event_id
      FROM paid_alerts a WHERE a.settled_at >= ${cutoff}::timestamptz AND a.status <> 'PENDING'
    )
    SELECT a.event_id AS id, a.ref_id, a.settled_at AS at, p.account_id, p.id AS player_id, p.season_id,
      NULL::uuid AS attempt_id, v.id AS visitor_id, v.context_id, a.kind AS subject, a.status::text AS code, 1 AS count,
      'ledger_state' AS phase
    FROM identified a INNER JOIN players p ON p.id=a.player_id
    INNER JOIN LATERAL (SELECT v.id, v.context_id FROM analytics_visitors v WHERE v.account_id=p.account_id
      AND a.settled_at BETWEEN v.created_at AND v.expires_at ORDER BY v.created_at DESC LIMIT 1) v ON true
    LEFT JOIN bot_profiles b ON b.account_id=p.account_id LEFT JOIN analytics_events e ON e.id=a.event_id
    WHERE b.account_id IS NULL AND e.id IS NULL ORDER BY a.settled_at LIMIT 256`);
  for (const row of alerts) await storeRecoveredFact(db, clock, row, 'alert_state');
  // The committed inbox is evidence that a result was recorded, never that it was viewed.
  // It carries no immutable season snapshot, so an unknown season stays null after a transfer.
  const results = await db.execute<RecoveredFact>(sql`
    WITH identified AS (
      SELECT n.*, overlay(overlay(md5('astera:result:' || n.id::text) placing '3' from 13 for 1) placing 'a' from 17 for 1)::uuid AS event_id
      FROM notifications n WHERE n.created_at >= ${cutoff}::timestamptz AND n.ref_id IS NOT NULL
        AND n.kind IN ('fleet_returned', 'raid_result', 'raided', 'probe_report', 'death_star_result',
          'settlement_success', 'settlement_lost', 'colony_captured', 'colony_lost', 'target_gone',
          'convoy_result', 'radiation_lost', 'clan_support_result', 'monument_probe_lost', 'radiation_bomb_result', 'unknown_signal_result')
    )
    SELECT n.event_id AS id, n.ref_id, n.created_at AS at, p.account_id, n.player_id, NULL::uuid AS season_id,
      NULL::uuid AS attempt_id, v.id AS visitor_id, v.context_id, 'notification' AS subject, n.kind::text AS code,
      CASE WHEN n.payload->>'unitsLost' ~ '^[0-9]{1,8}$' THEN least(10000, (n.payload->>'unitsLost')::int) ELSE 0 END AS count,
      'result_recorded' AS phase
    FROM identified n INNER JOIN players p ON p.id=n.player_id
    INNER JOIN LATERAL (SELECT v.id, v.context_id FROM analytics_visitors v WHERE v.account_id=p.account_id
      AND n.created_at BETWEEN v.created_at AND v.expires_at ORDER BY v.created_at DESC LIMIT 1) v ON true
    LEFT JOIN bot_profiles b ON b.account_id=p.account_id LEFT JOIN analytics_events e ON e.id=n.event_id
    WHERE b.account_id IS NULL AND e.id IS NULL ORDER BY n.created_at LIMIT 256`);
  for (const row of results) await storeRecoveredFact(db, clock, row, 'outcome_resolved');
  const transfers = await db.execute<RecoveredFact>(sql`
    SELECT t.id, t.id AS ref_id, t.committed_at AS at, t.account_id, t.player_id, t.source_season_id AS season_id,
      NULL::uuid AS attempt_id, v.id AS visitor_id, v.context_id, 'commander' AS subject, t.direction AS code, 1 AS count,
      'transfer_committed' AS phase
    FROM commander_transfers t
    INNER JOIN LATERAL (SELECT v.id, v.context_id FROM analytics_visitors v WHERE v.account_id=t.account_id
      AND t.committed_at BETWEEN v.created_at AND v.expires_at ORDER BY v.created_at DESC LIMIT 1) v ON true
    LEFT JOIN bot_profiles b ON b.account_id=t.account_id LEFT JOIN analytics_events e ON e.id=t.id
    WHERE t.committed_at >= ${cutoff}::timestamptz AND b.account_id IS NULL AND e.id IS NULL
    ORDER BY t.committed_at LIMIT 256`);
  for (const row of transfers) await storeRecoveredFact(db, clock, row, 'commander_transfer');
}

async function storeRecoveredFact(db: Db, clock: Clock, row: RecoveredFact, name: 'command_accepted' | 'outcome_resolved' | 'alert_state' | 'commander_transfer'): Promise<void> {
    const at = new Date(row.at);
    await db.transaction(async tx => {
      const [visitor] = await tx.select().from(analyticsVisitors).where(eq(analyticsVisitors.id, row.visitor_id)).for('update');
      if (visitor?.accountId !== row.account_id) return;
      // Fact container has no foreground samples and is excluded from observed session counts.
      await tx.insert(analyticsSessions).values({ id: row.visitor_id, visitorId: row.visitor_id, contextId: row.context_id,
        accountId: row.account_id, firstAt: at, lastAt: at }).onConflictDoNothing();
      await tx.insert(analyticsEvents).values({ id: row.id, visitorId: row.visitor_id, sessionId: row.visitor_id,
        accountId: row.account_id, playerId: row.player_id, seasonId: row.season_id,
        name, mode: 'live', source: 'server_fact', sequence: 0,
        occurredAt: at, receivedAt: clock.now(), timeTrusted: true, payloadHash: `${name}:${row.id}`,
        properties: { subject: row.subject, code: row.code, count: row.count, ...(row.value == null ? {} : { value: row.value }), refId: row.ref_id ?? row.id,
          ...(row.phase ? { phase: row.phase } : name === 'outcome_resolved' ? { phase: 'effective_completion' } : {}), ...(row.attempt_id ? { attemptId: row.attempt_id } : {}) },
      }).onConflictDoNothing();
    });
}
