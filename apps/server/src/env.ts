import { dirname, join } from 'node:path';
import { z } from 'zod';

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
   * is also the brute-force surface, and there is no lockout anywhere else.
   */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(20),
  /**
   * A NEW ACCOUNT TAKES A SEAT, AND SEATS ARE THE SCARCE THING. D21/D56.
   *
   * `/api/onboarding/claim` is unauthenticated and creates an account, a planet
   * and a place in the frontier galaxy in one call. A galaxy holds three hundred
   * commander seats and galaxies fill strictly in order, so a script left alone
   * with this endpoint empties the only mitigation the empty-shard risk has. Six an hour per address
   * is generous for a household and useless for a script.
   */
  RATE_LIMIT_SIGNUP_MAX: z.coerce.number().default(6),
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
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.startsWith('dev-only')) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return parsed.data;
}
