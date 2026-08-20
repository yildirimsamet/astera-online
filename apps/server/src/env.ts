import { dirname, join } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 'api' serves HTTP, 'worker' drains scheduled events, 'both' does both. */
  ROLE: z.enum(['api', 'worker', 'both']).default('both'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
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
  /** How rarely one account's "in game" stamp is rewritten. See services/presence.ts. */
  PRESENCE_THROTTLE_MS: z.coerce.number().default(60_000),
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
