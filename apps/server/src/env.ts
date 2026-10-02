import { dirname, join } from 'node:path';
import { z } from 'zod';
import { MULTI_WORLD } from '@astera/rules';
import { BOTS } from './services/bots/personas.js';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 'api' serves HTTP, 'worker' drains scheduled events, 'both' does both. */
  ROLE: z.enum(['api', 'worker', 'both']).default('both'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  /** Request-pool budget per process; LISTEN uses one additional connection. */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  /**
   * Rotating this invalidates every session. Must be set in production.
   *
   * `SHARD_CODE` used to sit here and is gone (D21). One process now serves all ten
   * galaxies and works out which one a caller is in from their own player row, so a
   * variable naming "the" shard could only ever be wrong for nine of them.
   */
  JWT_SECRET: z.string().min(16).default('dev-only-secret-do-not-ship-me'),
  /** Live checkout stays closed until all three secrets are supplied and enabled. */
  PADDLE_CHECKOUT_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  PADDLE_ENV: z.enum(['sandbox', 'production']).default('production'),
  PADDLE_API_KEY: z.string().default(''),
  PADDLE_CLIENT_TOKEN: z.string().default(''),
  PADDLE_WEBHOOK_SECRET: z.string().default(''),
  PADDLE_PRICE_LAVA: z.string().startsWith('pri_').default('pri_01m3fwr44wjzkbenrjctb9k6dd'),
  PADDLE_PRICE_ICE: z.string().startsWith('pri_').default('pri_01m3fws4ewv6kp2yr4tztk8427'),
  PADDLE_PRICE_TOXIC: z.string().startsWith('pri_').default('pri_01m3fwtx8bvz0dbqdv3p18379m'),
  PADDLE_PRICE_DESERT: z.string().startsWith('pri_').default('pri_01m3fwvmk6eysq56ed05z1828m'),
  PADDLE_PRICE_TURKEY: z.string().startsWith('pri_').default('pri_01m3fx4wqpeqpzav659tz16e7t'),
  PADDLE_PRICE_GERMANY: z.string().startsWith('pri_').default('pri_01m3fx5v21rxrjaddw764dexe4'),
  PADDLE_PRICE_FRANCE: z.string().startsWith('pri_').default('pri_01m3fx6rg3nsn9nd3j179287hg'),
  PADDLE_PRICE_SPAIN: z.string().startsWith('pri_').default('pri_01m3fx85a9gb6gpkbbrjjry73p'),
  PADDLE_PRICE_BUNDLE: z.string().startsWith('pri_').default('pri_01m3fx3943k024e12yb67a49r1'),
  /** Polar sales are enabled only after catalog, webhook, and checkout are verified. */
  POLAR_CHECKOUT_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  POLAR_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  POLAR_ACCESS_TOKEN: z.string().default(''),
  POLAR_WEBHOOK_SECRET: z.string().default(''),
  POLAR_RETURN_URL: z.string().url().default('http://localhost:5173/'),
  POLAR_PRODUCT_LAVA: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_ICE: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_TOXIC: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_DESERT: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_TURKEY: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_GERMANY: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_FRANCE: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_SPAIN: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_JAPAN: z.string().uuid().or(z.literal('')).default(''),
  POLAR_PRODUCT_BUNDLE: z.string().uuid().or(z.literal('')).default(''),
  ACCESS_TOKEN_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  /**
   * Permanent account usernames allowed onto the operations panel.
   *
   * Kept outside the database deliberately: a compromised admin route must not
   * be able to promote another account and turn one stolen session into a durable
   * privilege escalation. Usernames are canonical lower-case account keys.
   */
  ADMIN_USERNAMES: z.string().default('').transform((value) =>
    value
      .split(',')
      .map((username) => username.trim().toLocaleLowerCase('en-US'))
      .filter((username) => username.length > 0),
  ),
  /** How rarely one account's "in game" stamp is rewritten. See services/presence.ts. */
  PRESENCE_THROTTLE_MS: z.coerce.number().default(60_000),
  /**
   * READ THE CALLER'S ADDRESS OUT OF THE PROXY'S HEADER. Production only.
   *
   * Behind nginx every request arrives from 127.0.0.1, so `req.ip` is the proxy
   * and not the caller. That is merely untidy in a log and CATASTROPHIC in a rate
   * limiter: one bucket for the whole internet means the first burst locks every
   * player out of the game at once. Turning this on makes `req.ip` read
   * `X-Forwarded-For` instead.
   *
   * OFF BY DEFAULT, because a server reachable directly must never believe a
   * header the caller writes — that is a rate limiter anyone can walk past by
   * inventing an address. It is safe to turn on exactly when nothing but the proxy
   * can reach the port, which is what the `127.0.0.1:` bind in the production
   * compose file guarantees.
   */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * HOW MANY REQUESTS ONE ADDRESS MAY MAKE A MINUTE.
   *
   * A safety net over the whole API rather than a game rule. A commander at rest
   * costs four polls a minute plus one held stream; a commander playing hard costs
   * perhaps forty. Three hundred is far above anything a person produces and far
   * below what it takes to hurt a small box.
   */
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  /**
   * SIGNING IN IS EXPENSIVE ON PURPOSE, WHICH MAKES IT A LEVER.
   *
   * Every login burns a full scrypt — 16 MB and tens of milliseconds — and it does
   * so even for a name that does not exist, because the decoy hash in
   * `services/account.ts` is what removes the timing oracle. Measured on the
   * development box: fifty concurrent bad logins pin a core for half a second. It
   * is also the brute-force surface, and there is no lockout anywhere else. Doubled
   * from twenty to forty (owner, 2026-09-12): a CGNAT address shares this bucket.
   */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(40),
  /**
   * A NEW ACCOUNT TAKES A SEAT, AND SEATS ARE THE SCARCE THING. D21/D56.
   *
   * `/api/onboarding/claim` is unauthenticated and creates an account, a planet
   * and a place in the frontier galaxy in one call. A galaxy holds three hundred
   * commander seats and galaxies fill strictly in order, so a script left alone
   * with this endpoint empties the only mitigation the empty-shard risk has. Six an hour per address
   * was catching real players behind mobile CGNAT, so it
   * was tripled to eighteen (owner, 2026-09-12) — still useless for a script.
   */
  RATE_LIMIT_SIGNUP_MAX: z.coerce.number().default(18),
  /** Set on replicated API deployments; absent keeps local/test in-memory limits. */
  RATE_LIMIT_REDIS_URL: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().url().optional(),
  ),
  /**
   * HOW LATE THE WORLD IS ALLOWED TO BE. D52.
   *
   * Every scheduled moment in the game — a raid settling, a fleet coming home, a
   * drill reaching its rock, a radar warning firing — happens on the next tick
   * after its `resolve_at`. At five seconds that is up to five seconds during which
   * a squadron that has finished bombarding is still `in_flight`: it hangs over the
   * world it has just hit, doing nothing, because nothing has decided yet. The
   * owner named it exactly — "boş boş bekliyorlar".
   *
   * One second. A tick is a single `SKIP LOCKED` claim that returns nothing almost
   * every time, so the cost is a query per second per worker process and the return
   * is that the universe stops visibly lagging its own clock.
   */
  /**
   * DOES THIS DEPLOYMENT PLAY COMMANDERS OF ITS OWN? D159.
   *
   * OFF BY DEFAULT, and the default is load-bearing rather than cautious. Turning
   * this on seats accounts on a live galaxy, writes the population figures every
   * screen in the game reads, and launches real fleets at real players. None of
   * that may happen because a process booted with an empty environment — a
   * developer running `pnpm dev` against a copy of production must get a quiet
   * galaxy, not eight commanders going to work.
   *
   * Only the worker reads it (`ROLE=worker|both`); an API replica with it set does
   * nothing, because nothing in the request path consults it.
   */
  BOTS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Operator ceiling. Real-player demand, staged seating and the authored bot
   * address pool may all leave a galaxy below this limit.
   */
  BOTS_PER_GALAXY: z.coerce.number().int().min(1).max(MULTI_WORLD.botSlots).default(BOTS.maxPerGalaxy),
  // Explicit rollout switch. Disabling never re-enables destructive reclaim.
  SILENT_SPACE_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  SILENT_SPACE_BATCH: z.coerce.number().int().min(1).max(20).default(5),
  SILENT_SPACE_MAX_SHARDS: z.coerce.number().int().min(1).max(32).default(16),
  WORKER_POLL_MS: z.coerce.number().default(1000),
  WORKER_BATCH: z.coerce.number().default(100),
  /** A claim older than this is assumed dead and returned to the queue. */
  WORKER_STALE_MINUTES: z.coerce.number().default(5),
  PROJECTION_CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  PROJECTION_CACHE_MAX_SEASONS: z.coerce.number().int().min(1).max(100).default(16),
  PROJECTION_CACHE_MAX_ACCOUNTS: z.coerce.number().int().min(300).max(100_000).default(1024),
  COMMANDER_CACHE_TTL_MS: z.coerce.number().int().min(1000).max(300_000).default(30_000),
  PUBLIC_CACHE_TTL_MS: z.coerce.number().int().min(1000).max(300_000).default(30_000),
  TRAFFIC_CACHE_TTL_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  MINING_CACHE_TTL_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  /** A slow phone is disconnected before its SSE socket can grow without bound. */
  SSE_MAX_BUFFER_BYTES: z.coerce.number().int().min(4096).max(1_048_576).default(65_536),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof schema>;

/**
 * Read `.env` if there is one, using Node's own loader.
 *
 * Optional on purpose: production injects real environment variables and has no
 * file, so a missing one is the normal case rather than a failure. Values already
 * in the environment win, which is what makes `PORT=3200 pnpm dev` work.
 */
export function loadDotEnv(from = process.cwd()): void {
  // Walks up because pnpm runs a package script with the package as its cwd,
  // while the one .env that configures the whole stack lives at the repo root.
  let dir = from;
  for (let depth = 0; depth < 4; depth++) {
    try {
      process.loadEnvFile(join(dir, '.env'));
      return;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return;
      dir = parent;
    }
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Accept both the deployment names and the shorter internal names. This keeps
  // existing production secrets valid while making the expected mapping explicit.
  const normalized = {
    ...source,
    PADDLE_API_KEY: source.PADDLE_API_KEY?.trim() ? source.PADDLE_API_KEY : (source.PADDLE_LIVE_API_KEY ?? ''),
    PADDLE_CLIENT_TOKEN: source.PADDLE_CLIENT_TOKEN?.trim() ? source.PADDLE_CLIENT_TOKEN : (source.PADDLE_CLIENT_SIDE_TOKEN ?? ''),
  };
  const parsed = schema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.startsWith('dev-only')) {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (parsed.data.SILENT_SPACE_ENABLED && parsed.data.ROLE !== 'api' && parsed.data.DB_POOL_MAX < 2) {
    throw new Error('DB_POOL_MAX must be at least 2 for Silent Space maintenance');
  }
  return parsed.data;
}
