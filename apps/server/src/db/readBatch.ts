import { AsyncLocalStorage } from 'node:async_hooks';
import type { Sql, TransactionSql } from 'postgres';

type Row = readonly unknown[];
/** A pool and a transaction's handle both send through one of these. */
type Unsafe = Sql['unsafe'];

interface BatchedRead {
  query: string;
  params: readonly never[];
  prepare: boolean;
  resolve: (rows: Row[]) => void;
  reject: (error: unknown) => void;
}

/** Captured before any test can swap the timers: a read must never wait on a fake clock. */
const nextTurn = setImmediate;

/** Each scope's reads waiting for their turn, per connection handle. */
type Waiting = Map<Unsafe, BatchedRead[]>;
const scope = new AsyncLocalStorage<Waiting>();

/**
 * READS ASKED FOR TOGETHER ARE ONE STATEMENT. Query plan, 2026-11-03.
 *
 * A planet view was 32 statements for a few KB, and most of that cost is the database
 * and the driver handling statements, not reading rows. The services already read with
 * `Promise.all`. Inside `batchReads`, the reads asked for in one turn of the event loop
 * go out as one statement. Queries and results stay exactly the services' own; the
 * statement is one snapshot, which only makes parallel reads more consistent.
 *
 * Only for code that reads: a read of this scope may run after a write asked for later
 * in the same turn. Locks, raw statements and anything calling a function with an
 * effect are never gathered. An expression of `bigint` or `numeric` written in raw SQL
 * comes back as a number here and as a string alone, so read one with `.mapWith(Number)`.
 */
export const batchReads = <T>(run: () => T): T => scope.run(new Map(), run);

/** For work shared with other requests, which must not stand or fall with this one's reads. */
export const outsideBatch = <T>(run: () => T): T => scope.exit(run);

/** A lone statement is prepared up to this many parameters (`patches/drizzle-orm`): past it the shapes pile up per connection. */
const MOST_PREPARED_PARAMETERS = 32;

const SIDE_EFFECT = /\bfor\s+(?:update|no\s+key\s+update|share|key\s+share)\b|\bpg_\w+|\b(?:nextval|setval|set_config)\b/i;
const gatherable = (query: string): boolean => /^\s*select\b/i.test(query) && !SIDE_EFFECT.test(query);

/** Moves `$n` up by `by`, leaving string literals and quoted names alone. */
const shiftParameters = (query: string, by: number): string =>
  by === 0 ? query : query.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\$(\d+)/g, (match, index?: string) =>
    index === undefined ? match : `$${String(Number(index) + by)}`);

const composite = (reads: readonly BatchedRead[]): string => {
  let offset = 0;
  const parts = reads.map(read => {
    const part = `(select coalesce(json_agg(row(t.*)), '[]'::json) from (${shiftParameters(read.query, offset)}) t)`;
    offset += read.params.length;
    return part;
  });
  return `select ${parts.join(', ')}`;
};

const send = (unsafe: Unsafe, reads: BatchedRead[], onMerged: (statements: number) => void): void => {
  const [first] = reads;
  if (reads.length === 1 && first) {
    unsafe(first.query, [...first.params], { prepare: first.prepare }).values().then(
      rows => { first.resolve(rows); }, (error: unknown) => { first.reject(error); });
    return;
  }
  onMerged(reads.length - 1);
  const params = reads.flatMap(read => [...read.params]);
  const prepare = reads.every(read => read.prepare) && params.length <= MOST_PREPARED_PARAMETERS;
  unsafe(composite(reads), params, { prepare }).values().then(
    ([answers]: readonly (readonly (readonly Record<string, unknown>[])[])[]) => {
      reads.forEach((read, index) => {
        // `row()` names its fields f1, f2… in the order of the read's own columns.
        read.resolve((answers?.[index] ?? []).map(row => Object.values(row)));
      });
    },
    (error: unknown) => { for (const read of reads) read.reject(error); },
  );
};

const gather = (waiting: Waiting, unsafe: Unsafe, read: BatchedRead, onMerged: (statements: number) => void): void => {
  const queue = waiting.get(unsafe);
  if (queue) { queue.push(read); return; }
  const reads = [read];
  waiting.set(unsafe, reads);
  nextTurn(() => {
    waiting.delete(unsafe);
    send(unsafe, reads, onMerged);
  });
};

const gathering = (unsafe: Unsafe, onMerged: (statements: number) => void) =>
  (query: string, params: readonly never[] = [], options: { prepare?: boolean } = {}) => {
    const real = unsafe(query, [...params], options);
    const waiting = scope.getStore();
    if (!waiting || !gatherable(query)) return real;
    return new Proxy(real, {
      get(pending, member): unknown {
        if (member === 'values') {
          return () => new Promise<Row[]>((resolve, reject) => {
            gather(waiting, unsafe, { query, params, prepare: options.prepare === true, resolve, reject }, onMerged);
          });
        }
        const value: unknown = Reflect.get(pending, member, pending);
        return typeof value === 'function' ? value.bind(pending) : value;
      },
    });
  };

/** The driver handle Drizzle holds: what it reads inside a scope is gathered per connection. */
export const batching = (sql: Sql, onMerged: (statements: number) => void): Sql => {
  const unsafe = gathering((query, parameters, options) => sql.unsafe(query, parameters, options), onMerged);
  const begin = (run: (tx: TransactionSql) => unknown) => sql.begin((tx) => {
    const unsafeInTx = gathering((query, parameters, options) => tx.unsafe(query, parameters, options), onMerged);
    return run(new Proxy(tx, { get: (target, key, receiver): unknown => key === 'unsafe' ? unsafeInTx : Reflect.get(target, key, receiver) }));
  });
  return new Proxy(sql, {
    get: (target, key, receiver): unknown => key === 'unsafe' ? unsafe : key === 'begin' ? begin : Reflect.get(target, key, receiver),
  });
};
