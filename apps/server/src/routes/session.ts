import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import {
  buildReturnPayload,
  currentUnlocks,
  listNotifications,
  markNotificationsSeen,
} from '../services/session.js';
import { requireAuth } from './auth.js';

const seenBody = z.object({ ids: z.array(z.string().uuid()).max(200).optional() });

/** Long enough to be cheap, short enough that proxies do not time the socket out. */
const HEARTBEAT_MS = 25_000;

export function registerSessionRoutes(app: FastifyInstance): void {
  const me = async (accountId: string): Promise<string> => {
    const rows = await app.db
      .select({ playerId: players.id })
      .from(players)
      .innerJoin(planets, eq(planets.playerId, players.id))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const playerId = rows[0]?.playerId;
    if (!playerId) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return playerId;
  };

  /**
   * "While you were gone."
   *
   * The first thing a returning player sees, and the mechanism behind Design Law
   * #1. Reading it advances `lastSeenAt`, so calling it twice in a row correctly
   * reports nothing the second time.
   */
  app.get('/api/session/return', { preHandler: requireAuth }, async (req) => {
    const playerId = await me(req.accountId!);
    return buildReturnPayload(app.db, playerId, app.clock);
  });

  app.get('/api/session/unlocks', { preHandler: requireAuth }, async (req) => {
    const playerId = await me(req.accountId!);
    return { unlocked: await currentUnlocks(app.db, playerId) };
  });

  app.get('/api/notifications', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({
        unseenOnly: z.coerce.boolean().default(false),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(req.query);

    const playerId = await me(req.accountId!);
    const rows = await listNotifications(app.db, playerId, query);
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        payload: n.payload,
        seen: n.seen,
        at: n.createdAt,
      })),
    };
  });

  app.post('/api/notifications/seen', { preHandler: requireAuth }, async (req) => {
    const { ids } = seenBody.parse(req.body ?? {});
    const playerId = await me(req.accountId!);
    // Scoped to the caller's own rows inside the service — ids from the client are
    // a filter, never an authorisation.
    return { marked: await markNotificationsSeen(app.db, playerId, ids) };
  });

  /**
   * Server-sent events.
   *
   * Deliberately the ONLY realtime surface. Fleet motion and asteroid orbits are
   * computed client-side from timestamps, so this carries nothing but events the
   * player could not have predicted: a battle resolving, a scan detected, a fleet
   * inbound. A few hundred bytes an hour.
   */
  app.get('/api/stream', { preHandler: requireAuth }, async (req, reply) => {
    const playerId = await me(req.accountId!);

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx and friends not to buffer, which would defeat the whole point.
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`: connected\n\n`);

    const unsubscribe = app.bus.subscribe(playerId, (event) => {
      reply.raw.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, HEARTBEAT_MS);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    // Both events matter: 'close' for a client that goes away, 'error' for a
    // socket that dies. Leaking a subscription leaks a listener per reconnect.
    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
