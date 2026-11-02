import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, notInArray, notExists, or, sql } from 'drizzle-orm';
import { accounts, analyticsDailyAggregates, analyticsEvents, analyticsSessions, analyticsVisitors, botProfiles, players, seasons, shards } from '../db/schema.js';
import { requireAdmin } from './community.js';
import { summarizePlayerObservations } from '../../../web/src/api/analyticsReportModel.js';
import { analyticsAdminQuerySchema, analyticsFiltersSchema, type AnalyticsFilters } from '../../../web/src/api/analyticsAdminSchemas.js';
import { analyticsCohorts } from '../services/analyticsCohorts.js';

export function registerAnalyticsAdmin(app: FastifyInstance): void {
  const excluded = () => and(notExists(app.db.select({ id: botProfiles.accountId }).from(botProfiles).where(eq(botProfiles.accountId, accounts.id))),
    app.adminUsernames.size ? notInArray(accounts.username, [...app.adminUsernames]) : undefined);
  const matchingVisits = (filters: AnalyticsFilters, start: Date) => app.db.select({ id: analyticsVisitors.id }).from(analyticsVisitors)
    .leftJoin(accounts, eq(accounts.id, analyticsVisitors.accountId))
    .where(and(gte(analyticsVisitors.createdAt, start), or(isNull(accounts.id), excluded()),
      ...(['build', 'locale', 'platform'] as const).map(key => filters[key] ? sql`${analyticsVisitors.metadata}->>${key} = ${filters[key]}` : undefined),
      filters.source !== undefined ? sql`${analyticsVisitors.metadata}->'campaign'->>'utm_source' = ${filters.source}` : undefined,
      'username' in filters && typeof filters.username === 'string' ? eq(accounts.username, filters.username.toLowerCase()) : undefined,
      filters.trainingVersion ? sql`EXISTS (SELECT 1 FROM analytics_events t WHERE t.visitor_id=${analyticsVisitors.id}
        AND t.mode='training' AND t.properties->>'trainingVersion'=${filters.trainingVersion})` : undefined));
  app.get('/api/admin/analytics', { preHandler: requireAdmin }, async req => {
    const query = analyticsAdminQuerySchema.parse(req.query);
    const now = app.clock.now(), start = new Date(now.getTime() - (30 * 86_400_000 - 3_600_000));
    const cutoff = new Date(now.getTime() - query.inactiveHours * 3_600_000);
    const eligibleVisits = matchingVisits(query, start);
    const hasFilters = Object.keys(analyticsFiltersSchema.shape).some(key => Reflect.get(query, key) !== undefined);
    const accountScope = () => and(excluded(), query.username ? eq(accounts.username, query.username.toLowerCase()) : undefined,
      hasFilters ? inArray(accounts.id, app.db.select({ id: analyticsVisitors.accountId }).from(analyticsVisitors)
        .where(inArray(analyticsVisitors.id, eligibleVisits))) : undefined);
    const rows = await app.db.select({ accountId: accounts.id, username: accounts.username, lastActiveAt: players.lastActiveAt,
      lastProgressAt: players.lastProgressAt, galaxy: shards.name }).from(accounts)
      .leftJoin(players, eq(players.accountId, accounts.id)).leftJoin(seasons, eq(seasons.id, players.seasonId))
      .leftJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(accountScope(), query.after ? gt(accounts.id, query.after) : undefined,
        query.inactiveHours ? or(and(isNull(players.lastActiveAt), lt(accounts.createdAt, cutoff)), lt(players.lastActiveAt, cutoff)) : undefined))
      .orderBy(asc(accounts.id)).limit(query.limit + 1);
    const more = rows.length > query.limit; rows.length = Math.min(rows.length, query.limit);
    const accountIds = rows.map(row => row.accountId);
    const measuredRows = accountIds.length ? await app.db.select({ accountId: analyticsVisitors.accountId }).from(analyticsVisitors)
      .where(and(inArray(analyticsVisitors.accountId, accountIds), inArray(analyticsVisitors.id, eligibleVisits)))
      .groupBy(analyticsVisitors.accountId) : [];
    const measuredIds = measuredRows.flatMap(row => row.accountId ? [row.accountId] : []);
    const measuredSet = new Set(measuredIds);
    // Rank within each account so neither SQL count nor response size grows with its history.
    const ranked = app.db.select({ accountId: analyticsEvents.accountId, name: analyticsEvents.name, mode: analyticsEvents.mode,
      source: analyticsEvents.source, at: analyticsEvents.occurredAt, timeTrusted: analyticsEvents.timeTrusted,
      properties: analyticsEvents.properties, contextId: analyticsSessions.contextId, sessionId: analyticsSessions.id, sequence: analyticsEvents.sequence,
      eventNumber: sql<number>`row_number() OVER (PARTITION BY ${analyticsEvents.accountId} ORDER BY ${analyticsEvents.occurredAt} DESC, ${analyticsEvents.id} DESC)`.as('event_number'),
    }).from(analyticsEvents).innerJoin(analyticsSessions, eq(analyticsSessions.id, analyticsEvents.sessionId))
      .where(and(inArray(analyticsEvents.accountId, measuredIds), inArray(analyticsEvents.visitorId, eligibleVisits), gte(analyticsEvents.occurredAt, start))).as('ranked');
    const events = measuredIds.length ? await app.db.select().from(ranked).where(lte(ranked.eventNumber, 1001)) : [];
    const byAccount = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.accountId) continue;
      const list = byAccount.get(event.accountId) ?? [];
      list.push(event); byAccount.set(event.accountId, list);
    }
    const attributions = accountIds.length ? await app.db.execute<{ account_id: string; first_visit: unknown; current_visit: unknown }>(sql`
      WITH ordered AS (SELECT v.account_id, jsonb_build_object('at',v.created_at,'build',v.metadata->>'build',
        'platform',v.metadata->>'platform','locale',v.metadata->>'locale','campaign',v.metadata->'campaign') visit,
        row_number() OVER (PARTITION BY v.account_id ORDER BY v.created_at,v.id) first_rank,
        row_number() OVER (PARTITION BY v.account_id ORDER BY v.created_at DESC,v.id DESC) last_rank
        FROM analytics_visitors v WHERE v.account_id IN (${sql.join(accountIds.map(id => sql`${id}::uuid`), sql`, `)})
          AND v.created_at >= ${start.toISOString()}::timestamptz AND v.metadata->>'scope' <> 'server_player')
      SELECT account_id, (jsonb_agg(visit) FILTER (WHERE first_rank=1))->0 first_visit,
        (jsonb_agg(visit) FILTER (WHERE last_rank=1))->0 current_visit FROM ordered GROUP BY account_id`) : [];
    const result = rows.map(row => {
      const observed = measuredSet.has(row.accountId), history = byAccount.get(row.accountId) ?? [], truncated = history.length > 1000;
      const attribution = attributions.find(value => value.account_id === row.accountId);
      return { ...row, coverage: observed ? 'observed' as const : 'unmeasured' as const, truncated,
        firstVisit: attribution?.first_visit ?? null, currentVisit: attribution?.current_visit ?? null,
        summary: observed && !truncated ? summarizePlayerObservations(history.map(e => ({ ...e, at: e.at.getTime() })), now.getTime()) : null };
    });
    const [total] = await app.db.select({ value: count() }).from(accounts).where(accountScope());
    const [measured] = await app.db.select({ value: sql<number>`count(distinct ${accounts.id})::int` }).from(accounts)
      .innerJoin(analyticsVisitors, eq(analyticsVisitors.accountId, accounts.id)).where(and(accountScope(), inArray(analyticsVisitors.id, eligibleVisits)));
    const [visits] = await app.db.select({ value: count() }).from(analyticsVisitors).where(inArray(analyticsVisitors.id, eligibleVisits));
    const cohorts = await analyticsCohorts(app.db, start, now, eligibleVisits);
    const cohortsTruncated = cohorts.length > 50; cohorts.length = Math.min(cohorts.length, 50);
    const daily = await app.db.select({ day: analyticsDailyAggregates.day, name: analyticsDailyAggregates.name,
      mode: analyticsDailyAggregates.mode, events: analyticsDailyAggregates.events, visitors: analyticsDailyAggregates.visitors })
      .from(analyticsDailyAggregates).where(and(gte(analyticsDailyAggregates.day, start), inArray(analyticsDailyAggregates.name,
        ['landing_visible', 'play_clicked', 'training_started', 'game_ready', 'command_accepted'])))
      .orderBy(desc(analyticsDailyAggregates.day)).limit(500);
    const [untrusted] = await app.db.select({ value: count() }).from(analyticsEvents)
      .where(and(inArray(analyticsEvents.visitorId, eligibleVisits), eq(analyticsEvents.timeTrusted, false)));
    const [landing] = await app.db.select({
      visibleVisits: sql<number>`count(distinct ${analyticsEvents.visitorId}) FILTER (WHERE ${analyticsEvents.name}='landing_visible')::int`,
      playVisits: sql<number>`count(distinct ${analyticsEvents.visitorId}) FILTER (WHERE ${analyticsEvents.name}='play_clicked')::int`,
      loginVisits: sql<number>`count(distinct ${analyticsEvents.visitorId}) FILTER (WHERE ${analyticsEvents.name}='login_clicked')::int`,
      loadFailedVisits: sql<number>`count(distinct ${analyticsEvents.visitorId}) FILTER (WHERE ${analyticsEvents.name}='training_load_failed')::int`,
      trainingVisits: sql<number>`count(distinct ${analyticsEvents.visitorId}) FILTER (WHERE ${analyticsEvents.name}='training_started')::int`,
    }).from(analyticsEvents).where(inArray(analyticsEvents.visitorId, eligibleVisits));
    const stepRows = await app.db.select({ step: sql<number>`(${analyticsEvents.properties}->>'step')::int`,
      attempts: sql<number>`count(distinct coalesce(${analyticsEvents.properties}->>'attemptId', ${analyticsEvents.visitorId}::text))::int` })
      .from(analyticsEvents).where(and(inArray(analyticsEvents.visitorId, eligibleVisits), eq(analyticsEvents.mode, 'training'),
        eq(analyticsEvents.name, 'training_scene_visible'), sql`${analyticsEvents.properties}->>'step' ~ '^(1[01]|[1-9])$'`))
      .groupBy(sql`(${analyticsEvents.properties}->>'step')::int`);
    return { measuredAt: now, windowStart: start, nextAfter: more ? rows.at(-1)!.accountId : null,
      landing, cohorts, cohortsTruncated, daily: hasFilters ? [] : daily,
      quality: { totalAccounts: total?.value ?? 0, measuredAccounts: measured?.value ?? 0, visits: visits?.value ?? 0, untrusted: untrusted?.value ?? 0 },
      steps: Array.from({ length: 11 }, (_, index) => ({ step: index + 1, attempts: stepRows.find(row => row.step === index + 1)?.attempts ?? 0 })), players: result };
  });
  app.get('/api/admin/analytics/visits', { preHandler: requireAdmin }, async req => {
    const query = analyticsFiltersSchema.extend({ after: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(10) }).strict().parse(req.query);
    const start = new Date(app.clock.now().getTime() - (30 * 86400000 - 3600000));
    const visits = await app.db.select({ id: analyticsVisitors.id, createdAt: analyticsVisitors.createdAt,
      metadata: { build: sql<string>`${analyticsVisitors.metadata}->>'build'`, platform: sql<string>`${analyticsVisitors.metadata}->>'platform'`,
        locale: sql<string>`${analyticsVisitors.metadata}->>'locale'`, campaign: sql`${analyticsVisitors.metadata}->'campaign'` } }).from(analyticsVisitors)
      .where(and(isNull(analyticsVisitors.accountId), inArray(analyticsVisitors.id, matchingVisits(query, start)),
        query.after ? gt(analyticsVisitors.id, query.after) : undefined)).orderBy(asc(analyticsVisitors.id)).limit(query.limit + 1);
    const more = visits.length > query.limit; visits.length = Math.min(visits.length, query.limit);
    return { visits, nextAfter: more ? visits.at(-1)!.id : null };
  });
  app.get('/api/admin/analytics/visits/:visitorId/events', { preHandler: requireAdmin }, async req => {
    const { visitorId } = z.object({ visitorId: z.string().uuid() }).parse(req.params);
    const query = z.object({ beforeAt: z.string().datetime().optional(), beforeId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50) }).strict().refine(q => Boolean(q.beforeAt) === Boolean(q.beforeId)).parse(req.query);
    const events = await app.db.select({ id: analyticsEvents.id, name: analyticsEvents.name, mode: analyticsEvents.mode, source: analyticsEvents.source,
      occurredAt: analyticsEvents.occurredAt, receivedAt: analyticsEvents.receivedAt, timeTrusted: analyticsEvents.timeTrusted,
      contextId: analyticsSessions.contextId, sessionId: analyticsSessions.id, properties: analyticsEvents.properties }).from(analyticsEvents)
      .innerJoin(analyticsSessions, eq(analyticsSessions.id, analyticsEvents.sessionId)).innerJoin(analyticsVisitors, eq(analyticsVisitors.id, analyticsEvents.visitorId))
      .where(and(eq(analyticsVisitors.id, visitorId), isNull(analyticsVisitors.accountId),
        gte(analyticsVisitors.createdAt, new Date(app.clock.now().getTime() - (30 * 86400000 - 3600000))),
        query.beforeAt && query.beforeId ? sql`(${analyticsEvents.occurredAt},${analyticsEvents.id}) < (${query.beforeAt}::timestamptz,${query.beforeId}::uuid)` : undefined))
      .orderBy(desc(analyticsEvents.occurredAt), desc(analyticsEvents.id)).limit(query.limit + 1);
    const more = events.length > query.limit; events.length = Math.min(events.length, query.limit); const last = events.at(-1);
    return { events, nextBefore: more && last ? { at: last.occurredAt.toISOString(), id: last.id } : null };
  });
  app.get('/api/admin/analytics/accounts/:accountId/events', { preHandler: requireAdmin }, async req => {
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(req.params);
    const query = analyticsFiltersSchema.extend({ beforeAt: z.string().datetime().optional(), beforeId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50) }).strict()
      .refine(q => Boolean(q.beforeAt) === Boolean(q.beforeId)).parse(req.query);
    const events = await app.db.select({ id: analyticsEvents.id, name: analyticsEvents.name, mode: analyticsEvents.mode,
      source: analyticsEvents.source, occurredAt: analyticsEvents.occurredAt, receivedAt: analyticsEvents.receivedAt,
      timeTrusted: analyticsEvents.timeTrusted, contextId: analyticsSessions.contextId, sessionId: analyticsSessions.id,
      properties: analyticsEvents.properties }).from(analyticsEvents).innerJoin(analyticsSessions, eq(analyticsSessions.id, analyticsEvents.sessionId))
      .where(and(eq(analyticsEvents.accountId, accountId),
        inArray(analyticsEvents.visitorId, matchingVisits(query, new Date(app.clock.now().getTime() - (30 * 86_400_000 - 3_600_000)))),
        gte(analyticsEvents.occurredAt, new Date(app.clock.now().getTime() - (30 * 86_400_000 - 3_600_000))),
        query.beforeAt && query.beforeId ? sql`(${analyticsEvents.occurredAt}, ${analyticsEvents.id}) < (${query.beforeAt}::timestamptz, ${query.beforeId}::uuid)` : undefined))
      .orderBy(desc(analyticsEvents.occurredAt), desc(analyticsEvents.id)).limit(query.limit + 1);
    const more = events.length > query.limit; events.length = Math.min(query.limit, events.length);
    const last = events.at(-1);
    return { events, nextBefore: more && last ? { at: last.occurredAt.toISOString(), id: last.id } : null };
  });
}
