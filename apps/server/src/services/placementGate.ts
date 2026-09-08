import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../db/client.js';
import { players } from '../db/schema.js';
import { GameError } from './planet.js';

/**
 * Hold a shared galaxy lease through every authenticated HTTP handler. Transfers
 * take the exclusive side before world locks, so a multi-query response cannot
 * straddle relocation. A separate two-connection pool avoids exhausting the
 * gameplay pool with leases whose handlers themselves need gameplay connections.
 * Streams have their own per-frame placement fence and must never hold this lease.
 */
export function installPlacementGate(app: FastifyInstance, url: string): () => Promise<void> {
  const pool = createDb(url, { max: 2, applicationName: 'astera-placement-gate' });
  app.addHook('onRoute', route => {
    if (!route.url.startsWith('/api/') || route.url === '/api/stream') return;
    const handler = route.handler;
    route.handler = async function (req, reply) {
      if (!req.accountId) return handler.call(this, req, reply);
      return pool.db.transaction(async tx => {
        const [initial] = await tx.select().from(players).where(eq(players.accountId, req.accountId!));
        if (!initial) return handler.call(this, req, reply);
        await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${`placement:${initial.seasonId}`}, 0))`);
        const [current] = await tx.select().from(players).where(eq(players.id, initial.id));
        if (current?.seasonId !== initial.seasonId || current.placementVersion !== initial.placementVersion) {
          throw new GameError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
        }
        const placement = `${current.id}:${String(current.placementVersion)}`;
        const expected = req.headers['x-placement'];
        // /me is the authority used to reconcile. Return endpoints already carry
        // their own versioned intent and expose status needed by older clients.
        const reconcile = route.url === '/api/auth/me' || route.url === '/api/return-applications';
        if (!reconcile && (expected !== undefined ? expected !== placement : current.placementVersion !== 0)) {
          throw new GameError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
        }
        app.projections.reconcilePlacement(req.accountId!, placement);
        void reply.header('x-placement', placement);
        return handler.call(this, req, reply);
      });
    };
  });
  return pool.close;
}
