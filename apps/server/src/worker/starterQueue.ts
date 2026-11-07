import { and, asc, eq, gt, lt, lte, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../db/client.js';
import { starterEvents } from '../db/schema.js';

export type StarterEventRow = typeof starterEvents.$inferSelect;

/**
 * THE STARTER GALAXY'S QUEUE, on the same contract as `queue.ts`. See there for why claiming is one
 * raw statement. The table is separate because `scheduled_events.season_id` is required and the
 * season wipe empties that table; a ship's flight lives through both.
 */
export async function claimDueStarter(db: Db, batch: number, now: Date): Promise<StarterEventRow[]> {
  const at = now.toISOString();
  const rows = await db.execute<RawRow>(sql`
    UPDATE starter_events
       SET status = 'processing', claimed_at = ${at}::timestamptz, attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM starter_events
        WHERE status = 'pending' AND resolve_at <= ${at}::timestamptz
        ORDER BY resolve_at, ref_id, id
          FOR UPDATE SKIP LOCKED
        LIMIT ${batch}
     )
    RETURNING *
  `);
  return [...rows].map(fromRow).sort((a, b) =>
    a.resolveAt.getTime() - b.resolveAt.getTime()
    || (a.refId ?? '').localeCompare(b.refId ?? '')
    || a.id.localeCompare(b.id));
}

type RawRow = Record<string, unknown> & {
  id: string;
  starter_galaxy_id: string;
  kind: StarterEventRow['kind'];
  ref_id: string | null;
  payload: Record<string, unknown> | null;
  dedupe_key: string | null;
  resolve_at: string | Date;
  status: StarterEventRow['status'];
  attempts: number;
  claimed_at: string | Date | null;
  last_error: string | null;
};

const fromRow = (r: RawRow): StarterEventRow => ({
  id: r.id,
  starterGalaxyId: r.starter_galaxy_id,
  kind: r.kind,
  refId: r.ref_id,
  payload: r.payload,
  dedupeKey: r.dedupe_key,
  resolveAt: new Date(r.resolve_at),
  status: r.status,
  attempts: r.attempts,
  claimedAt: r.claimed_at ? new Date(r.claimed_at) : null,
  lastError: r.last_error,
});

export async function nextDueStarterAt(db: Db, after: Date, before: Date): Promise<Date | null> {
  const [row] = await db.select({ resolveAt: starterEvents.resolveAt }).from(starterEvents)
    .where(and(eq(starterEvents.status, 'pending'), gt(starterEvents.resolveAt, after), lte(starterEvents.resolveAt, before)))
    .orderBy(asc(starterEvents.resolveAt)).limit(1);
  return row?.resolveAt ?? null;
}

export async function completeStarter(db: Queryable, id: string): Promise<void> {
  await db.update(starterEvents).set({ status: 'done', lastError: null, claimedAt: null }).where(eq(starterEvents.id, id));
}

/** Between attempts, so that five of them are not spent in one fast loop. */
const RETRY_AFTER_MS = 1_000;

/**
 * BACK TO PENDING, A LITTLE LATER, UNTIL THE ATTEMPTS RUN OUT. The wait is written on the row rather
 * than held by the loop: the loop also serves the main queue, which must not slow down for this.
 * Handlers read the truth from their own rows and never trust `resolve_at` as the moment of an event.
 */
export async function failStarter(db: Queryable, id: string, err: unknown, now: Date, maxAttempts = 5): Promise<{ exhausted: boolean }> {
  const rows = await db.update(starterEvents).set({
    status: sql`CASE WHEN ${starterEvents.attempts} >= ${maxAttempts} THEN 'failed'::event_status ELSE 'pending'::event_status END`,
    resolveAt: new Date(now.getTime() + RETRY_AFTER_MS),
    claimedAt: null,
    lastError: err instanceof Error ? err.message : String(err),
  }).where(eq(starterEvents.id, id)).returning({ status: starterEvents.status });
  return { exhausted: rows[0]?.status === 'failed' };
}

export async function reapStarter(db: Db, staleMinutes: number, now: Date): Promise<number> {
  const rows = await db.update(starterEvents).set({ status: 'pending', claimedAt: null })
    .where(and(eq(starterEvents.status, 'processing'), lt(starterEvents.claimedAt, new Date(now.getTime() - staleMinutes * 60_000))))
    .returning({ id: starterEvents.id });
  return rows.length;
}

export async function scheduleStarter(db: Queryable, input: {
  starterGalaxyId: string;
  kind: StarterEventRow['kind'];
  refId?: string;
  dedupeKey?: string;
  payload?: Record<string, unknown>;
  resolveAt: Date;
}): Promise<void> {
  const insert = db.insert(starterEvents).values({
    starterGalaxyId: input.starterGalaxyId,
    kind: input.kind,
    refId: input.refId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    payload: input.payload ?? null,
    resolveAt: input.resolveAt,
  });
  await (input.dedupeKey === undefined ? insert : insert.onConflictDoNothing({ target: starterEvents.dedupeKey }));
}

export async function failedStarterEventCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(starterEvents).where(eq(starterEvents.status, 'failed'));
  return row?.n ?? 0;
}

export async function oldestPendingStarterAge(db: Db, now: Date): Promise<number | null> {
  const [row] = await db.select({ resolveAt: starterEvents.resolveAt }).from(starterEvents)
    .where(and(eq(starterEvents.status, 'pending'), lte(starterEvents.resolveAt, now)))
    .orderBy(asc(starterEvents.resolveAt)).limit(1);
  return row ? (now.getTime() - row.resolveAt.getTime()) / 1000 : null;
}
