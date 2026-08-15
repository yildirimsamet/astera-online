import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Db = ReturnType<typeof createDb>['db'];
/** A transaction handle. Every mutating service takes one of these, never the pool. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either works for reads; only Tx may mutate. */
export type Queryable = Db | Tx;

export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, {
    max: opts.max ?? 10,
    // Timestamps come back as Date objects; the clock helpers do the rest.
    transform: undefined,
    // Postgres NOTICEs are noise here — schema DDL emits them constantly during
    // migrations and they are not actionable at runtime.
    onnotice: () => undefined,
  });
  const db = drizzle(sql, { schema });
  return { sql, db, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
