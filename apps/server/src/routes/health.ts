import { and, count, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { cpus, freemem, totalmem } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { failedEventCount, oldestPendingAge } from '../worker/queue.js';
import { strandedBuildCount, strandedFlightCount } from '../worker/abandon.js';
import { idleSeatCount } from '../services/reclaim.js';
import { botStatus } from '../services/bots/sweep.js';
import { missions, planets, scheduledEvents } from '../db/schema.js';

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
 * Production API replicas fail readiness while this channel is unavailable: a
 * disconnected replica may have missed cache invalidations and must not be put
 * back in rotation merely because its ordinary request pool still answers. The
 * worker role intentionally has no LISTEN socket and is exempt from this check.
 */
const MAX_QUEUE_LAG_SECONDS = 120;

function hostAvailableMemory(): number {
  try {
    const match = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(readFileSync('/proc/meminfo', 'utf8'));
    if (match?.[1]) return Number(match[1]) * 1024;
  } catch {
    // Non-Linux host; `freemem` is the portable, conservative fallback.
  }
  return freemem();
}

function hostCpuCounters(): {
  cores: number;
  idleMilliseconds: number;
  totalMilliseconds: number;
} {
  const processors = cpus();
  let idleMilliseconds = 0;
  let totalMilliseconds = 0;
  for (const processor of processors) {
    idleMilliseconds += processor.times.idle;
    totalMilliseconds += Object.values(processor.times)
      .reduce((total, value) => total + value, 0);
  }
  return { cores: processors.length, idleMilliseconds, totalMilliseconds };
}

export function registerHealthRoutes(
  app: FastifyInstance,
  options: { streamRequired: boolean; role: 'api' | 'worker' | 'both' },
): void {
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
      strandedBuilds?: number;
      strandedTransfers?: number;
      failedStrategicEvents?: number;
      staleWorldStates?: number;
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
      streamGeneration?: number;
      streamReconnects?: number;
      streamLastListenAt?: string | null;
      streamHeartbeatAgeSeconds?: number | null;
      projectionCache?: ReturnType<typeof app.projections.status>;
      rateLimit?: ReturnType<typeof app.rateLimitBackend.status>;
      streams?: ReturnType<typeof app.streams.status>;
      worker?: ReturnType<typeof app.worker.status>;
      /** How many commanders the server plays, and how many are at the controls. D159. */
      bots?: { seated: number; awake: number };
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
      const strandedBuilds = await strandedBuildCount(app.db, app.clock.now());
      checks.strandedBuilds = strandedBuilds;
      const [[strandedTransfers], [failedStrategic], [staleWorlds]] = await Promise.all([
        app.db.select({ n: count() }).from(missions).where(and(
          eq(missions.status, 'in_flight'),
          inArray(missions.kind, ['transfer', 'settlement', 'death_star']),
          lte(missions.arriveAt, app.clock.now()),
        )),
        app.db.select({ n: count() }).from(scheduledEvents).where(and(
          eq(scheduledEvents.status, 'failed'),
          inArray(scheduledEvents.kind, [
            'neutral_reinforce', 'death_star_ready', 'recovery_end', 'occupation_end',
            'build_complete',
          ]),
        )),
        app.db.select({ n: count() }).from(planets).where(or(
          lte(planets.recoveryUntil, app.clock.now()),
          lte(planets.protectedUntil, app.clock.now()),
        )),
      ]);
      checks.strandedTransfers = strandedTransfers?.n ?? 0;
      checks.failedStrategicEvents = failedStrategic?.n ?? 0;
      checks.staleWorldStates = staleWorlds?.n ?? 0;
      checks.idleSeats = await idleSeatCount(app.db, app.clock);
      /*
        REPORTED, NEVER JUDGED. `/health` reports; it does not repair.

        An empty roster is a deployment that has not been given names yet and a
        legitimate state; a roster that is seated but asleep is three in the morning
        in Türkiye. Neither is a failure, so neither moves `ok` — but both are
        questions somebody will ask when the disc looks quiet, and this is where the
        answer belongs.
      */
      checks.bots = await botStatus(app.db, app.clock);
      if (lag !== null && lag > MAX_QUEUE_LAG_SECONDS) {
        ok = false;
        checks.queue = 'stalled';
      } else if (dead > 0) {
        ok = false;
        checks.queue = 'events abandoned';
      } else if (
        stranded > 0
        || strandedBuilds > 0
        || checks.strandedTransfers > 0
        || checks.staleWorldStates > 0
      ) {
        ok = false;
        checks.queue = 'stranded strategic state';
      } else {
        checks.queue = 'ok';
      }
    } catch (err) {
      ok = false;
      checks.queue = err instanceof Error ? err.message : 'unreachable';
    }

    const bus = app.bus.status();
    checks.stream = bus.listening ? 'ok' : 'not listening';
    // Production API replicas are not healthy without their transactional live
    // channel. Worker-only processes intentionally do not LISTEN and are judged
    // by their queue state instead.
    if (options.streamRequired && !bus.listening) ok = false;
    checks.streamTopics = bus.topics;
    checks.streamDelivered = bus.delivered;
    checks.streamIdleSeconds = bus.idleSeconds;
    checks.streamGeneration = bus.generation;
    checks.streamReconnects = bus.reconnects;
    checks.streamLastListenAt = bus.lastListenAt;
    checks.streamHeartbeatAgeSeconds = bus.heartbeatAgeSeconds;
    checks.projectionCache = app.projections.status();
    checks.rateLimit = app.rateLimitBackend.status();
    // A configured shared limiter is the brute-force and seat-exhaustion
    // boundary for every API replica. Gameplay can degrade to fail-open, but
    // login/refresh/signup deliberately fail closed; calling that replica ready
    // would strand every player as their access token expires.
    if (
      options.role !== 'worker'
      && checks.rateLimit.mode === 'shared'
      && checks.rateLimit.status !== 'ready'
    ) {
      ok = false;
    }
    checks.streams = app.streams.status();
    checks.worker = app.worker.status();
    if (options.role === 'worker' && checks.worker.unknownEvents > 0) ok = false;

    return reply.status(ok ? 200 : 503).send({ ok, checks });
  });

  /** Process-local capacity report. Nginx exposes this to loopback only. */
  app.get('/metrics', { config: { rateLimit: false } }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const runtime = app.metrics.status();
    const constrainedMemory = process.constrainedMemory();
    const [database] = await app.db.execute<{
      maxConnections: number;
      asteraConnections: number;
      active: number;
      idle: number;
      waiting: number;
    }>(sql`
      SELECT current_setting('max_connections')::int AS "maxConnections",
             count(*) FILTER (WHERE application_name LIKE 'astera-%')::int AS "asteraConnections",
             count(*) FILTER (
               WHERE application_name LIKE 'astera-%' AND state = 'active'
             )::int AS active,
             count(*) FILTER (
               WHERE application_name LIKE 'astera-%' AND state = 'idle'
             )::int AS idle,
             count(*) FILTER (
               WHERE application_name LIKE 'astera-%'
                 AND state = 'active'
                 AND wait_event_type IS NOT NULL
             )::int AS waiting
        FROM pg_stat_activity
       WHERE datname = current_database()
    `);
    return {
      service: {
        role: options.role,
        commit: process.env.ASTERA_GIT_COMMIT ?? null,
      },
      host: {
        totalMemoryBytes: totalmem(),
        availableMemoryBytes: hostAvailableMemory(),
        cpu: hostCpuCounters(),
      },
      container: {
        limitMemoryBytes:
          constrainedMemory === 0 ? null : constrainedMemory,
        availableMemoryBytes: process.availableMemory(),
      },
      runtime,
      stream: app.streams.status(),
      bus: app.bus.status(),
      worker: app.worker.status(),
      projections: app.projections.status(),
      rateLimit: app.rateLimitBackend.status(),
      database: {
        configuredProcessPoolMax: app.dbPoolMax,
        maxConnections: database?.maxConnections ?? null,
        asteraConnections: database?.asteraConnections ?? null,
        active: database?.active ?? null,
        idle: database?.idle ?? null,
        waiting: database?.waiting ?? null,
        poolAcquireMs: runtime.databasePool.acquireMs,
        poolAcquireErrors: runtime.databasePool.acquireErrors,
      },
    };
  });
}
