import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance } from 'fastify';
import { visitorHash } from './playerAnalytics.js';
import { analyticsCommand } from '../../../web/src/api/analyticsCommands.js';
import { and, eq, gte, sql } from 'drizzle-orm';
import { analyticsVisitors } from '../db/schema.js';

interface Origin { accountId: string; visitHash: string | null; attemptId: string | null }
const origin = new AsyncLocalStorage<Origin>();
export function commandProvenance(now: Date, playerId: string, seasonId: string) {
  const actor = origin.getStore();
  return { orderedAt: now, actorAccountId: actor?.accountId ?? null, actorPlayerId: actor ? playerId : null,
    actorSeasonId: actor ? seasonId : null, origin: actor ? 'manual_http' as const : 'internal' as const,
    analyticsVisitHash: actor?.visitHash ?? null, analyticsAttemptId: actor?.attemptId ?? null };
}
export function dispatchProvenance(now: Date, playerId: string, seasonId: string) {
  const { origin: commandSource, ...metadata } = commandProvenance(now, playerId, seasonId);
  return { ...metadata, commandSource };
}
/** Only authenticated player command handlers establish manual provenance; workers never do. */
export function installCommandOrigin(app: FastifyInstance, collection: boolean): void {
  app.addHook('onRoute', route => {
    if (route.method !== 'POST' || !analyticsCommand(route.url)) return;
    const handler = route.handler;
    route.handler = async function (req, reply) {
      if (!req.accountId) return handler.call(this, req, reply);
      const header = req.headers['x-analytics-visitor'];
      let visitHash: string | null = null;
      if (collection && typeof header === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(header)) {
        try {
          const hash = visitorHash(header);
          const [visitor] = await app.db.transaction(async tx => {
            // A locked optional table must release the connection promptly and leave gameplay free to continue.
            await tx.execute(sql`SET LOCAL statement_timeout = '250ms'`);
            return tx.select({ id: analyticsVisitors.id }).from(analyticsVisitors)
              .where(and(eq(analyticsVisitors.credentialHash, hash), eq(analyticsVisitors.accountId, req.accountId!),
                gte(analyticsVisitors.expiresAt, app.clock.now()))).limit(1);
          });
          if (visitor) visitHash = hash;
        } catch { /* Optional attribution cannot refuse an otherwise valid gameplay command. */ }
      }
      const attempt = req.headers['x-analytics-attempt'];
      const attemptId = visitHash && typeof attempt === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(attempt) ? attempt : null;
      return origin.run({ accountId: req.accountId, visitHash, attemptId }, () => handler.call(this, req, reply));
    };
  });
}
