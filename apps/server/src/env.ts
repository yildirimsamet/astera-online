import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 'api' serves HTTP, 'worker' drains scheduled events, 'both' does both. */
  ROLE: z.enum(['api', 'worker', 'both']).default('both'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  /** Rotating this invalidates every session. Must be set in production. */
  JWT_SECRET: z.string().min(16).default('dev-only-secret-do-not-ship-me'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  WORKER_POLL_MS: z.coerce.number().default(5000),
  WORKER_BATCH: z.coerce.number().default(100),
  /** A claim older than this is assumed dead and returned to the queue. */
  WORKER_STALE_MINUTES: z.coerce.number().default(5),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof schema>;

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
