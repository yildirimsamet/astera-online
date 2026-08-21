import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { failedEventCount, oldestPendingAge } from '../worker/queue.js';
import { strandedFlightCount } from '../worker/abandon.js';
import { idleSeatCount } from '../services/reclaim.js';

/**
 * Health checks the database, the event queue AND the live channel.
 *
 * A stalled worker is the failure that silently breaks this game: the API keeps
 * answering, planets keep producing, and fleets simply never land. Checking only
 * the database would report that as healthy.
 *
 * THE LIVE CHANNEL JOINED THE LIST AT D53, and it had to. While the client polled
 * every twenty seconds a dead event bus was a degradation nobody would notice;
 * now the polls are a sixty-second SAFETY NET under a channel that is meant to do
 * the work, so a bus that has quietly stopped listening looks from the outside
 * exactly like a quiet galaxy. Whether the LISTEN socket is open is the one thing
 * an operator cannot infer from any other signal, so it is reported here.
 *
 * It does NOT fail the check on its own. A galaxy running on its polls is
 * degraded, not down, and taking a healthy deployment out of rotation over a
 * liveness channel would be a worse outcome than the latency it is reporting.
 */
const MAX_QUEUE_LAG_SECONDS = 120;

export function registerHealthRoutes(app: FastifyInstance): void {
  /**
   * EXEMPT FROM THE RATE LIMIT, because this is the one route whose caller is a
   * machine. An uptime monitor and a container healthcheck both hit it on a fixed
   * cadence from a fixed address, and a 429 here does not read as "slow down" —
   * it reads as an outage, which is precisely the alarm this endpoint exists to
   * make trustworthy.
   */
  app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
    const checks: {
      database?: string;
      queue?: string;
      queueLagSeconds?: number | null;
      failedEvents?: number;
      strandedFlights?: number;
      /**
       * Seats eligible to be reclaimed right now. REPORTED, NEVER ACTED ON.
       *
       * A count that stays high across several checks means the ten-minute sweep
       * is not running — which nothing else here would show, because a galaxy
       * silting up with inert worlds looks identical from the outside to a busy
       * one. It never fails the check: idle seats are a slow problem, and taking a
       * healthy deployment out of rotation over one would be worse than the
       * crowding it reports.
       */
      idleSeats?: number;
      stream?: string;
      streamTopics?: number;
      streamDelivered?: number;
      streamIdleSeconds?: number | null;
    } = {};
    let ok = true;

    try {
      await app.db.execute(sql`select 1`);
      checks.database = 'ok';
    } catch (err) {
      ok = false;
      checks.database = err instanceof Error ? err.message : 'unreachable';
    }

    try {
      const lag = await oldestPendingAge(app.db, app.clock.now());
      checks.queueLagSeconds = lag;
      /**
       * A dead event is invisible to the lag figure, because that only looks at
       * `pending` rows. Anything here is a flight the server could not resolve and
       * had to release — always a bug, and one that used to leave no trace. D28.
       */
      const dead = await failedEventCount(app.db);
      checks.failedEvents = dead;
      /**
       * A flight whose event row is GONE is invisible to everything above. D46.
       *
       * `lag` reads pending rows and `failedEvents` reads failed ones; a mission
       * with neither is a bay held for the rest of the season with no trace
       * anywhere. One sat thirteen hours past its arrival on a live galaxy while
       * this endpoint reported `ok`. The worker sweeps them, so anything here on a
       * running deployment means the sweep is not running.
       */
      const stranded = await strandedFlightCount(app.db, app.clock.now());
      checks.strandedFlights = stranded;
      checks.idleSeats = await idleSeatCount(app.db, app.clock);
      if (lag !== null && lag > MAX_QUEUE_LAG_SECONDS) {
        ok = false;
        checks.queue = 'stalled';
      } else if (dead > 0) {
        ok = false;
        checks.queue = 'events abandoned';
      } else if (stranded > 0) {
        ok = false;
        checks.queue = 'flights with no event';
      } else {
        checks.queue = 'ok';
      }
    } catch (err) {
      ok = false;
      checks.queue = err instanceof Error ? err.message : 'unreachable';
    }

    const bus = app.bus.status();
    checks.stream = bus.listening ? 'ok' : 'not listening';
    checks.streamTopics = bus.topics;
    checks.streamDelivered = bus.delivered;
    checks.streamIdleSeconds = bus.idleSeconds;

    return reply.status(ok ? 200 : 503).send({ ok, checks });
  });
}
