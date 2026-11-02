import type { FastifyInstance, FastifyRequest } from 'fastify';
import { analyticsBatchSchema, analyticsVisitorSchema, ANALYTICS_BATCH_BYTES } from '../../../web/src/api/analyticsSchemas.js';
import { ingestAnalytics, issueAnalyticsVisitor, revokeAnalyticsVisitor, visitorHash } from '../services/playerAnalytics.js';
import { GameError } from '../services/planet.js';
import { analyticsVisitors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

function credential(req: FastifyRequest): string {
  const value = req.headers['x-analytics-visitor'];
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(value)) throw new GameError('UNAUTHENTICATED', 'Visit credential required', 401);
  return value;
}
export function registerPlayerAnalyticsRoutes(app: FastifyInstance, collection: boolean): void {
  const limit = { max: 6, timeWindow: '1 minute', keyGenerator: (req: FastifyRequest) => {
    const value = req.headers['x-analytics-visitor'];
    return `analytics:${typeof value === 'string' ? visitorHash(value) : req.ip}`;
  } };
  // Withdrawal remains available after a collection rollback.
  app.delete('/api/analytics/visitors', { config: { rateLimit: {
    max: 12, timeWindow: '1 minute', keyGenerator: req => `analytics-revoke:${req.ip}`,
  } } }, async (req, reply) => {
    await revokeAnalyticsVisitor(app.db, credential(req));
    return reply.code(204).send();
  });
  if (!collection) return;
  const contextLimit = app.createRateLimit(limit);
  const resolvedAccounts = new WeakMap<FastifyRequest, string>();
  const accountLimit = app.createRateLimit({ max: 12, timeWindow: '1 minute', keyGenerator: req => {
    return `analytics-account:${resolvedAccounts.get(req) ?? ''}`;
  } });
  app.post('/api/analytics/visitors', { bodyLimit: 4096, config: { rateLimit: {
    max: 12, timeWindow: '1 minute', keyGenerator: req => `analytics-issue:${req.ip}`,
  } } }, async (req, reply) => {
    const metadata = analyticsVisitorSchema.parse(req.body);
    let accountId: string | undefined;
    if (metadata.scope === 'player') {
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer ')) throw new GameError('UNAUTHENTICATED', 'Verified player required', 401);
      try { accountId = (await app.tokens.identity(authorization.slice(7), 'access')).accountId; }
      catch { throw new GameError('UNAUTHENTICATED', 'Invalid player credential', 401); }
    }
    const grant = await issueAnalyticsVisitor(app.db, app.clock, metadata, accountId);
    return reply.code(201).send(grant);
  });
  app.post('/api/analytics/events', { bodyLimit: ANALYTICS_BATCH_BYTES, config: { rateLimit: {
    max: 120, timeWindow: '1 minute', keyGenerator: req => `analytics-intake:${req.ip}`,
  } } }, async (req, reply) => {
    const visit = credential(req);
    const context = await contextLimit(req);
    if (!context.isAllowed && context.isExceeded) return reply.header('retry-after', context.ttlInSeconds).code(429).send({ error: 'RATE_LIMITED' });
    const { events } = analyticsBatchSchema.parse(req.body);
    let accountId: string | undefined;
    if (req.headers.authorization) {
      if (!req.headers.authorization.startsWith('Bearer ')) throw new GameError('UNAUTHENTICATED', 'Invalid account credential', 401);
      try { accountId = (await app.tokens.identity(req.headers.authorization.slice(7), 'access')).accountId; }
      catch { throw new GameError('UNAUTHENTICATED', 'Invalid account credential', 401); }
    } else {
      // The capability may already have been bound by a verified claim whose placement then failed.
      // This grants observation writes to that same visit only, never gameplay access or a new account binding.
      const [owner] = await app.db.select({ accountId: analyticsVisitors.accountId }).from(analyticsVisitors)
        .where(eq(analyticsVisitors.credentialHash, visitorHash(visit))).limit(1);
      accountId = owner?.accountId ?? undefined;
    }
    if (accountId) {
      resolvedAccounts.set(req, accountId);
      const result = await accountLimit(req);
      if (!result.isAllowed && result.isExceeded) return reply.header('retry-after', result.ttlInSeconds).code(429).send({ error: 'RATE_LIMITED' });
    }
    const result = await ingestAnalytics(app.db, app.clock, visit, events, accountId);
    app.metrics.observeOperation('analytics.events', 'accepted', result.accepted);
    app.metrics.observeOperation('analytics.events', 'duplicate', result.duplicates);
    return result;
  });
}
