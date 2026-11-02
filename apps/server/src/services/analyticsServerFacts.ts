import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AnalyticsProperties } from '../../../web/src/api/analyticsSchemas.js';
import { analyticsEvents, analyticsSessions, analyticsVisitors, botProfiles, paidAlerts, players } from '../db/schema.js';
import { visitorHash } from './playerAnalytics.js';
import { AnalyticsRecorder } from './analyticsRecorder.js';
import { analyticsCommand, analyticsDurableCommand } from '../../../web/src/api/analyticsCommands.js';
interface Fact { accountId: string; name: 'account_created' | 'authenticated_existing' | 'placement_completed' | 'placement_failed' | 'command_accepted'; refId?: string; properties?: AnalyticsProperties }
const providerOutcome = z.object({ alertId: z.string().uuid(), accepted: z.number().int().min(0).max(10000), rejected: z.number().int().min(0).max(10000) });
type Pending = Fact & { hash: string | null; at: Date } | { provider: z.infer<typeof providerOutcome>; at: Date };
interface Sink { queue: Map<string, Pending>; recorder: AnalyticsRecorder }
const sinks = new WeakMap<FastifyInstance, Sink>();
const factId = (key: string) => {
  const hex = createHash('sha256').update(`astera.analytics:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
/** Called only after the relevant account/placement transaction has resolved. Never performs I/O in the handler. */
export function queueServerAnalytics(app: FastifyInstance, req: Pick<FastifyRequest, 'id' | 'headers'>, fact: Fact): void {
  const sink = sinks.get(app), credential = req.headers['x-analytics-visitor'];
  if (!sink) return;
  const hash = typeof credential === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(credential) ? visitorHash(credential) : null;
  if (!hash && fact.name === 'command_accepted') return;
  const retryKey = req.headers['idempotency-key'];
  const key = fact.name === 'authenticated_existing' || fact.name === 'placement_failed' ? `${fact.name}:${randomUUID()}`
    : fact.name === 'command_accepted' ? `${fact.accountId}:${fact.properties?.code ?? ''}:${typeof retryKey === 'string' ? createHash('sha256').update(retryKey).digest('hex') : randomUUID()}`
    : `${fact.name}:${fact.refId ?? fact.accountId}`;
  if (sink.queue.size >= 256 && !sink.queue.has(key)) { app.log.warn('Analytics fact queue capacity reached'); return; }
  sink.queue.set(key, { ...fact, hash, at: app.clock.now() });
  sink.recorder.wake();
}

/** Best effort for actions without an immutable recoverable source. Called after a successful response only. */
export function queueResponseCommand(app: FastifyInstance, req: FastifyRequest, status: number): void {
  if (!sinks.has(app)) return;
  if (req.method !== 'POST' || status < 200 || status >= 300 || !req.accountId) return;
  const path = req.routeOptions.url ?? req.url, code = analyticsCommand(path);
  if (!code || analyticsDurableCommand(path)) return;
  const input = req.headers['x-analytics-attempt'];
  const attemptId = typeof input === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input) ? input : undefined;
  queueServerAnalytics(app, req, { accountId: req.accountId, name: 'command_accepted', properties: { code, phase: 'response_confirmed', ...(attemptId ? { attemptId } : {}) } });
}

export function queueProviderAnalytics(app: FastifyInstance, outcome: unknown): void {
  const sink = sinks.get(app), parsed = providerOutcome.safeParse(outcome);
  if (!sink || !parsed.success) return;
  if (sink.queue.size >= 256) { app.log.warn('Analytics provider queue capacity reached'); return; }
  sink.queue.set(`provider:${randomUUID()}`, { provider: parsed.data, at: app.clock.now() });
  sink.recorder.wake();
}
export function installServerAnalytics(app: FastifyInstance): () => Promise<void> {
  const queue = new Map<string, Pending>();
  const recorder = new AnalyticsRecorder(async () => {
    for (const [key, fact] of [...queue].slice(0, 32)) {
      await app.db.transaction(async tx => {
        let accountId: string, name: string, properties: AnalyticsProperties;
        let visitor: typeof analyticsVisitors.$inferSelect | undefined;
        if ('provider' in fact) {
          const [recipient] = await tx.select({ accountId: players.accountId, refId: paidAlerts.refId }).from(paidAlerts)
            .innerJoin(players, eq(players.id, paidAlerts.playerId)).where(eq(paidAlerts.id, fact.provider.alertId));
          if (!recipient) return;
          accountId = recipient.accountId; name = 'alert_transport_result';
          properties = { refId: recipient.refId, phase: 'provider_response', variant: 'push',
            code: fact.provider.accepted && fact.provider.rejected ? 'accepted_and_rejected' : fact.provider.accepted ? 'accepted' : 'rejected',
            count: fact.provider.accepted, value: fact.provider.rejected };
          [visitor] = await tx.select().from(analyticsVisitors).where(and(eq(analyticsVisitors.accountId, accountId),
            lte(analyticsVisitors.createdAt, fact.at), gte(analyticsVisitors.expiresAt, fact.at)))
            .orderBy(desc(analyticsVisitors.createdAt)).limit(1).for('update');
        } else {
          accountId = fact.accountId; name = fact.name;
          properties = { ...(fact.refId ? { refId: fact.refId } : {}), ...fact.properties };
          if (fact.hash) [visitor] = await tx.select().from(analyticsVisitors).where(eq(analyticsVisitors.credentialHash, fact.hash)).for('update');
          if (visitor?.accountId !== accountId && fact.name !== 'command_accepted') {
            // Account/placement facts have their own server container. Never attach the anonymous visit supplied at login.
            const hash = visitorHash(`server_identity:${accountId}:${fact.at.toISOString()}`), contextId = randomUUID();
            [visitor] = await tx.insert(analyticsVisitors).values({ credentialHash: hash, contextId, accountId,
              createdAt: fact.at, expiresAt: new Date(fact.at.getTime() + 86400000), metadata: {
                scope: 'server_player', policyVersion: 1, contextId, platform: 'unknown', locale: 'unknown', build: 'server_identity', campaign: {},
              } }).onConflictDoNothing().returning();
            if (!visitor) [visitor] = await tx.select().from(analyticsVisitors).where(eq(analyticsVisitors.credentialHash, hash)).for('update');
          }
        }
        if (!visitor || fact.at < visitor.createdAt || fact.at > visitor.expiresAt || visitor.accountId !== accountId) return;
        const [excluded] = await tx.select().from(botProfiles).where(eq(botProfiles.accountId, accountId));
        if (excluded) return;
        await tx.insert(analyticsSessions).values({ id: visitor.id, visitorId: visitor.id, accountId,
          contextId: visitor.contextId, firstAt: fact.at, lastAt: fact.at }).onConflictDoNothing();
        await tx.insert(analyticsEvents).values({ id: factId(key), visitorId: visitor.id, sessionId: visitor.id, accountId,
          name, source: 'server_fact', mode: 'live', sequence: 0, occurredAt: fact.at, receivedAt: app.clock.now(),
          timeTrusted: true, payloadHash: key, properties }).onConflictDoNothing();
      });
      if (queue.get(key) === fact) queue.delete(key);
    }
  }, error => { app.log.warn({ err: error }, 'Optional analytics fact delivery failed'); });
  sinks.set(app, { queue, recorder });
  return async () => { await flushServerAnalytics(app); sinks.delete(app); await recorder.close(); };
}
export async function flushServerAnalytics(app: FastifyInstance): Promise<void> {
  const sink = sinks.get(app);
  if (!sink) return;
  const deadline = Date.now() + 5000;
  // Bounded at 256; repeated failures are reported, never retried forever during shutdown.
  for (let i = 0; i < 9 && (sink.queue.size || sink.recorder.pending) && Date.now() < deadline; i++) {
    sink.recorder.wake();
    while (sink.recorder.pending && Date.now() < deadline) await new Promise<void>(resolve => { setTimeout(resolve, 1); });
  }
  if (sink.queue.size || sink.recorder.pending) app.log.warn('Analytics fact drain stopped before all observations were projected');
}
