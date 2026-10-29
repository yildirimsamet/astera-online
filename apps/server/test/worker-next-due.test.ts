import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '../src/clock.js';
import { scheduledEvents } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { HANDLERS, type Handler } from '../src/worker/handlers.js';
import { nextDueAt, schedule } from '../src/worker/queue.js';
import * as repairs from '../src/worker/abandon.js';
import * as spawnGates from '../src/services/spawnGate.js';
import * as signals from '../src/services/unknownSignal.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * THE NEXT MOMENT THE WORLD IS DUE, READ OFF `events_due_idx`. Scaling plan F1.3.
 */
afterAll(async () => { await (await testDb()).close(); });

let f: Fixture;
const at = (ms: number): Date => new Date(f.clock.now().getTime() + ms);

beforeEach(async () => {
  f = await seedWorld(1);
  // Only this file's rows: the fixture's own lifecycle events are not under test.
  await f.db.update(scheduledEvents).set({ status: 'done' });
});

const add = (id: string, resolveAt: Date, status: 'pending' | 'processing' | 'done' | 'failed' = 'pending') =>
  f.db.insert(scheduledEvents).values({
    id, seasonId: f.seasonId, kind: 'galaxy_event_start', refId: f.planetIds[0]!, resolveAt, status,
  });

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

it('returns the earliest pending moment after the claim and within the window', async () => {
  await add(uuid(1), at(900));
  await add(uuid(2), at(300));
  await add(uuid(3), at(600));
  expect(await nextDueAt(f.db, at(0), at(1_000))).toEqual(at(300));
});

it('ignores what the claim already passed, what is not pending, and what is past the window', async () => {
  // At or before the cutoff: locked by another worker or just failed back to pending.
  // A wake for it would fire at once and spin; the poll and the retry pace own it.
  await add(uuid(1), at(0));
  await add(uuid(2), at(-50));
  await add(uuid(3), at(100), 'processing');
  await add(uuid(4), at(200), 'done');
  await add(uuid(5), at(300), 'failed');
  await add(uuid(6), at(1_001));
  expect(await nextDueAt(f.db, at(0), at(1_000))).toBeNull();

  await add(uuid(7), at(1_000));
  expect(await nextDueAt(f.db, at(0), at(1_000))).toEqual(at(1_000));
});

it('reads the next moment off the due index, not a scan of the queue', async () => {
  const { db } = await testDb();
  const plan = await db.transaction(async tx => {
    await tx.execute(sql`set local enable_seqscan = off`);
    const rows = await tx.execute<{ 'QUERY PLAN': string }>(sql`explain select resolve_at from scheduled_events
      where status = 'pending' and resolve_at > now() and resolve_at <= now() + interval '1 second'
      order by resolve_at limit 1`);
    return rows.map(row => row['QUERY PLAN']).join('\n');
  });
  expect(plan).toMatch(/\bevents_due_idx\b/);
  expect(plan).not.toMatch(/Sort/);
});

describe('a live worker on a real queue', () => {
  const recorded = vi.fn<Handler>();
  const original = HANDLERS.galaxy_event_start;
  let worker: EventWorker | undefined;

  beforeEach(() => {
    vi.spyOn(repairs, 'sweepStranded').mockResolvedValue(0);
    vi.spyOn(spawnGates, 'advanceSpawnGates').mockResolvedValue(0);
    vi.spyOn(signals, 'repairUnknownSignals').mockResolvedValue(undefined);
    recorded.mockReset().mockResolvedValue(undefined);
    HANDLERS.galaxy_event_start = recorded;
  });

  afterEach(async () => {
    await worker?.stop();
    HANDLERS.galaxy_event_start = original;
    vi.restoreAllMocks();
  });

  it('resolves two arrivals at one world on their moment, oldest first, with a one-minute poll', async () => {
    // Game time that moves with real time, starting at the fixture's moment.
    const base = f.clock.now().getTime();
    const origin = performance.now();
    const clock: Clock = { now: () => new Date(base + (performance.now() - origin)) };
    // Inserted newest first, so the order cannot be an accident of insertion.
    await schedule(f.db, { seasonId: f.seasonId, kind: 'galaxy_event_start', refId: f.planetIds[0]!, resolveAt: new Date(base + 301) });
    await schedule(f.db, { seasonId: f.seasonId, kind: 'galaxy_event_start', refId: f.planetIds[0]!, resolveAt: new Date(base + 300) });
    const handled: { resolveAt: number; at: number }[] = [];
    recorded.mockImplementation((_ctx, event) => {
      handled.push({ resolveAt: event.resolveAt.getTime() - base, at: clock.now().getTime() - base });
      return Promise.resolve();
    });

    worker = new EventWorker(f.db, clock, { pollMs: 60_000, batch: 10, staleMinutes: 5 }, pino({ level: 'silent' }));
    worker.start();

    await vi.waitFor(() => { expect(handled).toHaveLength(2); }, { timeout: 3_000 });
    expect(handled.map(h => h.resolveAt)).toEqual([300, 301]);
    expect(handled[0]!.at).toBeGreaterThanOrEqual(300);
    expect(handled[1]!.at).toBeLessThan(1_000);
  });
});
