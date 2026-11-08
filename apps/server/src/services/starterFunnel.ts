import { and, eq, inArray, sql, type SQLWrapper } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { analyticsEvents } from '../db/schema.js';
import { STARTER_TUTORIAL_STEPS } from '../../../web/src/api/starterTutorialSteps.js';

/** The same eligible-visit selection as the admin report; no player history or event text leaves SQL. */
export async function starterFunnel(db: Db, eligibleVisits: SQLWrapper) {
  const scoped = db.selectDistinct({ accountId: analyticsEvents.accountId }).from(analyticsEvents).where(and(
    inArray(analyticsEvents.visitorId, eligibleVisits), eq(analyticsEvents.mode, 'live'),
    sql`(${analyticsEvents.name}='vessel_enlisted' OR (${analyticsEvents.name}='training_scene_visible' AND ${analyticsEvents.properties}->>'trainingVersion'='starter-tutorial.v1'))`,
  ));
  const rows = await db.select({
    accountId: analyticsEvents.accountId,
    sessions: sql<number>`count(distinct ${analyticsEvents.sessionId}) FILTER (WHERE ${analyticsEvents.name}='foreground_started')::int`,
    asked: sql<number>`count(*) FILTER (WHERE ${analyticsEvents.name}='alert_permission' AND ${analyticsEvents.properties}->>'variant'='push')::int`,
    granted: sql<number>`count(*) FILTER (WHERE ${analyticsEvents.name}='alert_permission' AND ${analyticsEvents.properties}->>'variant'='push' AND ${analyticsEvents.properties}->>'code'='granted')::int`,
    denied: sql<number>`count(*) FILTER (WHERE ${analyticsEvents.name}='alert_permission' AND ${analyticsEvents.properties}->>'variant'='push' AND ${analyticsEvents.properties}->>'code' IN ('denied','dismissed'))::int`,
    crates: sql<number>`coalesce(sum(CASE WHEN ${analyticsEvents.name}='outcome_visible' AND ${analyticsEvents.properties}->>'surface'='starter_crate' AND ${analyticsEvents.properties}->>'count' ~ '^[0-9]+$' THEN (${analyticsEvents.properties}->>'count')::int ELSE 0 END),0)::int`,
  }).from(analyticsEvents).where(and(inArray(analyticsEvents.visitorId, eligibleVisits), inArray(analyticsEvents.accountId, scoped), eq(analyticsEvents.mode, 'live'))).groupBy(analyticsEvents.accountId);
  const scenes = await db.select({ scene: sql<string>`${analyticsEvents.properties}->>'scene'`, accounts: sql<number>`count(distinct ${analyticsEvents.accountId})::int` })
    .from(analyticsEvents).where(and(inArray(analyticsEvents.visitorId, eligibleVisits), inArray(analyticsEvents.accountId, scoped), eq(analyticsEvents.name, 'training_scene_visible'), eq(analyticsEvents.mode, 'live'), sql`${analyticsEvents.properties}->>'trainingVersion'='starter-tutorial.v1'`))
    .groupBy(sql`${analyticsEvents.properties}->>'scene'`);
  let previous = rows.length;
  const steps = STARTER_TUTORIAL_STEPS.filter(id => id !== 'away').map(id => {
    const accounts = scenes.find(scene => scene.scene === id)?.accounts ?? 0;
    const dropoff = Math.max(0, previous - accounts);
    previous = accounts;
    return { scene: id, accounts, dropoff };
  });
  // Each link needs the one before it, by the server's ids: a read result is one this account was told.
  const [chain] = await db.execute<{ accepted: number; resolved: number; viewed: number; decided: number; returned: number; gained: number; wasted: number }>(sql`
    WITH ev AS (SELECT account_id, name, source, occurred_at, properties p FROM analytics_events
      WHERE visitor_id IN (${eligibleVisits}) AND account_id IN (${scoped}) AND mode='live'
        AND name IN ('command_accepted', 'outcome_resolved', 'outcome_visible')),
    accepted AS (SELECT account_id, p->>'refId' ref FROM ev WHERE name='command_accepted' AND source='server_fact' AND starts_with(p->>'subject', 'VESSEL_')),
    resolved AS (SELECT r.account_id, r.p, r.occurred_at FROM ev r INNER JOIN accepted a ON a.account_id=r.account_id AND a.ref=r.p->>'refId'
      WHERE r.name='outcome_resolved' AND r.source='server_fact'),
    viewed AS (SELECT r.account_id, min(v.occurred_at) at FROM resolved r INNER JOIN ev v ON v.account_id=r.account_id
      AND v.name='outcome_visible' AND v.source='client_observation' AND v.p->>'refId'=r.p->>'refId' GROUP BY r.account_id),
    decided AS (SELECT DISTINCT v.account_id FROM viewed v INNER JOIN ev e ON e.account_id=v.account_id
      AND e.name='command_accepted' AND e.source='server_fact' AND e.occurred_at > v.at),
    haul AS (SELECT DISTINCT ON (account_id) account_id, (p->>'value')::float8 net, (p->>'count')::int lost FROM resolved
      WHERE p->>'subject'='VESSEL_MINE' AND p->>'code'='FLEET_HOME' ORDER BY account_id, occurred_at)
    SELECT (SELECT count(DISTINCT account_id)::int FROM accepted) accepted, (SELECT count(DISTINCT account_id)::int FROM resolved) resolved,
      (SELECT count(*)::int FROM viewed) viewed, (SELECT count(*)::int FROM decided) decided,
      (SELECT count(*)::int FROM haul) returned, (SELECT count(*) FILTER (WHERE net > 0)::int FROM haul) gained,
      (SELECT count(*) FILTER (WHERE lost > 0)::int FROM haul) wasted`);
  return { accounts: rows.length, sessions: rows.reduce((n, row) => n + row.sessions, 0), returnedAccounts: rows.filter(row => row.sessions >= 2).length, steps,
    chain: { accepted: chain?.accepted ?? 0, resolved: chain?.resolved ?? 0, viewed: chain?.viewed ?? 0, decided: chain?.decided ?? 0 },
    mining: { returned: chain?.returned ?? 0, gained: chain?.gained ?? 0, wasted: chain?.wasted ?? 0 },
    push: { asked: rows.filter(row => row.asked > 0).length, granted: rows.filter(row => row.granted > 0).length, denied: rows.filter(row => row.denied > 0).length },
    crates: { accounts: rows.filter(row => row.crates > 0).length, opened: rows.reduce((n, row) => n + row.crates, 0) } };
}
