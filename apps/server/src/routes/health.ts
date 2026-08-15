import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { oldestPendingAge } from '../worker/queue.js';

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
    const checks: { database?: string; queue?: string; queueLagSeconds?: number | null } = {};
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
      if (lag !== null && lag > MAX_QUEUE_LAG_SECONDS) {
        ok = false;
        checks.queue = 'stalled';
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
