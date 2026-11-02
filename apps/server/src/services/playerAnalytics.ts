import { createHash, randomBytes } from 'node:crypto';
import { and, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { analyticsDailyAggregates, analyticsEvents, analyticsSessions, analyticsVisitors, botProfiles, buildOrders, researchOrders, miningRuns, missions, pirateRaids, tradeRuns, monumentWaves } from '../db/schema.js';
import type { AnalyticsEvent, AnalyticsVisitor } from '../../../web/src/api/analyticsSchemas.js';
import { requestHash } from './idempotency.js';
import { GameError } from './planet.js';

const DAY = 86_400_000;
export const visitorHash = (credential: string): string => createHash('sha256').update(credential).digest('hex');

export async function issueAnalyticsVisitor(db: Db, clock: Clock, metadata: AnalyticsVisitor, accountId?: string) {
  if ((metadata.scope === 'player') !== Boolean(accountId) || metadata.scope === 'server_player') throw new GameError('UNAUTHENTICATED', 'Verified player scope required', 401);
  const credential = randomBytes(32).toString('base64url');
  const now = clock.now(), expiresAt = new Date(now.getTime() + DAY);
  const [row] = await db.insert(analyticsVisitors).values({
    credentialHash: visitorHash(credential), contextId: metadata.contextId, accountId, metadata, createdAt: now, expiresAt,
  }).returning({ visitorId: analyticsVisitors.id });
  if (!row) throw new Error('Visitor insertion failed');
  return { ...row, credential, expiresAt: expiresAt.toISOString() };
}

/** Authentication deliberately lives outside requireAuth: delivery must never refresh presence. */
export async function ingestAnalytics(db: Db, clock: Clock, credential: string, events: AnalyticsEvent[], accountId?: string) {
  return db.transaction(async tx => {
    const now = clock.now();
    const [visitor] = await tx.select().from(analyticsVisitors)
      .where(eq(analyticsVisitors.credentialHash, visitorHash(credential))).for('update');
    if (!visitor || visitor.expiresAt <= now) throw new GameError('UNAUTHENTICATED', 'Visit expired', 401);
    if ((visitor.accountId ?? undefined) !== accountId) throw new GameError('ADMIN_FORBIDDEN', 'Anonymous and player scopes are separate', 403);
    if (events.some(e => e.contextId !== visitor.contextId)) throw new GameError('ADMIN_FORBIDDEN', 'Foreign context', 403);
    if (accountId) {
      const [bot] = await tx.select({ id: botProfiles.accountId }).from(botProfiles).where(eq(botProfiles.accountId, accountId));
      if (bot) return { accepted: 0, duplicates: 0 };
    }
    let duplicates = 0;
    const existing = await tx.select({ id: analyticsEvents.id, hash: analyticsEvents.payloadHash, visitorId: analyticsEvents.visitorId })
      .from(analyticsEvents).where(inArray(analyticsEvents.id, events.map(event => event.id)));
    const known = new Map(existing.map(event => [event.id, event]));
    const pending: (typeof analyticsEvents.$inferInsert)[] = [];
    const bounds = new Map<string, { first: Date; last: Date }>();
    for (const event of events) {
      const hash = requestHash(event), prior = known.get(event.id);
      if (prior) {
        if (prior.visitorId !== visitor.id || prior.hash !== hash) throw new GameError('IDEMPOTENCY_CONFLICT', 'Event changed', 409);
        duplicates++; continue;
      }
      known.set(event.id, { id: event.id, hash, visitorId: visitor.id });
      const trusted = event.occurredAt >= visitor.createdAt.getTime() - 300_000
        && event.occurredAt >= now.getTime() - DAY && event.occurredAt <= now.getTime() + 300_000;
      const at = trusted ? new Date(Math.min(event.occurredAt, now.getTime())) : now;
      const range = bounds.get(event.sessionId);
      bounds.set(event.sessionId, { first: range && range.first < at ? range.first : at, last: range && range.last > at ? range.last : at });
      pending.push({ id: event.id, visitorId: visitor.id, sessionId: event.sessionId, accountId,
        name: event.name, mode: event.mode, source: event.source, clientAt: event.occurredAt,
        sequence: event.sequence, occurredAt: at, receivedAt: now, timeTrusted: trusted, payloadHash: hash, properties: event.properties });
    }
    if (!pending.length) return { accepted: 0, duplicates };
    // Stable session ordering also keeps concurrent multi-session batches from inverting row locks.
    const orderedBounds = [...bounds].sort(([a], [b]) => a.localeCompare(b));
    await tx.insert(analyticsSessions).values(orderedBounds.map(([id, range]) => ({ id, visitorId: visitor.id,
      contextId: visitor.contextId, accountId, firstAt: range.first, lastAt: range.last }))).onConflictDoNothing();
    const sessions = await tx.select({ id: analyticsSessions.id, visitorId: analyticsSessions.visitorId })
      .from(analyticsSessions).where(inArray(analyticsSessions.id, orderedBounds.map(([id]) => id)));
    if (sessions.some(session => session.visitorId !== visitor.id)) throw new GameError('ADMIN_FORBIDDEN', 'Foreign session', 403);
    const values = orderedBounds.map(([id, range]) => sql`(${id}::uuid, ${range.first.toISOString()}::timestamptz, ${range.last.toISOString()}::timestamptz)`);
    await tx.execute(sql`UPDATE analytics_sessions s SET first_at=least(s.first_at, v.first_at), last_at=greatest(s.last_at, v.last_at)
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id,first_at,last_at) WHERE s.id=v.id AND s.visitor_id=${visitor.id}::uuid`);
    const inserted = await tx.insert(analyticsEvents).values(pending).onConflictDoNothing().returning({ id: analyticsEvents.id });
    if (inserted.length !== pending.length) {
      // Another visit may race the same global event ID. A collision is never a silent success.
      const insertedIds = new Set(inserted.map(event => event.id));
      const collisions = await tx.select().from(analyticsEvents).where(inArray(analyticsEvents.id,
        pending.filter(event => !insertedIds.has(event.id)).map(event => event.id)));
      for (const collision of collisions) {
        if (collision.visitorId !== visitor.id || collision.payloadHash !== known.get(collision.id)?.hash) {
          throw new GameError('IDEMPOTENCY_CONFLICT', 'Event changed', 409);
        }
      }
      duplicates += pending.length - inserted.length;
    }
    return { accepted: inserted.length, duplicates };
  });
}

export async function revokeAnalyticsVisitor(db: Db, credential: string): Promise<void> {
  const hash = visitorHash(credential);
  await db.transaction(async tx => {
    await tx.delete(analyticsVisitors).where(eq(analyticsVisitors.credentialHash, hash));
    for (const table of [buildOrders, researchOrders, miningRuns, missions, pirateRaids, tradeRuns, monumentWaves]) {
      await tx.update(table).set({ analyticsVisitHash: null, analyticsAttemptId: null }).where(eq(table.analyticsVisitHash, hash));
    }
  });
}

/** A fixed initial grant and immutable receive dates prevent replay from extending retention. */
export async function purgeAnalytics(db: Db, clock: Clock): Promise<void> {
  const cutoff = new Date(clock.now().getTime() - (30 * DAY - 3_600_000));
  // Remove children first so a visitor delete cannot trigger one enormous FK cascade.
  for (;;) {
    const removed = await db.execute(sql`DELETE FROM analytics_events WHERE id IN (
      SELECT e.id FROM analytics_events e WHERE (e.received_at < ${cutoff.toISOString()}::timestamptz AND e.occurred_at < ${cutoff.toISOString()}::timestamptz)
      OR EXISTS (SELECT 1 FROM analytics_visitors v WHERE v.id=e.visitor_id AND v.created_at < ${cutoff.toISOString()}::timestamptz)
      LIMIT 2048) RETURNING id`);
    if (!removed.length) break;
  }
  for (;;) {
    const removed = await db.execute(sql`DELETE FROM analytics_sessions WHERE id IN (
      SELECT s.id FROM analytics_sessions s INNER JOIN analytics_visitors v ON v.id=s.visitor_id
      WHERE v.created_at < ${cutoff.toISOString()}::timestamptz LIMIT 256) RETURNING id`);
    if (!removed.length) break;
  }
  for (;;) {
    const ids = await db.select({ id: analyticsVisitors.id }).from(analyticsVisitors).where(lt(analyticsVisitors.createdAt, cutoff)).limit(256);
    if (!ids.length) break;
    await db.delete(analyticsVisitors).where(inArray(analyticsVisitors.id, ids.map(row => row.id)));
  }
  for (;;) {
    const ids = await db.select({ id: analyticsDailyAggregates.id }).from(analyticsDailyAggregates).where(lt(analyticsDailyAggregates.day, cutoff)).limit(256);
    if (!ids.length) break;
    await db.delete(analyticsDailyAggregates).where(inArray(analyticsDailyAggregates.id, ids.map(row => row.id)));
  }
  for (const table of [buildOrders, researchOrders, miningRuns, missions, pirateRaids, tradeRuns, monumentWaves]) {
    for (;;) {
      const ids = await db.select({ id: table.id }).from(table)
        .where(and(lt(table.orderedAt, cutoff), or(isNotNull(table.actorAccountId), isNotNull(table.analyticsVisitHash)))).limit(256);
      if (!ids.length) break;
      await db.update(table).set({ actorAccountId: null, actorPlayerId: null, actorSeasonId: null, analyticsVisitHash: null, analyticsAttemptId: null })
        .where(inArray(table.id, ids.map(row => row.id)));
    }
  }
}
