import { and, asc, eq, lt, lte, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../db/client.js';
import { scheduledEvents } from '../db/schema.js';

export type EventRow = typeof scheduledEvents.$inferSelect;

/**
 * A `Date` cannot be bound as a parameter inside a raw `sql` template on
 * postgres.js — it throws "argument must be of type string". The query builder
 * handles Dates correctly; only hand-written SQL needs this conversion, and
 * `claimDue` is the only place that requires hand-written SQL at all.
 */
const ts = (d: Date): string => d.toISOString();

/**
 * Atomically claim due events.
 *
 * FOR UPDATE SKIP LOCKED is what makes this crash-safe and horizontally scalable
 * with zero coordination: two workers never touch the same row, and a worker that
 * dies mid-claim leaves the row exactly as it found it.
 *
 * The select and the status write are one statement, so there is no window in
 * which an event is chosen but unmarked. Drizzle's builder cannot express
 * `FOR UPDATE SKIP LOCKED` inside a subquery, which is why this one is raw.
 */
export async function claimDue(db: Db, batch: number, now: Date): Promise<EventRow[]> {
  const rows = await db.execute<EventRow>(sql`
    UPDATE scheduled_events
       SET status = 'processing',
           claimed_at = ${ts(now)}::timestamptz,
           attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM scheduled_events
        WHERE status = 'pending'
          AND resolve_at <= ${ts(now)}::timestamptz
        ORDER BY resolve_at
          FOR UPDATE SKIP LOCKED
        LIMIT ${batch}
     )
    RETURNING *
  `);
  // Raw SQL returns snake_case columns; map them onto the typed shape.
  //
  // The ORDER BY inside the subquery decides WHICH rows are claimed, but
  // PostgreSQL makes no guarantee about RETURNING order. Processing order does
  // matter — two arrivals at the same planet must resolve oldest-first — so sort
  // explicitly rather than relying on an accident of the query plan.
  return [...rows].map(fromRow).sort((a, b) => a.resolveAt.getTime() - b.resolveAt.getTime());
}

interface RawEventRow {
  id: string;
  season_id: string;
  kind: EventRow['kind'];
  ref_id: string | null;
  payload: Record<string, unknown> | null;
  resolve_at: string | Date;
  status: EventRow['status'];
  attempts: number;
  claimed_at: string | Date | null;
  last_error: string | null;
}

function fromRow(raw: unknown): EventRow {
  const r = raw as RawEventRow;
  return {
    id: r.id,
    seasonId: r.season_id,
    kind: r.kind,
    refId: r.ref_id,
    payload: r.payload,
    resolveAt: new Date(r.resolve_at),
    status: r.status,
    attempts: r.attempts,
    claimedAt: r.claimed_at ? new Date(r.claimed_at) : null,
    lastError: r.last_error,
  };
}

export async function complete(db: Db, id: string): Promise<void> {
  await db
    .update(scheduledEvents)
    .set({ status: 'done', lastError: null, claimedAt: null })
    .where(eq(scheduledEvents.id, id));
}

/**
 * A failed event goes back to pending so it retries, until it has burned through
 * its attempt budget. Better late than never: every event carries the time it was
 * meant to fire at, so a retry is still correct, merely delayed.
 */
export async function fail(
  db: Db,
  id: string,
  err: unknown,
  maxAttempts = 5,
): Promise<{ exhausted: boolean }> {
  const message = err instanceof Error ? err.message : String(err);
  const rows = await db
    .update(scheduledEvents)
    .set({
      status: sql`CASE WHEN ${scheduledEvents.attempts} >= ${maxAttempts}
                       THEN 'failed'::event_status ELSE 'pending'::event_status END`,
      claimedAt: null,
      lastError: message,
    })
    .where(eq(scheduledEvents.id, id))
    .returning({ status: scheduledEvents.status });
  // The caller has to know, because a row that reaches `failed` is never read
  // again by anything — whatever it was going to resolve is stranded until
  // somebody undoes it. See `worker/abandon.ts`.
  return { exhausted: rows[0]?.status === 'failed' };
}

/**
 * Return abandoned claims to the queue.
 *
 * If a worker is SIGKILLed between claiming and completing, its rows sit in
 * `processing` forever. This is the only thing standing between that and a fleet
 * that never lands.
 */
export async function reap(db: Db, staleMinutes: number, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000);
  const rows = await db
    .update(scheduledEvents)
    .set({ status: 'pending', claimedAt: null })
    .where(and(eq(scheduledEvents.status, 'processing'), lt(scheduledEvents.claimedAt, cutoff)))
    .returning({ id: scheduledEvents.id });
  return rows.length;
}

export async function schedule(
  db: Queryable,
  input: {
    seasonId: string;
    kind: EventRow['kind'];
    refId?: string;
    payload?: Record<string, unknown>;
    resolveAt: Date;
  },
): Promise<void> {
  await db.insert(scheduledEvents).values({
    seasonId: input.seasonId,
    kind: input.kind,
    refId: input.refId ?? null,
    payload: input.payload ?? null,
    resolveAt: input.resolveAt,
  });
}

/**
 * How far behind the queue is, in seconds.
 *
 * A stalled worker is the failure that silently breaks this game: the API keeps
 * answering and planets keep producing while fleets simply never land.
 */
/**
 * Events that gave up for good.
 *
 * `oldestPendingAge` filters `status = 'pending'`, so a `failed` row is invisible
 * to it and the lag metric reads perfectly healthy while a flight is stranded.
 * Anything above zero here is a bug that has already happened. D28.
 */
export async function failedEventCount(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(scheduledEvents)
    .where(eq(scheduledEvents.status, 'failed'));
  return row?.n ?? 0;
}

export async function oldestPendingAge(db: Db, now: Date): Promise<number | null> {
  const [row] = await db
    .select({ resolveAt: scheduledEvents.resolveAt })
    .from(scheduledEvents)
    .where(and(eq(scheduledEvents.status, 'pending'), lte(scheduledEvents.resolveAt, now)))
    .orderBy(asc(scheduledEvents.resolveAt))
    .limit(1);
  return row ? (now.getTime() - row.resolveAt.getTime()) / 1000 : null;
}
