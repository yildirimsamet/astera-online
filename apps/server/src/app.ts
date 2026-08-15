import cookie from '@fastify/cookie';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
} from 'fastify';
import { ZodError } from 'zod';
import { pino } from 'pino';
import type { Env } from './env.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { createDb, type Db } from './db/client.js';
import { TokenService } from './auth/tokens.js';
import { GameError } from './services/planet.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPlanetRoutes } from './routes/planet.js';
import { registerIntelRoutes } from './routes/intel.js';
import { registerGalaxyRoutes } from './routes/galaxy.js';
import { registerHealthRoutes } from './routes/health.js';
import { EventWorker } from './worker/loop.js';
import { EventBus } from './stream/bus.js';
import { registerSessionRoutes } from './routes/session.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    clock: Clock;
    tokens: TokenService;
    worker: EventWorker;
    bus: EventBus;
  }
  interface FastifyRequest {
    /** Set by `requireAuth`. Absent on public routes. */
    accountId?: string;
  }
}

export interface BuildAppOptions {
  env: Env;
  clock?: Clock;
  logger?: FastifyBaseLogger;
  db?: Db;
}

export interface BuiltApp {
  app: FastifyInstance;
  worker: EventWorker;
  bus: EventBus;
  close: () => Promise<void>;
}

export function buildApp(opts: BuildAppOptions): BuiltApp {
  const clock = opts.clock ?? systemClock;
  // Annotated, not asserted. Passing a concrete pino Logger would specialise
  // Fastify's logger generic and propagate a non-default FastifyInstance type
  // into every route signature in the app; pino satisfies this interface anyway.
  const log: FastifyBaseLogger = opts.logger ?? pino({ level: opts.env.LOG_LEVEL });

  const owned = opts.db ? null : createDb(opts.env.DATABASE_URL);
  const db = opts.db ?? owned!.db;

  const app = Fastify({
    loggerInstance: log,
    disableRequestLogging: opts.env.NODE_ENV === 'test',
  });
  const tokens = new TokenService(
    opts.env.JWT_SECRET,
    opts.env.ACCESS_TOKEN_MINUTES,
    opts.env.REFRESH_TOKEN_DAYS,
  );
  const worker = new EventWorker(
    db,
    clock,
    {
      pollMs: opts.env.WORKER_POLL_MS,
      batch: opts.env.WORKER_BATCH,
      staleMinutes: opts.env.WORKER_STALE_MINUTES,
    },
    log,
  );

  app.decorate('db', db);
  app.decorate('clock', clock);
  app.decorate('tokens', tokens);
  app.decorate('worker', worker);
  const bus = new EventBus(opts.env.DATABASE_URL, log);
  app.decorate('bus', bus);

  void app.register(cookie);

  /**
   * One error shape for the whole API. A GameError carries a stable machine code
   * plus a sentence a player can act on; anything else is a bug and is not
   * described to the client.
   */
  app.setErrorHandler((error: FastifyError, req, reply) => {
    // `instanceof` narrowing against an interface leaves the residual type as
    // unknown, so keep the original around for the structural checks below.
    const err: unknown = error;

    if (err instanceof GameError) {
      return reply.status(err.status).send({ error: err.code, message: err.message });
    }
    // Zod throws on bad input at the route boundary. Without this branch every
    // malformed request would surface as a 500 and look like a server fault.
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request',
      });
    }
    if (error.validation) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: error.message });
    }
    req.log.error({ err: error }, 'unhandled route error');
    return reply.status(500).send({ error: 'INTERNAL', message: 'Something went wrong' });
  });

  // Registered directly rather than inside a plugin: these routes share the
  // decorators above, and encapsulating them would hide `app.db` from them.
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerPlanetRoutes(app);
  registerIntelRoutes(app);
  registerGalaxyRoutes(app);
  registerSessionRoutes(app);

  return {
    app,
    worker,
    bus,
    close: async () => {
      await worker.stop();
      await bus.stop();
      await app.close();
      if (owned) await owned.close();
    },
  };
}
