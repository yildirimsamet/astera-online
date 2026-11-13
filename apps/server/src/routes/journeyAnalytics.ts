import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, gte, inArray, lt, notExists, notInArray } from 'drizzle-orm';
import { accounts, analyticsEvents, analyticsSessions, botProfiles, players, shards, starterGalaxies, vesselBotState, vesselMissions, vesselOrders, vessels } from '../db/schema.js';
import { requireAdmin } from './community.js';
import { GameError } from '../services/planet.js';
import { journeyQuerySchema, type JourneyReport } from '../../../web/src/api/journeySchemas.js';
import { journeyPlayer, type JourneyInput } from '../../../web/src/api/journeyModel.js';

const ACCOUNT_LIMIT = 500;
const RECORD_LIMIT = 20_000;
const DAY = 86_400_000;

/** A registration cohort, followed until now. Game records survive gaps in optional client observations. */
export function registerJourneyAnalytics(app: FastifyInstance): void {
  app.get('/api/admin/analytics/journey', { preHandler: requireAdmin }, async req => {
    const query = journeyQuerySchema.parse(req.query);
    const now = app.clock.now().getTime();
    const from = query.from ? Date.parse(query.from) : now - query.hours * 3_600_000;
    const to = query.to ? Date.parse(query.to) : now + 1;
    if (from < now - 30 * DAY || from >= to || to > now + 1 || to - from > 30 * DAY + 1) {
      throw new GameError('INVALID_INPUT', 'Choose a registration window within the last thirty days', 400);
    }
    return app.db.transaction(async db => {
      const scope = and(gte(accounts.createdAt, new Date(from)), lt(accounts.createdAt, new Date(to)),
        notExists(db.select({ id: botProfiles.accountId }).from(botProfiles).where(eq(botProfiles.accountId, accounts.id))),
        notExists(db.select({ id: vessels.id }).from(vessels).innerJoin(vesselBotState, eq(vesselBotState.vesselId, vessels.id)).where(eq(vessels.accountId, accounts.id))),
        app.adminUsernames.size ? notInArray(accounts.username, [...app.adminUsernames]) : undefined);
      const [total] = await db.select({ n: count() }).from(accounts).where(scope);
      const rows = await db.select({ accountId: accounts.id, username: accounts.username, createdAt: accounts.createdAt,
        guideOffAt: accounts.starterGuideOffAt, vesselId: vessels.id, enlistedAt: vessels.enlistedAt, lastSeenAt: vessels.lastSeenAt, mainLastActiveAt: players.lastActiveAt,
        modules: vessels.modules, facts: vessels.facts, status: vessels.status, ordinal: starterGalaxies.ordinal, shard: shards.name,
      }).from(accounts).leftJoin(vessels, eq(vessels.accountId, accounts.id)).leftJoin(players, eq(players.accountId, accounts.id))
        .leftJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId)).leftJoin(shards, eq(shards.id, starterGalaxies.shardId))
        .where(scope).orderBy(asc(accounts.createdAt), asc(accounts.id)).limit(ACCOUNT_LIMIT);
      const accountIds = rows.map(row => row.accountId);
      const vesselIds = rows.flatMap(row => row.vesselId ? [row.vesselId] : []);
      // Three bounded set reads, never one round trip per commander. Clipped data is marked in the report.
      const [events, orders, missions] = await Promise.all([
        accountIds.length ? db.select({ accountId: analyticsEvents.accountId, at: analyticsEvents.occurredAt,
          name: analyticsEvents.name, source: analyticsEvents.source, mode: analyticsEvents.mode, timeTrusted: analyticsEvents.timeTrusted,
          properties: analyticsEvents.properties, sequence: analyticsEvents.sequence, sessionId: analyticsEvents.sessionId, contextId: analyticsSessions.contextId,
        }).from(analyticsEvents).innerJoin(analyticsSessions, eq(analyticsSessions.id, analyticsEvents.sessionId))
          .where(and(inArray(analyticsEvents.accountId, accountIds), gte(analyticsEvents.occurredAt, new Date(from)), lt(analyticsEvents.occurredAt, new Date(now + 1))))
          .orderBy(asc(analyticsEvents.occurredAt), asc(analyticsEvents.id)).limit(RECORD_LIMIT + 1) : [],
        vesselIds.length ? db.select().from(vesselOrders).where(inArray(vesselOrders.vesselId, vesselIds))
          .orderBy(asc(vesselOrders.orderedAt), asc(vesselOrders.id)).limit(RECORD_LIMIT + 1) : [],
        vesselIds.length ? db.select().from(vesselMissions).where(inArray(vesselMissions.ownerVesselId, vesselIds))
          .orderBy(asc(vesselMissions.orderedAt), asc(vesselMissions.id)).limit(RECORD_LIMIT + 1) : [],
      ]);
      const clipped = events.length > RECORD_LIMIT || orders.length > RECORD_LIMIT || missions.length > RECORD_LIMIT;
      const byAccount = new Map<string, JourneyInput['observations'][number][]>();
      for (const e of events.slice(0, RECORD_LIMIT)) {
        if (!e.accountId) continue;
        const list = byAccount.get(e.accountId) ?? [];
        list.push({ ...e, at: e.at.getTime() }); byAccount.set(e.accountId, list);
      }
      const byVessel = new Map<string, JourneyInput['work'][number][]>();
      for (const order of orders.slice(0, RECORD_LIMIT)) {
        if (!order.orderedAt) continue;
        const list = byVessel.get(order.vesselId) ?? [];
        list.push({ at: order.orderedAt.getTime(), endsAt: order.status === 'CANCELLED' ? null : order.readyAt.getTime(), kind: 'order',
          code: order.subject, queue: order.queue, done: order.status === 'DONE' });
        byVessel.set(order.vesselId, list);
      }
      for (const mission of missions.slice(0, RECORD_LIMIT)) {
        if (!mission.ownerVesselId || !mission.orderedAt) continue;
        const list = byVessel.get(mission.ownerVesselId) ?? [];
        list.push({ at: mission.orderedAt.getTime(), endsAt: mission.status === 'CANCELLED' ? null : (mission.returnAt ?? mission.arriveAt).getTime(),
          kind: 'mission', code: mission.kind, done: mission.status === 'DONE' });
        byVessel.set(mission.ownerVesselId, list);
      }
      const report: JourneyReport = { measuredAt: now, from, to, absentMinutes: query.absentMinutes, totalAccounts: total?.n ?? 0,
        truncated: clipped || (total?.n ?? 0) > ACCOUNT_LIMIT,
        players: rows.map(row => journeyPlayer({ accountId: row.accountId, username: row.username, joinedAt: row.createdAt.getTime(),
          enlistedAt: row.enlistedAt?.getTime() ?? null,
          lastSeenAt: row.lastSeenAt || row.mainLastActiveAt ? Math.max(row.lastSeenAt?.getTime() ?? 0, row.mainLastActiveAt?.getTime() ?? 0) : null,
          guideOffAt: row.guideOffAt?.getTime() ?? null,
          modules: row.modules ?? {}, facts: row.facts ?? [], departed: row.status === 'DEPARTED',
          galaxy: row.ordinal === null ? null : `${row.shard ?? ''} · Starter ${String(row.ordinal)}`,
          work: row.vesselId ? byVessel.get(row.vesselId) ?? [] : [], observations: byAccount.get(row.accountId) ?? [], truncated: clipped,
        }, now, query.absentMinutes)),
      };
      return report;
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  });
}
