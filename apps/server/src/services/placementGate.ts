import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { performance } from 'node:perf_hooks';
import { createDb } from '../db/client.js';
import { players } from '../db/schema.js';
import { GameError } from './planet.js';
import { assertCommanderNotVacationing } from './vacation.js';

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
 * is added here. They read the placement before the handler and again after it. A
 * relocation bumps `placement_version` in the transaction that moves the commander,
 * so if any handler statement saw the moved state, the after-check sees the new
 * version and the response is refused like a stale header. Anything not listed here — every write
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
 * Hold a shared galaxy lease through every other authenticated HTTP handler. Transfers
 * take the exclusive side before world locks, so a multi-query write cannot
 * straddle relocation. A separate pool (two connections by default) avoids
 * exhausting gameplay connections with leases whose handlers need that pool too.
 * Streams have their own per-frame placement fence and must never hold this lease.
 */
export function installPlacementGate(app: FastifyInstance, url: string, max = 2,
  options: { idleInTransactionTimeoutMs?: number } = {}): () => Promise<void> {
  const pool = createDb(url, { max, applicationName: 'astera-placement-gate', ...options });

  /** The caller's current placement key, or a 409 when the browser holds an older one. */
  const admit = (req: FastifyRequest, current: Placement, reconcile: boolean): string => {
    const placement = `${current.id}:${String(current.placementVersion)}`;
    const expected = req.headers['x-placement'];
    if (!reconcile && (expected !== undefined ? expected !== placement : current.placementVersion !== 0)) {
      throw placementChanged();
    }
    app.projections.reconcilePlacement(req.accountId!, placement);
    return placement;
  };

  app.addHook('onRoute', route => {
    if (!route.url.startsWith('/api/') || route.url === '/api/stream') return;
    const handler = route.handler;
    // /me is the authority used to reconcile. Return endpoints already carry
    // their own versioned intent and expose status needed by older clients.
    const reconcile = route.url === '/api/auth/me' || route.url === '/api/return-applications';

    if (typeof route.method === 'string' && PLACEMENT_READ_ROUTES.has(`${route.method} ${route.url}`)) {
      route.handler = async function (req, reply) {
        if (!req.accountId) return handler.call(this, req, reply);
        const [initial] = await app.db.select(PLACEMENT).from(players).where(eq(players.accountId, req.accountId));
        if (!initial) return handler.call(this, req, reply);
        void reply.header('x-placement', admit(req, initial, reconcile));
        const result: unknown = await handler.call(this, req, reply);
        const [current] = await app.db.select(PLACEMENT).from(players).where(eq(players.id, initial.id));
        if (current?.seasonId !== initial.seasonId || current.placementVersion !== initial.placementVersion) {
          throw placementChanged();
        }
        return result;
      };
      return;
    }

    route.handler = async function (req, reply) {
      if (!req.accountId) return handler.call(this, req, reply);
      const startedAt = performance.now();
      let transactionStarted = false;
      return pool.db.transaction(async tx => {
        transactionStarted = true;
        // Includes connection establishment and BEGIN, not the galaxy lock or handler.
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
      }).catch((error: unknown) => {
        if (!transactionStarted) app.metrics.observePlacementTransactionStartError();
        throw error;
      });
    };
  });
  return pool.close;
}
