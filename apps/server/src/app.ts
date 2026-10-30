import { AccountSecurity } from './services/accountSecurity.js';
import { registerAccountDeletionRoutes } from './routes/accountDeletion.js';
import { registerContentReportRoutes } from './routes/contentReports.js';
import { registerCommunityBlockRoutes } from './routes/communityBlocks.js';
import { registerCommunityPolicyRoutes } from './routes/communityPolicy.js';
import cors from '@fastify/cors';
import { NativeSessions } from './services/nativeSessions.js';
import { registerNativeAuthRoutes } from './routes/nativeAuth.js';
import { MailQueue, ResendMailer, type TransactionalMailer } from './services/mail.js';
import { registerAccountSecurityRoutes } from './routes/accountSecurity.js';
import { installPlacementGate } from './services/placementGate.js';
import { registerReturnApplicationRoutes } from './routes/returnApplications.js';
import cookie from '@fastify/cookie';
import rateLimit, { normalizeIP } from '@fastify/rate-limit';
import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import { and, eq, not } from 'drizzle-orm';
import { accountIsBanned } from './services/accountBan.js';
import { accounts } from './db/schema.js';
import { ZodError } from 'zod';
import { pino } from 'pino';
import type { Env } from './env.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { countStatements, createDb, type Db, type StatementCount } from './db/client.js';
import { InvalidSessionError, TokenService } from './auth/tokens.js';
import { GameError } from './services/planet.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPlanetRoutes } from './routes/planet.js';
import { registerVacationRoutes } from './routes/vacation.js';
import { registerNotificationCenterRoutes } from './routes/notificationCenter.js';
import { registerRewardRoutes } from './routes/rewards.js';
import { registerBrandRecallRoutes } from './routes/brandRecall.js';
import { registerIntelRoutes } from './routes/intel.js';
import { registerGalaxyRoutes } from './routes/galaxy.js';
import { registerMonumentRoutes } from './routes/monuments.js';
import { registerMiningRoutes } from './routes/mining.js';
import { registerPirateRoutes } from './routes/pirates.js';
import { registerUnknownSignalRoutes } from './routes/unknownSignals.js';
import { registerTradeRoutes } from './routes/trade.js';
import { registerIntergalacticConvoyRoutes } from './routes/intergalacticConvoy.js';
import { registerHealthRoutes } from './routes/health.js';
import { EventWorker } from './worker/loop.js';
import { EventBus } from './stream/bus.js';
import { StreamFence } from './stream/fence.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerSeasonRoutes } from './routes/season.js';
import { registerServerRoutes } from './routes/servers.js';
import { registerPreviewRoutes } from './routes/preview.js';
import { registerOnboardingRoutes } from './routes/onboarding.js';
import { registerChatMediaRoutes } from './routes/chatMedia.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerDmRoutes } from './routes/dm.js';
import { registerChronicleRoutes } from './routes/chronicle.js';
import { registerGalaxyEventRoutes } from './routes/galaxyEvents.js';
import { registerClanRoutes } from './routes/clan.js';
import { registerCommunityRoutes } from './routes/community.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerCosmeticRoutes } from './routes/cosmetics.js';
import { registerPaddleRoutes } from './routes/paddle.js';
import { registerPolarRoutes } from './routes/polar.js';
import { registerShopierRoutes } from './routes/shopier.js';
import { Presence } from './services/presence.js';
import { Projections } from './services/projections.js';
import { RateLimitBackend } from './services/rateLimitBackend.js';
import { RuntimeMetrics } from './services/runtimeMetrics.js';
import { StreamRegistry } from './services/streamRegistry.js';
import { DatabasePoolProbe } from './services/databasePoolProbe.js';
import { performance } from 'node:perf_hooks';
import { registerArena } from './arena/server.js';

/**
 * THE TWO ROUTES THAT COST MORE THAN THEY LOOK, AND THEIR WINDOWS.
 *
 * The ceilings are configurable because a deployment may need to move them; the
 * WINDOWS are not, because they are the reasoning rather than the tuning. A ten
 * minute window on signing in is what turns "twenty tries" into a rate slow
 * enough that a password list is useless; an hour on taking a seat is what makes
 * exhausting a three-hundred-seat galaxy take sustained effort from many
 * different addresses instead of four seconds from one.
 */
const AUTH_WINDOW = '10 minutes';
const SIGNUP_WINDOW = '1 hour';

/** What a route asks for when it wants one of the strict buckets. */
export interface RouteLimits {
  /** Signing in and exchanging a refresh cookie. */
  auth: { max: number; timeWindow: string; skipOnError: false; keyGenerator: typeof ipLimitKey };
  /** Anything that creates an account — and therefore takes a seat. */
  signup: { max: number; timeWindow: string; skipOnError: false; keyGenerator: typeof ipLimitKey };
}

const ipLimitKey = (req: FastifyRequest): string => `ip:${normalizeIP(req.ip)}`;

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    clock: Clock;
    tokens: TokenService;
    nativeSessions: NativeSessions;
    accountSecurity: AccountSecurity;
    mail: MailQueue;
    presence: Presence;
    worker: EventWorker;
    bus: EventBus;
    projections: Projections;
    rateLimitBackend: RateLimitBackend;
    metrics: RuntimeMetrics;
    streams: StreamRegistry;
    streamFence: StreamFence;
    sseMaxBufferBytes: number;
    sseHeartbeatMs: number;
    dbPoolMax: number;
    placementPoolMax: number;
    limits: RouteLimits;
    /** Canonical usernames configured out of band; never writable through the API. */
    adminUsernames: ReadonlySet<string>;
  }
  interface FastifyRequest {
    /** Set by `requireAuth`. Absent on public routes. */
    accountId?: string;
    authVersion?: number;
    nativeSessionId?: string;
    capacityStartedAt?: number;
    capacityResponseBytes?: number;
    dbStatements?: StatementCount;
  }
}

export interface BuildAppOptions {
  env: Env;
  clock?: Clock;
  logger?: FastifyBaseLogger;
  db?: Db;
  mailer?: TransactionalMailer;
}

export interface BuiltApp {
  mail: MailQueue;
  app: FastifyInstance;
  /** The pool the app is using, so the boot path can check the schema against it. */
  db: Db;
  worker: EventWorker;
  bus: EventBus;
  projections: Projections;
  rateLimitBackend: RateLimitBackend;
  metrics: RuntimeMetrics;
  streams: StreamRegistry;
  close: () => Promise<void>;
}

export function buildApp(opts: BuildAppOptions): BuiltApp {
  const clock = opts.clock ?? systemClock;
  // Annotated, not asserted. Passing a concrete pino Logger would specialise
  // Fastify's logger generic and propagate a non-default FastifyInstance type
  // into every route signature in the app; pino satisfies this interface anyway.
  const log: FastifyBaseLogger = opts.logger ?? pino({ level: opts.env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'res.headers["set-cookie"]'] });

  const idleBound = opts.env.ROLE === 'api'
    ? { idleInTransactionTimeoutMs: opts.env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS }
    : {};
  const owned = opts.db ? null : createDb(opts.env.DATABASE_URL, {
    max: opts.env.DB_POOL_MAX,
    applicationName: `astera-${opts.env.ROLE}`,
    ...idleBound,
  });
  const db = opts.db ?? owned!.db;

  const app = Fastify({
    loggerInstance: log,
    logController: new LogController({ disableRequestLogging: opts.env.NODE_ENV === 'test' }),
    /**
     * Behind the production proxy `req.ip` must be the CALLER, not nginx. See
     * `TRUST_PROXY` in env.ts for why this is off unless a deployment says so.
     */
    trustProxy: opts.env.TRUST_PROXY,
  });
  const closePlacementGate = installPlacementGate(app, opts.env.DATABASE_URL, opts.env.PLACEMENT_POOL_MAX,
    { ...idleBound, requireCurrentRules: opts.env.REQUIRE_CURRENT_RULES });
  const tokens: TokenService = new TokenService(
    opts.env.JWT_SECRET,
    opts.env.ACCESS_TOKEN_MINUTES,
    opts.env.REFRESH_TOKEN_DAYS,
    async (id, version, nativeSessionId) => {
      if (nativeSessionId) return nativeSessions.isCurrent(nativeSessionId, id, version);
      const [account] = await db.select({ version: accounts.authVersion, deletionApprovedAt: accounts.deletionApprovedAt }).from(accounts).where(and(eq(accounts.id, id), not(accountIsBanned)));
      return account?.version === version && account.deletionApprovedAt === null;
    },
  );
  const nativeSessions = new NativeSessions(db, clock, tokens);
  const worker = new EventWorker(
    db,
    clock,
    {
      pollMs: opts.env.WORKER_POLL_MS,
      batch: opts.env.WORKER_BATCH,
      staleMinutes: opts.env.WORKER_STALE_MINUTES,
      botsEnabled: opts.env.BOTS_ENABLED,
      botsPerGalaxy: opts.env.BOTS_PER_GALAXY,
      silentSpaceEnabled: opts.env.SILENT_SPACE_ENABLED,
      silentSpaceBatch: opts.env.SILENT_SPACE_BATCH,
      silentSpaceMaxShards: opts.env.SILENT_SPACE_MAX_SHARDS,
      silentSpaceExemptAccountIds: opts.env.SILENT_SPACE_EXEMPT_ACCOUNT_IDS,
      adminUsernames: new Set(opts.env.ADMIN_USERNAMES),
      mediaDirectory: opts.env.CHAT_MEDIA_DIR,
      erasureSecret: opts.env.JWT_SECRET,
    },
    log,
  );

  const mail = new MailQueue(db, opts.env, clock, opts.mailer ?? new ResendMailer(opts.env), log);
  app.decorate('mail', mail);
  app.decorate('accountSecurity', new AccountSecurity(db, opts.env, clock, mail));
  app.decorate('nativeSessions', nativeSessions);
  app.decorate('db', db);
  app.decorate('clock', clock);
  app.decorate('tokens', tokens);
  app.decorate('presence', new Presence(db, clock, opts.env.PRESENCE_THROTTLE_MS,
    (err) => { log.error({ err }, 'presence write failed; activity was not renewed'); }));
  app.decorate('worker', worker);
  const bus = new EventBus(opts.env.DATABASE_URL, log);
  app.decorate('bus', bus);
  const streamFence = new StreamFence(db, clock, bus, log);
  app.decorate('streamFence', streamFence);
  const projections = new Projections(db, bus, {
    enabled: opts.env.PROJECTION_CACHE_ENABLED,
    maxSeasons: opts.env.PROJECTION_CACHE_MAX_SEASONS,
    maxAccounts: opts.env.PROJECTION_CACHE_MAX_ACCOUNTS,
    commanderTtlMs: opts.env.COMMANDER_CACHE_TTL_MS,
    publicTtlMs: opts.env.PUBLIC_CACHE_TTL_MS,
    trafficTtlMs: opts.env.TRAFFIC_CACHE_TTL_MS,
    miningTtlMs: opts.env.MINING_CACHE_TTL_MS,
  });
  app.decorate('projections', projections);
  const rateLimitBackend = new RateLimitBackend(opts.env.RATE_LIMIT_REDIS_URL);
  app.decorate('rateLimitBackend', rateLimitBackend);
  const metrics = new RuntimeMetrics();
  app.decorate('metrics', metrics);
  const databasePoolProbe = owned === null
    ? null
    : new DatabasePoolProbe(owned.sql, metrics);
  if (databasePoolProbe) {
    app.addHook('onReady', (done) => {
      databasePoolProbe.start();
      done();
    });
  }
  const streams = new StreamRegistry();
  app.decorate('streams', streams);
  app.decorate('sseMaxBufferBytes', opts.env.SSE_MAX_BUFFER_BYTES);
  app.decorate('sseHeartbeatMs', opts.env.SSE_HEARTBEAT_MS);
  app.decorate('dbPoolMax', opts.env.DB_POOL_MAX);
  app.decorate('placementPoolMax', opts.env.PLACEMENT_POOL_MAX);
  app.decorate('limits', {
    auth: {
      max: opts.env.RATE_LIMIT_AUTH_MAX,
      timeWindow: AUTH_WINDOW,
      skipOnError: false,
      keyGenerator: ipLimitKey,
    },
    signup: {
      max: opts.env.RATE_LIMIT_SIGNUP_MAX,
      timeWindow: SIGNUP_WINDOW,
      skipOnError: false,
      keyGenerator: ipLimitKey,
    },
  });
  app.decorate('adminUsernames', new Set(opts.env.ADMIN_USERNAMES));

  if (opts.env.ROLE !== 'worker' && opts.env.NATIVE_APP_ORIGINS.length > 0) {
    void app.register(cors, {
      origin: opts.env.NATIVE_APP_ORIGINS,
      credentials: false,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'x-placement', 'idempotency-key', 'x-astera-cosmetics', 'x-media-type', 'x-astera-build', 'x-astera-rules'],
      exposedHeaders: ['x-server-time', 'x-placement', 'Date'],
      maxAge: 600,
    });
  }
  void app.register(cookie);

  /**
   * A bundled app cannot be hot-fixed like the web: when the API moves past it, it
   * must say "update" instead of failing request by request. The web sends no build.
   */
  const minimumBuild = opts.env.MIN_NATIVE_BUILD;
  if (minimumBuild > 0) {
    app.addHook('onRequest', (req, reply, done) => {
      const build = req.headers['x-astera-build'];
      if (build === undefined || !req.url.startsWith('/api/')) { done(); return; }
      if (typeof build === 'string' && /^\d{1,10}$/.test(build) && Number(build) >= minimumBuild) { done(); return; }
      void reply.status(426).send({ error: 'UPDATE_REQUIRED', message: 'Update Astera Online to keep playing' });
    });
  }

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
   * The production D99 topology supplies a shared Valkey store below this plugin;
   * tests and single-process development deliberately use its in-memory fallback.
   */
  void app.register(rateLimit, {
    global: true,
    max: opts.env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    redis: rateLimitBackend.client ?? undefined,
    // Gameplay remains available if the transient counter service fails. Login
    // and seat-taking override this to fail closed above.
    skipOnError: true,
    keyGenerator: async (req) => {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) return ipLimitKey(req);
      try {
        const identity = await tokens.identity(header.slice(7), 'access');
        const accountId = identity.accountId;
        req.accountId = accountId;
        req.authVersion = identity.version;
        req.nativeSessionId = identity.nativeSessionId;
        return `account:${accountId}`;
      } catch (error) {
        if (!(error instanceof InvalidSessionError)) throw error;
        return ipLimitKey(req);
      }
    },
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
   * Web remains same-origin through the Vite proxy or production host. Explicit
   * native origins expose this clock through the CORS registration above.
   */
  app.addHook('onSend', (_req, reply, payload, done) => {
    reply.header('x-server-time', String(clock.now().getTime()));
    done(null, payload);
  });

  app.addHook('onRequest', (req, _reply, done) => {
    req.capacityStartedAt = performance.now();
    req.dbStatements = { statements: 0 };
    countStatements(req.dbStatements, done);
  });
  // The count is internal: production keeps it in /metrics only (F0.2).
  const exposeStatements = opts.env.NODE_ENV !== 'production';
  app.addHook('onSend', (req, reply, payload, done) => {
    req.capacityResponseBytes = typeof payload === 'string'
      ? Buffer.byteLength(payload)
      : Buffer.isBuffer(payload)
        ? payload.byteLength
        : 0;
    if (exposeStatements) reply.header('x-db-statements', String(req.dbStatements?.statements ?? 0));
    done(null, payload);
  });
  app.addHook('onResponse', (req, reply, done) => {
    metrics.observeRoute(
      req.method,
      req.routeOptions.url ?? req.url,
      reply.statusCode,
      performance.now() - (req.capacityStartedAt ?? performance.now()),
      req.capacityResponseBytes ?? 0,
      req.dbStatements?.statements ?? 0,
    );
    done();
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
    const route = req.routeOptions.url ?? req.url;

    if (err instanceof GameError) {
      /**
       * The code, the English sentence, and the figures that sentence was built
       * from. The client localises off the code and interpolates the params; the
       * sentence is what a client one deploy BEHIND this server still has to show.
       * `params` is omitted rather than sent empty, so nothing changes on the wire
       * for the refusals that have no figures in them.
       */
      metrics.observeRefusal(req.method, route, err.code);
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
      metrics.observeRefusal(req.method, route, 'BAD_REQUEST');
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request',
      });
    }
    if (error.validation) {
      metrics.observeRefusal(req.method, route, 'BAD_REQUEST');
      return reply.status(400).send({ error: 'BAD_REQUEST', message: error.message });
    }
    if (route.startsWith('/api/auth/') || route === '/api/mail/resend/webhook') {
      req.log.error({ errorName: error.name }, 'account security request failed');
    } else {
      req.log.error({ err: error }, 'unhandled route error');
    }
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
    registerHealthRoutes(app, {
      streamRequired: opts.env.ROLE === 'api',
      role: opts.env.ROLE,
      botCap: opts.env.BOTS_PER_GALAXY,
    });
    // A worker exposes only its loopback operations surface. It must never become
    // an accidental fourth public API replica merely because metrics need a port.
    if (opts.env.ROLE === 'arena') { registerArena(app, opts.env); return; }
    if (opts.env.ROLE === 'worker') return;
    registerAuthRoutes(app, opts.env.FIRST_GAME_SHIELD_ENABLED);
    if (opts.env.NATIVE_AUTH_ENABLED) registerNativeAuthRoutes(app, opts.env.FIRST_GAME_SHIELD_ENABLED);
    registerAccountSecurityRoutes(app, opts.env);
    registerAccountDeletionRoutes(app, opts.env.CHAT_MEDIA_DIR, opts.env.JWT_SECRET);
    registerContentReportRoutes(app, opts.env.CHAT_MEDIA_DIR);
    registerCommunityBlockRoutes(app);
    registerCommunityPolicyRoutes(app);
    registerServerRoutes(app);
    registerPreviewRoutes(app);
    registerOnboardingRoutes(app, opts.env.FIRST_GAME_SHIELD_ENABLED);
    registerSeasonRoutes(app);
    registerPlanetRoutes(app);
    registerVacationRoutes(app);
    registerNotificationCenterRoutes(app);
    registerRewardRoutes(app);
    registerIntelRoutes(app);
    registerGalaxyRoutes(app);
    registerMonumentRoutes(app);
    registerMiningRoutes(app);
    registerPirateRoutes(app);
    registerUnknownSignalRoutes(app, opts.env.NODE_ENV);
    registerTradeRoutes(app);
    registerIntergalacticConvoyRoutes(app);
    registerSessionRoutes(app);
    registerBrandRecallRoutes(app);
    registerReturnApplicationRoutes(app);
    registerChatRoutes(app);
    registerChatMediaRoutes(app, opts.env.CHAT_MEDIA_DIR);
    registerDmRoutes(app);
    registerChronicleRoutes(app);
    registerGalaxyEventRoutes(app);
    registerClanRoutes(app);
    registerCommunityRoutes(app);
    registerAdminRoutes(app);
    registerCosmeticRoutes(app);
    registerPaddleRoutes(app, opts.env);
    registerPolarRoutes(app, opts.env);
    registerShopierRoutes(app, opts.env);
  });

  return {
    mail,
    app,
    /** The pool the app is using, so the boot path can check the schema against it. */
    db,
    worker,
    bus,
    projections,
    rateLimitBackend,
    metrics,
    streams,
    close: async () => {
      await mail.stop();
      await databasePoolProbe?.stop();
      await worker.stop();
      const closing = app.close();
      streams.drain();
      await closing;
      projections.close();
      streamFence.close();
      await bus.stop();
      await rateLimitBackend.stop();
      metrics.close();
      await closePlacementGate();
      if (owned) await owned.close();
    },
  };
}
