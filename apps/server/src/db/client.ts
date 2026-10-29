import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema.js';
import { flushBeforeCommit } from './finalizers.js';

export type Db = PostgresJsDatabase<typeof schema>;
/** A transaction handle. Every mutating service takes one of these, never the pool. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either works for reads; only Tx may mutate. */
export type Queryable = Db | Tx;

/** Statements one request or worker event issued. Scaling plan F0.2. */
export interface StatementCount { statements: number }
const statementScope = new AsyncLocalStorage<StatementCount>();
/** Counts every statement any `createDb` pool issues while `run` and its awaits execute. */
export const countStatements = <T>(scope: StatementCount, run: () => T): T => statementScope.run(scope, run);

export function createDb(
  url: string,
  opts: { max?: number; applicationName?: string; idleInTransactionTimeoutMs?: number } = {},
) {
  const sql = postgres(url, {
    max: opts.max ?? 10,
    connection: {
      application_name: opts.applicationName ?? 'astera',
      ...(opts.idleInTransactionTimeoutMs === undefined
        ? {}
        : { idle_in_transaction_session_timeout: opts.idleInTransactionTimeoutMs }),
    },
    // Timestamps come back as Date objects; the clock helpers do the rest.
    transform: undefined,
    // Postgres NOTICEs are noise here — schema DDL emits them constantly during
    // migrations and they are not actionable at runtime.
    onnotice: () => undefined,
  });
  const db = drizzle(sql, { schema, logger: { logQuery: () => {
    const scope = statementScope.getStore();
    if (scope) scope.statements += 1;
  } } });
  const transaction = db.transaction.bind(db);
  db.transaction = <T>(action: (tx: Tx) => Promise<T>, config?: PgTransactionConfig): Promise<T> =>
    transaction(async tx => {
      const result = await action(tx);
      await flushBeforeCommit(tx);
      return result;
    }, config);
  return { sql, db, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
