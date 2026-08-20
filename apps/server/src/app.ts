import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
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
import { registerMiningRoutes } from './routes/mining.js';
import { registerHealthRoutes } from './routes/health.js';
import { EventWorker } from './worker/loop.js';
import { EventBus } from './stream/bus.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerSeasonRoutes } from './routes/season.js';
import { registerServerRoutes } from './routes/servers.js';
import { registerPreviewRoutes } from './routes/preview.js';
import { registerOnboardingRoutes } from './routes/onboarding.js';
import { Presence } from './services/presence.js';

/**
 * THE TWO ROUTES THAT COST MORE THAN THEY LOOK, AND THEIR WINDOWS.
 *
 * The ceilings are configurable because a deployment may need to move them; the
 * WINDOWS are not, because they are the reasoning rather than the tuning. A ten
 * minute window on signing in is what turns "twenty tries" into a rate slow
 * enough that a password list is useless; an hour on taking a seat is what makes
 * exhausting a fifty-world galaxy take a day of sustained effort from fifty
 * different addresses instead of four seconds from one.
 */
const AUTH_WINDOW = '10 minutes';
const SIGNUP_WINDOW = '1 hour';

/** What a route asks for when it wants one of the strict buckets. */
export interface RouteLimits {
  /** Signing in and exchanging a refresh cookie. */
  auth: { max: number; timeWindow: string };
  /** Anything that creates an account — and therefore takes a seat. */
  signup: { max: number; timeWindow: string };
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    clock: Clock;
    tokens: TokenService;
    presence: Presence;
    worker: EventWorker;
    bus: EventBus;
    limits: RouteLimits;
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
  /** The pool the app is using, so the boot path can check the schema against it. */
  db: Db;
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
    /**
     * Behind the production proxy `req.ip` must be the CALLER, not nginx. See
     * `TRUST_PROXY` in env.ts for why this is off unless a deployment says so.
     */
    trustProxy: opts.env.TRUST_PROXY,
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
  app.decorate('presence', new Presence(db, clock, opts.env.PRESENCE_THROTTLE_MS));
  app.decorate('worker', worker);
  const bus = new EventBus(opts.env.DATABASE_URL, log);
  app.decorate('bus', bus);
  app.decorate('limits', {
    auth: { max: opts.env.RATE_LIMIT_AUTH_MAX, timeWindow: AUTH_WINDOW },
    signup: { max: opts.env.RATE_LIMIT_SIGNUP_MAX, timeWindow: SIGNUP_WINDOW },
  });

  void app.register(cookie);

  /**
   * A CEILING ON WHAT ONE ADDRESS CAN ASK FOR.
   *
   * Registered at the root and therefore global, which is the only way the
   * per-route ceilings below it work at all: a route's `config.rateLimit` is an
   * OVERRIDE of this registration, not a registration of its own.
   *
   * A REFUSAL HERE IS A REFUSAL LIKE ANY OTHER. The plugin's own body is
   * `{statusCode, error: 'Too Many Requests', message}`, which would put the
   * literal words "Too Many Requests" through the client's error path as though
   * they were a machine code, and would arrive in English whatever the player
   * reads the game in. Rebuilt into the shape every other refusal already uses —
   * a stable code plus the figures the sentence was made from — so `RATE_LIMITED`
   * localises off `i18n/errors.ts` exactly like `SHARD_FULL` does (D55).
   *
   * IT RETURNS A `GameError`, WHICH IS NOT A FLOURISH. Whatever this builder
   * returns is handed to `setErrorHandler` as the error itself, and a plain
   * object arrives there with no `statusCode` on it at all — so the handler
   * cannot tell it from a bug, answers 500, and the ceiling reports itself as a
   * server fault. Returning the project's own error type means the branch that
   * already knows how to answer a refusal answers this one too.
   *
   * IN-MEMORY, ON PURPOSE. The store is per process, so two API processes would
   * each allow the full ceiling. That is the correct trade at this size: one
   * process serves every galaxy, and a Redis dependency bought to halve a number
   * that is already an order of magnitude clear of real play is a dependency for
   * nothing.
   */
  void app.register(rateLimit, {
    global: true,
    max: opts.env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => {
      // `ttl` is milliseconds until the bucket refills. Kept as a figure rather
      // than a sentence so the client can say it in the player's own language.
      const seconds = Math.max(1, Math.ceil(context.ttl / 1000));
      return new GameError(
        'RATE_LIMITED',
        `Too many requests. Try again in ${String(seconds)} seconds.`,
        429,
        { seconds },
      );
    },
  });

  /**
   * THE SERVER'S CLOCK, ON EVERY ANSWER, TO THE MILLISECOND. D52.
   *
   * The whole disc is drawn by comparing server timestamps against "now", and the
   * client's "now" is a phone — which can be minutes out and is never asked. Under
   * that, two people sitting next to each other watch the same fleet at different
   * points of its leg, and both countdowns are wrong.
   *
   * HTTP already carries `Date`, and the client falls back to it, but `Date` has
   * ONE-SECOND resolution: on a ten-second engagement window that is a tenth of the
   * only cinematic in the game. A millisecond stamp costs one header.
   *
   * It reads `app.clock`, not `Date.now()` — the injected clock is the single source
   * of time on this server (A13), and a test that fixes it must see the API agree
   * with the world it is fixing.
   *
   * SAME-ORIGIN ONLY, deliberately: the web client is served from this host and in
   * dev goes through the Vite proxy, so no CORS exposure is needed. Serving the
   * client from another origin would require `Access-Control-Expose-Headers`.
   */
  app.addHook('onSend', (_req, reply, payload, done) => {
    reply.header('x-server-time', String(clock.now().getTime()));
    done(null, payload);
  });

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
      /**
       * The code, the English sentence, and the figures that sentence was built
       * from. The client localises off the code and interpolates the params; the
       * sentence is what a client one deploy BEHIND this server still has to show.
       * `params` is omitted rather than sent empty, so nothing changes on the wire
       * for the refusals that have no figures in them.
       */
      return reply.status(err.status).send({
        error: err.code,
        message: err.message,
        ...(err.params === undefined ? {} : { params: err.params }),
      });
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

  /**
   * ROUTES GO IN AFTER THE PLUGINS ABOVE HAVE ACTUALLY LOADED.
   *
   * `register` does not run a plugin — it QUEUES it, and the queue is drained at
   * `ready()`. Routes added synchronously after the call are therefore added
   * BEFORE the plugin exists, and a plugin that works by inspecting routes as
   * they arrive never sees them.
   *
   * That is exactly how `@fastify/rate-limit` works: it installs an `onRoute`
   * hook and reads each route's `config.rateLimit`. Registered the obvious way,
   * every ceiling in this file was silently ignored — the API answered 200 to an
   * unlimited flood of logins, typechecked, and passed every test that was not
   * specifically looking for a 429. `ratelimit.test.ts` is looking.
   *
   * `after` is the seam: it fires once the preceding registrations have loaded,
   * and routes declared inside it still attach to THIS instance rather than to a
   * child context — so they keep the decorators above, which is why they were
   * never wrapped in a plugin of their own.
   */
  app.after(() => {
    registerHealthRoutes(app);
    registerAuthRoutes(app);
    registerServerRoutes(app);
    registerPreviewRoutes(app);
    registerOnboardingRoutes(app);
    registerSeasonRoutes(app);
    registerPlanetRoutes(app);
    registerIntelRoutes(app);
    registerGalaxyRoutes(app);
    registerMiningRoutes(app);
    registerSessionRoutes(app);
  });

  return {
    app,
    /** The pool the app is using, so the boot path can check the schema against it. */
    db,
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
