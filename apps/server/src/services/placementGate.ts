import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { performance } from 'node:perf_hooks';
import { createDb } from '../db/client.js';
import { players } from '../db/schema.js';
import { GameError } from './planet.js';
import { assertCommanderNotVacationing } from './vacation.js';
import { ECONOMY_PROFILE } from '@astera/rules';

/**
 * THE HOT READS, WHICH CHECK PLACEMENT INSTEAD OF LEASING IT. Resource analysis 2026-10-13.
 *
 * A lease held one of two placement connections per API for the whole handler, so
 * at most six authenticated handlers ran at once across the cluster and a cache-hit
 * traffic read queued behind a planet view (placement start p95 1.3–1.6 s while the
 * ordinary pool answered in 0.5 ms). It also made every relocation's NOWAIT fence
 * fail while any request in the galaxy was in flight.
 *
 * These routes only read. `placement-read.test.ts` watches the wire for writes, row
 * locks and advisory locks on every entry, but on a quiet world: a write that only
 * happens when data exists must be ruled out by reading the handler before a route
 * is added here. They check the placement before the handler and again after it. A
 * relocation bumps `placement_version` in the transaction that moves the commander,
 * so if any handler statement saw the moved state, the after-check sees the new
 * version and the response is refused like a stale header. Scaling plan F1.8 (C2):
 * the before check is remembered per account (`Projections.callerPlacement`), and a
 * handler that issued no statement, served only values read before the placement was
 * last found current, skips the after check: it read nothing a move could change.
 * Anything not listed here — every write
 * and every GET that writes — keeps the lease: `/api/monuments` applies due
 * transitions, and `/api/galaxy` and `/api/intel` confirm telescope readings.
 */
export const PLACEMENT_READ_ROUTES: ReadonlySet<string> = new Set([
  'GET /api/galaxy/traffic',
  'GET /api/galaxy/events',
  'GET /api/mining/field',
  'GET /api/mining/status',
  'GET /api/pirates',
  'GET /api/planet',
  'GET /api/planets',
  'GET /api/planets/:planetId',
  'GET /api/session/pending',
  'GET /api/notifications',
  'GET /api/reports',
  'GET /api/skins',
  'GET /api/season',
  'GET /api/rewards',
  'GET /api/chat/unread',
  'GET /api/dm/unread',
  'GET /api/clan/badge',
]);

const PLACEMENT = { id: players.id, seasonId: players.seasonId, placementVersion: players.placementVersion };
interface Placement { id: string; seasonId: string; placementVersion: number }

const placementChanged = () => new GameError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);

/**
 * How long a request waits for a placement connection. Scaling plan F1.6: under
 * overload the wait is refused as retryable instead of an in-memory queue growing
 * without bound and stretching every request behind it.
 */
export const PLACEMENT_QUEUE_MS = 2_000;

/**
 * Hold a shared galaxy lease through every other authenticated HTTP handler. Transfers
 * take the exclusive side before world locks, so a multi-query write cannot
 * straddle relocation. A separate pool (two connections by default) avoids
 * exhausting gameplay connections with leases whose handlers need that pool too.
 * Streams have their own placement fence (`StreamFence`) and must never hold this lease.
 */
export function installPlacementGate(app: FastifyInstance, url: string, max = 2,
  options: { idleInTransactionTimeoutMs?: number; requireCurrentRules?: boolean } = {}): () => Promise<void> {
  const { requireCurrentRules = false, ...poolOptions } = options;
  const pool = createDb(url, { max, applicationName: 'astera-placement-gate', ...poolOptions });
  // The pool's own queue cannot drop a waiter, so admission is counted here.
  let leased = 0;
  const waiting: (() => void)[] = [];
  const lease = async (): Promise<void> => {
    if (leased < max) {
      leased += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const admit = (): void => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(admit), 1);
        reject(new GameError('RETRYABLE', 'The command centre is busy; try again in a moment', 503));
      }, PLACEMENT_QUEUE_MS);
      waiting.push(admit);
    });
  };
  /** Hands the connection to the next waiter, who inherits the count. */
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else leased -= 1;
  };

  const keyOf = (current: Placement): string => `${current.id}:${String(current.placementVersion)}`;
  /** Whether the browser holds a different placement than `current`. */
  const stale = (req: FastifyRequest, current: Placement, reconcile: boolean): boolean => {
    const expected = req.headers['x-placement'];
    return !reconcile && (expected !== undefined ? expected !== keyOf(current) : current.placementVersion !== 0);
  };
  /** The caller's current placement key, or a 409 when the browser holds an older one. */
  const admit = (req: FastifyRequest, current: Placement, reconcile: boolean): string => {
    if (stale(req, current, reconcile)) throw placementChanged();
    app.projections.reconcilePlacement(req.accountId!, current);
    return keyOf(current);
  };

  app.addHook('onRoute', route => {
    if (!route.url.startsWith('/api/') || route.url === '/api/stream'
      || route.url === '/api/auth/security' || route.url === '/api/auth/capabilities'
      || route.url === '/api/auth/account-deletion' || route.url.startsWith('/api/admin/account-deletion')
      || route.url.startsWith('/api/auth/email/') || route.url.startsWith('/api/auth/password/reset/')
      || route.url === '/api/mail/resend/webhook') return;
    const handler = route.handler;
    // HTML images/video cannot send custom headers. These read-only media paths
    // keep their auth, audience and placement guards without requiring game rules.
    const mediaRead = (route.method === 'GET' || route.method === 'HEAD')
      && (route.url === '/api/chat/media/:id' || route.url === '/api/admin/content-reports/:id/media');
    const assertRules = (req: FastifyRequest): void => {
      if (requireCurrentRules && !mediaRead && req.headers['x-astera-rules'] !== ECONOMY_PROFILE.id) {
        throw new GameError('UPDATE_REQUIRED', 'Update Astera Online to use the current season rules', 426);
      }
    };
    // /me is the authority used to reconcile. Return endpoints already carry
    // their own versioned intent and expose status needed by older clients.
    const reconcile = route.url === '/api/chat/media/:id' || route.url === '/api/auth/me' || route.url === '/api/return-applications';

    if (typeof route.method === 'string' && PLACEMENT_READ_ROUTES.has(`${route.method} ${route.url}`)) {
      route.handler = async function (req, reply) {
        if (!req.accountId) return handler.call(this, req, reply);
        assertRules(req);
        const accountId = req.accountId;
        // F1.8 C2: the before check is remembered, kept by the placement triggers.
        const load = async () => (await app.db.select(PLACEMENT).from(players).where(eq(players.accountId, accountId)))[0] ?? null;
        let remembered = await app.projections.callerPlacement(accountId, load);
        // The browser may have heard of a move before this process did: ask before refusing.
        if (remembered && stale(req, remembered.placement, reconcile)) {
          app.projections.forgetCallerPlacement(accountId);
          remembered = await app.projections.callerPlacement(accountId, load);
        }
        if (!remembered) return handler.call(this, req, reply);
        const initial = remembered.placement;
        void reply.header('x-placement', admit(req, initial, reconcile));
        const scope = req.dbStatements;
        const before = scope?.statements;
        const outer = scope?.newestRead;
        if (scope) scope.newestRead = -Infinity;
        const result: unknown = await handler.call(this, req, reply);
        const newest = scope?.newestRead ?? Infinity;
        if (scope) scope.newestRead = Math.max(outer ?? -Infinity, newest);
        // Served wholly from memory read before the placement was last found current, the
        // handler saw nothing a move could have changed. A value another request refilled
        // since may hold a move this process has not heard of yet: that is checked.
        if (scope && scope.statements === before && newest < remembered.confirmedAt) return result;
        const checkedAt = performance.now();
        const [current] = await app.db.select(PLACEMENT).from(players).where(eq(players.id, initial.id));
        if (current?.seasonId !== initial.seasonId || current.placementVersion !== initial.placementVersion) {
          app.projections.forgetCallerPlacement(accountId);
          if (current) app.projections.reconcilePlacement(accountId, current);
          throw placementChanged();
        }
        // Everything the handler was served had been read before this check began.
        remembered.confirmedAt = Math.max(remembered.confirmedAt, checkedAt);
        return result;
      };
      return;
    }

    route.handler = async function (req, reply) {
      if (!req.accountId) return handler.call(this, req, reply);
      assertRules(req);
      const startedAt = performance.now();
      let transactionStarted = false;
      return lease().then(() => pool.db.transaction(async tx => {
        transactionStarted = true;
        // Includes the lease queue, connection establishment and BEGIN, not the galaxy lock or handler.
        // Observe real requests instead of adding a competing probe to this small pool.
        app.metrics.observePlacementTransactionStart(performance.now() - startedAt);
        const [initial] = await tx.select(PLACEMENT).from(players).where(eq(players.accountId, req.accountId!));
        if (!initial) return handler.call(this, req, reply);
        // A vacation changes all holdings. Its exclusive admission waits for every
        // authenticated writer; their shared lease stays held through the handler.
        const vacationMutation = req.method === 'POST' && (route.url === '/api/vacation' || route.url === '/api/vacation/end');
        if (vacationMutation) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${initial.seasonId}`}, 0))`);
        else await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${`placement:${initial.seasonId}`}, 0))`);
        const [current] = await tx.select(PLACEMENT).from(players).where(eq(players.id, initial.id));
        if (current?.seasonId !== initial.seasonId || current.placementVersion !== initial.placementVersion) {
          throw placementChanged();
        }
        void reply.header('x-placement', admit(req, current, reconcile));
        const social = /^\/api\/(chat|dm)(\/|$)/.test(route.url)
          || route.url.startsWith('/api/auth/')
          || route.url.startsWith('/api/notifications')
          || route.url === '/api/session/return';
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !social && !vacationMutation) {
          await assertCommanderNotVacationing(tx, current.id, app.clock.now());
        }
        return handler.call(this, req, reply);
      }).finally(release)).catch((error: unknown) => {
        if (!transactionStarted) app.metrics.observePlacementTransactionStartError();
        throw error;
      });
    };
  });
  return pool.close;
}
