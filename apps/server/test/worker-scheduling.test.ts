import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import { FixedClock } from '../src/clock.js';
import { createDb } from '../src/db/client.js';
import { EventWorker } from '../src/worker/loop.js';
import { HANDLERS, type Handler } from '../src/worker/handlers.js';
import * as queue from '../src/worker/queue.js';
import * as repairs from '../src/worker/abandon.js';
import * as spawnGates from '../src/services/spawnGate.js';
import * as signals from '../src/services/unknownSignal.js';

// These tests isolate queue draining from per-commander admission fences.
// Global lifecycle events cannot be suspended by vacation and need no DB read.
// Vacation/claimed-event fencing is exercised against real DB in vacation.test.ts.
// All persistence boundaries are replaced below; this lazy pool never connects.
const pool = createDb('postgres://unused/worker_scheduling_test');
const log = pino({ level: 'silent' });
const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
let worker: EventWorker;
const originalLifecycleHandler = HANDLERS.galaxy_event_start;
const lifecycleHandler = vi.fn<Handler>();

const event = (id: string): queue.EventRow => ({
  id, seasonId: 'season', kind: 'galaxy_event_start', refId: null, payload: null,
  dedupeKey: null, resolveAt: clock.now(), status: 'processing', attempts: 1,
  claimedAt: clock.now(), lastError: null,
});

beforeEach(() => {
  // Trigger the recorded poll callback explicitly; no fake timers around async stop.
  vi.spyOn(globalThis, 'setInterval');
  clock.set(new Date('2026-01-01T00:00:00Z'));
  vi.spyOn(queue, 'reap').mockResolvedValue(0);
  vi.spyOn(queue, 'claimDue').mockResolvedValue([]);
  vi.spyOn(queue, 'nextDueAt').mockResolvedValue(null);
  vi.spyOn(queue, 'complete').mockResolvedValue(undefined);
  vi.spyOn(queue, 'fail').mockResolvedValue({ exhausted: false });
  vi.spyOn(repairs, 'sweepStranded').mockResolvedValue(0);
  vi.spyOn(spawnGates, 'advanceSpawnGates').mockResolvedValue(0);
  vi.spyOn(signals, 'repairUnknownSignals').mockResolvedValue(undefined);
  lifecycleHandler.mockReset().mockResolvedValue(undefined);
  HANDLERS.galaxy_event_start = lifecycleHandler;
  worker = new EventWorker(pool.db, clock, { pollMs: 60_000, batch: 2, staleMinutes: 5 }, log);
});

afterEach(async () => {
  await worker.stop();
  HANDLERS.galaxy_event_start = originalLifecycleHandler;
  vi.restoreAllMocks();
});
afterAll(async () => { await pool.close(); });

it('drains a multi-batch backlog in order without waiting for the next poll', async () => {
  vi.mocked(queue.claimDue).mockResolvedValueOnce([event('first'), event('second')])
    .mockResolvedValueOnce([event('third')]);
  worker.start();
  await vi.waitFor(() => { expect(worker.status().processed).toBe(3); }, { timeout: 500 });
  expect(vi.mocked(queue.complete).mock.calls.map(([, id]) => id)).toEqual(['first', 'second', 'third']);
  expect(queue.claimDue).toHaveBeenCalledTimes(2);
});

it('checks once after an exactly full batch and sleeps when that check is empty', async () => {
  vi.mocked(queue.claimDue).mockResolvedValueOnce([event('first'), event('second')]);
  worker.start();
  await vi.waitFor(() => { expect(worker.status().ticks).toBe(2); }, { timeout: 500 });
  expect(queue.claimDue).toHaveBeenCalledTimes(2);
});

// The retry pace (one second, D28) outlasts a poll, so a poll inside it claims nothing.
const pollAfterRetryPace = async (): Promise<void> => {
  vi.mocked(setInterval).mock.calls[0]![0]();
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
  await new Promise(resolve => setTimeout(resolve, 1_050));
  vi.mocked(setInterval).mock.calls[0]![0]();
  await vi.waitFor(() => { expect(queue.claimDue).toHaveBeenCalledTimes(2); });
};

it('waits for the retry pace after a handler fails instead of burning retries', async () => {
  vi.mocked(queue.claimDue).mockResolvedValue([event('first'), event('second')]);
  lifecycleHandler.mockRejectedValue(new Error('temporary failure'));
  worker.start();
  await vi.waitFor(() => { expect(worker.status().ticks).toBe(1); });
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
  await pollAfterRetryPace();
});

it('waits for the retry pace after a claim fails', async () => {
  vi.mocked(queue.claimDue).mockRejectedValueOnce(new Error('database unavailable'));
  worker.start();
  await vi.waitFor(() => { expect(worker.status().tickErrors).toBe(1); });
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
  await pollAfterRetryPace();
});

it('finishes the current batch on stop without starting another or overlapping a timer tick', async () => {
  let release = () => { /* assigned synchronously */ };
  const held = new Promise<void>(resolve => { release = resolve; });
  lifecycleHandler.mockImplementationOnce(() => held);
  vi.mocked(queue.claimDue).mockResolvedValue([event('first'), event('second')]);
  worker.start();
  try {
    await vi.waitFor(() => { expect(lifecycleHandler).toHaveBeenCalledTimes(1); });
    vi.mocked(setInterval).mock.calls[0]![0]();
    expect(queue.claimDue).toHaveBeenCalledTimes(1);
  } finally {
    const stopping = worker.stop();
    release();
    await stopping;
  }
  expect(queue.complete).toHaveBeenCalledTimes(2);
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
});

it('claims against a fresh clock after maintenance advances time', async () => {
  vi.mocked(queue.reap).mockImplementationOnce(() => { clock.advance(1); return Promise.resolve(0); });
  vi.mocked(repairs.sweepStranded).mockImplementationOnce(() => { clock.advance(1); return Promise.resolve(0); });
  await worker.tick();
  // Compare only the cutoff: formatting a full Drizzle client on failure is huge.
  expect(vi.mocked(queue.claimDue).mock.calls[0]?.[2]).toEqual(clock.now());
});
