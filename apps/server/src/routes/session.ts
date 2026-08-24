import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { planets, players } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import {
  buildReturnPayload,
  currentUnlocks,
  listNotifications,
  markNotificationsSeen,
  pendingThreads,
} from '../services/session.js';
import { readBattleReports } from '../services/reports.js';
import { requireAuth } from './auth.js';

const seenBody = z.object({ ids: z.array(z.string().uuid()).max(200).optional() });

/** Long enough to be cheap, short enough that proxies do not time the socket out. */
const HEARTBEAT_MS = 25_000;

export function registerSessionRoutes(app: FastifyInstance): void {
  const me = async (accountId: string): Promise<string> => {
    const rows = await app.db
      .select({ playerId: players.id })
      .from(players)
      .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const playerId = rows[0]?.playerId;
    if (!playerId) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return playerId;
  };

  /**
   * Who is asking, and which galaxy they live in. D53.
   *
   * The stream needs both: one topic for what happens TO this commander, one for
   * what happens IN their shard. The season id is read from the PLAYER row rather
   * than taken from anywhere the client can influence, so a connection can only
   * ever be subscribed to the galaxy it is actually in.
   */
  const whoAndWhere = async (accountId: string): Promise<{ playerId: string; seasonId: string }> => {
    const rows = await app.db
      .select({ playerId: players.id, seasonId: players.seasonId })
      .from(players)
      .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
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

  /**
   * What is still in flight — read as often as you like.
   *
   * Separate from `/api/session/return` on purpose: that one advances
   * `lastSeenAt` and may be read exactly once a session, so it cannot be what
   * keeps a live countdown honest.
   */
  app.get('/api/session/pending', { preHandler: requireAuth }, async (req) => {
    const rows = await app.db
      .select({ planetId: planets.id })
      .from(planets)
      .innerJoin(players, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, req.accountId!))
      .limit(1);
    const planetId = rows[0]?.planetId;
    if (!planetId) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    return { pending: await pendingThreads(app.db, planetId, app.clock.now()) };
  });

  /**
   * Battle reports — the most accurate intel in the game, and until now the only
   * thing the server wrote and never showed anyone.
   */
  app.get('/api/reports', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
      .parse(req.query);
    const playerId = await me(req.accountId!);
    return readBattleReports(app.db, playerId, query.limit);
  });

  app.get('/api/session/unlocks', { preHandler: requireAuth }, async (req) => {
    const playerId = await me(req.accountId!);
    return { unlocked: await currentUnlocks(app.db, playerId) };
  });

  app.get('/api/notifications', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({
        /**
         * NOT `z.coerce.boolean()`, WHICH CANNOT SAY NO.
         *
         * Coercion is `Boolean(value)`, and a query string is always a string —
         * so `?unseenOnly=false` and `?unseenOnly=0` both parsed to TRUE. A flag
         * that only has one setting is worse than no flag: it reads as supported.
         * Nothing in the client sends it today, which is the only reason this had
         * not yet been found by someone filtering a list and getting the whole of
         * it back.
         */
        unseenOnly: z
          .enum(['true', 'false'])
          .default('false')
          .transform((value) => value === 'true'),
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
   * computed client-side from timestamps, so this carries nothing but instants the
   * player could not have predicted.
   *
   * TWO TOPICS, NOT ONE. D53.
   *
   *   · The PLAYER topic — a battle resolving, a scan detected, a fleet inbound.
   *     Addressed to this commander and nobody else, and it has always been here.
   *   · The SHARD topic — a fleet left a world, a raid resolved, a drill went out,
   *     a world grew. Addressed to everybody in the galaxy, because that is what a
   *     living galaxy is: things happening to other people while you watch.
   *
   * The second is what the polls used to do, twenty to thirty seconds late. It
   * carries no id, no owner and no heading — only that something of that shape
   * happened here — so what a subscriber does with it is refetch a payload it was
   * already entitled to read, sooner. See `bus.ts`.
   *
   * Still a few hundred bytes an hour for the player topic, and a shard topic that
   * costs one line per real event in a galaxy of three hundred commanders.
   */
  app.get('/api/stream', { preHandler: requireAuth }, async (req, reply) => {
    const { playerId, seasonId } = await whoAndWhere(req.accountId!);

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx and friends not to buffer, which would defeat the whole point.
      'X-Accel-Buffering': 'no',
    });
    let cleanup: (reason?: 'client' | 'error' | 'slow' | 'shutdown') => void = () => undefined;
    const write = (frame: string): boolean => {
      if (reply.raw.destroyed || reply.raw.writableEnded) return false;
      reply.raw.write(frame);
      app.streams.wrote(Buffer.byteLength(frame));
      if (reply.raw.writableLength > app.sseMaxBufferBytes) {
        cleanup('slow');
        reply.raw.destroy();
        return false;
      }
      return true;
    };
    write(`: connected\n\n`);

    const send = (event: { kind: string }): void => {
      write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = app.bus.subscribe(playerId, send);
    const unsubscribeShard = app.bus.subscribeShard(seasonId, send);

    const heartbeat = setInterval(() => {
      write(`: ping\n\n`);
    }, HEARTBEAT_MS);

    const lease = app.streams.open(() => {
      cleanup('shutdown');
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    });
    let cleaned = false;
    cleanup = (reason = 'client'): void => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      unsubscribe();
      unsubscribeShard();
      lease.release(reason);
    };
    // Both events matter: 'close' for a client that goes away, 'error' for a
    // socket that dies. Leaking a subscription leaks a listener per reconnect.
    req.raw.on('close', () => {
      cleanup('client');
    });
    req.raw.on('error', () => {
      cleanup('error');
    });
  });
}
