import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { failedEventCount, oldestPendingAge } from '../worker/queue.js';
import { strandedFlightCount } from '../worker/abandon.js';

/**
 * Health checks the database AND the event queue.
 *
 * A stalled worker is the failure that silently breaks this game: the API keeps
 * answering, planets keep producing, and fleets simply never land. Checking only
 * the database would report that as healthy.
 */
const MAX_QUEUE_LAG_SECONDS = 120;

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async (_req, reply) => {
    const checks: {
      database?: string;
      queue?: string;
      queueLagSeconds?: number | null;
      failedEvents?: number;
      strandedFlights?: number;
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

    return reply.status(ok ? 200 : 503).send({ ok, checks });
  });
}
