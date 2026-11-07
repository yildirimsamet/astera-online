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
  return { accounts: rows.length, sessions: rows.reduce((n, row) => n + row.sessions, 0), returnedAccounts: rows.filter(row => row.sessions >= 2).length, steps,
    push: { asked: rows.filter(row => row.asked > 0).length, granted: rows.filter(row => row.granted > 0).length, denied: rows.filter(row => row.denied > 0).length },
    crates: { accounts: rows.filter(row => row.crates > 0).length, opened: rows.reduce((n, row) => n + row.crates, 0) } };
}
