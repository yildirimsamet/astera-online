import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import { FixedClock, systemClock, type Clock } from '../src/clock.js';
import { createDb } from '../src/db/client.js';
import { EventWorker, type WorkerOptions } from '../src/worker/loop.js';
import { HANDLERS, type Handler } from '../src/worker/handlers.js';
import * as queue from '../src/worker/queue.js';
import * as repairs from '../src/worker/abandon.js';
import * as spawnGates from '../src/services/spawnGate.js';
import * as signals from '../src/services/unknownSignal.js';
import * as bots from '../src/services/bots/sweep.js';

/**
 * THE WORKER WAKES WHEN THE WORLD IS DUE, AND REPAIRS NEVER STAND IN FRONT OF IT.
 * Scaling plan F1.3 (M7, M8).
 *
 * A fixed one-second poll made every landing, raid and build visibly late by half a
 * second on average, and the repairs that ran before each claim made a slow sweep
 * everybody's delay. These run on real timers with every persistence boundary
 * replaced, so they measure the scheduling itself; the lazy pool never connects.
 */
const pool = createDb('postgres://unused/worker_wake_test');
const log = pino({ level: 'silent' });
const handler = vi.fn<Handler>();
const original = HANDLERS.galaxy_event_start;
let worker: EventWorker;
let handledAt: number[];
let stall: ReturnType<typeof held>;
let started = 0;

const event = (id: string, resolveAt: Date): queue.EventRow => ({
  id, seasonId: 'season', kind: 'galaxy_event_start', refId: 'world', payload: null,
  dedupeKey: null, resolveAt, status: 'processing', attempts: 1, claimedAt: resolveAt, lastError: null,
});

/** The maintenance interval, told apart from the poll by its period. */
const maintenanceTick = (pollMs: number): (() => void) =>
  vi.mocked(setInterval).mock.calls.find(([, ms]) => ms !== pollMs)![0];

/** A queue that hands each event out once, when the claim's cutoff reaches it. */
function queueOf(events: queue.EventRow[]): queue.EventRow[] {
  const pending = [...events];
  vi.mocked(queue.claimDue).mockImplementation((_db, batch, now) => {
    const due = pending.filter(e => e.resolveAt <= now)
      .sort((a, b) => a.resolveAt.getTime() - b.resolveAt.getTime()).slice(0, batch);
    for (const e of due) pending.splice(pending.indexOf(e), 1);
    return Promise.resolve(due);
  });
  vi.mocked(queue.nextDueAt).mockImplementation((_db, after, before) => Promise.resolve(
    pending.map(e => e.resolveAt).filter(at => at > after && at <= before)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null));
  return pending;
}

const make = (clock: Clock, opts: Partial<WorkerOptions> = {}): EventWorker =>
  new EventWorker(pool.db, clock, { pollMs: 60_000, batch: 10, staleMinutes: 5, ...opts }, log);

const held = () => {
  let release = (): void => undefined;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
};

const later = (ms: number): Date => new Date(Date.now() + ms);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => {
  vi.spyOn(globalThis, 'setInterval');
  vi.spyOn(queue, 'reap').mockResolvedValue(0);
  vi.spyOn(queue, 'claimDue').mockResolvedValue([]);
  vi.spyOn(queue, 'nextDueAt').mockResolvedValue(null);
  vi.spyOn(queue, 'complete').mockResolvedValue(undefined);
  vi.spyOn(queue, 'fail').mockResolvedValue({ exhausted: false });
  vi.spyOn(repairs, 'sweepStranded').mockResolvedValue(0);
  vi.spyOn(spawnGates, 'advanceSpawnGates').mockResolvedValue(0);
  vi.spyOn(signals, 'repairUnknownSignals').mockResolvedValue(undefined);
  handledAt = [];
  stall = held();
  started = Date.now();
  handler.mockReset().mockImplementation(() => { handledAt.push(Date.now()); return Promise.resolve(); });
  HANDLERS.galaxy_event_start = handler;
});

afterEach(async () => {
  await worker.stop();
  HANDLERS.galaxy_event_start = original;
  vi.restoreAllMocks();
});
afterAll(async () => { await pool.close(); });

it('resolves an event due in 300 ms at its moment, not at the next poll', async () => {
  const start = Date.now();
  queueOf([event('soon', new Date(start + 300))]);
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();

  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(1); }, { timeout: 2_000 });
  expect(handledAt[0]! - start).toBeGreaterThanOrEqual(300);
  expect(handledAt[0]! - start).toBeLessThan(700);
});

it('lands the follow-up a handler schedules on time too', async () => {
  const pending = queueOf([event('battle', later(0))]);
  handler.mockImplementation((_ctx, e) => {
    handledAt.push(Date.now());
    if (e.id === 'battle') pending.push(event('return', later(200)));
    return Promise.resolve();
  });
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();

  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(2); }, { timeout: 2_000 });
  expect(handledAt[1]! - handledAt[0]!).toBeGreaterThanOrEqual(200);
  expect(handledAt[1]! - handledAt[0]!).toBeLessThan(600);
});

it('asks only for the window between this claim and the next poll', async () => {
  queueOf([]);
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();

  await vi.waitFor(() => { expect(queue.nextDueAt).toHaveBeenCalledTimes(1); });
  const cutoff = vi.mocked(queue.claimDue).mock.calls[0]![2];
  // Compare only the bounds: formatting a full Drizzle client on failure is huge.
  const [, after, before] = vi.mocked(queue.nextDueAt).mock.calls[0]!;
  expect(after).toEqual(cutoff);
  expect(before).toEqual(new Date(cutoff.getTime() + 5_000));
});

it('leaves an event beyond the next poll to the poll', async () => {
  queueOf([event('distant', later(10_000))]);
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();

  await pause(400);
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
  expect(handler).not.toHaveBeenCalled();
});

it('claims what fell due during a slow batch straight after it, without waiting for a wake or a poll', async () => {
  const slow = held();
  queueOf([event('first', later(0)), event('second', later(100))]);
  handler.mockImplementationOnce(async () => { handledAt.push(Date.now()); await slow.promise; });
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();

  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(1); });
  await pause(400);
  const released = Date.now();
  slow.release();
  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(2); }, { timeout: 1_000 });
  expect(handledAt[1]! - released).toBeLessThan(300);
  expect(vi.mocked(handler).mock.calls.map(([, e]) => e.id)).toEqual(['first', 'second']);
});

it('does not spin when its wake finds the event not yet due by the worker\'s clock', async () => {
  // A clock that lags the timers (a test clock, or a timer firing a millisecond
  // early): the poll takes the event rather than a hot loop of wakes.
  const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
  queueOf([event('stuck', new Date(clock.now().getTime() + 5))]);
  worker = make(clock, { pollMs: 5_000 });
  worker.start();

  await pause(300);
  expect(vi.mocked(queue.claimDue).mock.calls.length).toBeLessThanOrEqual(3);
  expect(handler).not.toHaveBeenCalled();
});

it('stops waking once stopped', async () => {
  queueOf([event('soon', later(300))]);
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();
  await vi.waitFor(() => { expect(queue.nextDueAt).toHaveBeenCalledTimes(1); });

  await worker.stop();
  await pause(500);
  expect(queue.claimDue).toHaveBeenCalledTimes(1);
  expect(handler).not.toHaveBeenCalled();
});

it('keeps polling when the next-due lookup fails, without counting a failed tick', async () => {
  queueOf([event('soon', later(150))]);
  vi.mocked(queue.nextDueAt).mockRejectedValue(new Error('lookup unavailable'));
  worker = make(systemClock, { pollMs: 100 });
  worker.start();

  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(1); }, { timeout: 1_000 });
  expect(worker.status().tickErrors).toBe(0);
});

/**
 * THE RETRY BUDGET IS COUNTED IN ATTEMPTS, SO ITS PACE MUST NOT FOLLOW THE POLL.
 * Five attempts were sized at one a second (D28): a quarter-second poll, or a wake
 * for the next event, must not spend a transient failure's budget in a second.
 */
it('retries a failed event at the retry pace, however short the poll or near the next event', async () => {
  vi.mocked(queue.nextDueAt).mockImplementation(() => Promise.resolve(later(10)));
  handler.mockRejectedValue(new Error('temporary failure'));
  worker = make(systemClock, { pollMs: 50 });
  const claims: number[] = [];
  vi.mocked(queue.claimDue).mockImplementation(() => {
    claims.push(Date.now());
    return Promise.resolve([event('flaky', later(0))]);
  });
  worker.start();

  await vi.waitFor(() => { expect(claims.length).toBe(2); }, { timeout: 2_000 });
  expect(claims[1]! - claims[0]!).toBeGreaterThanOrEqual(950);
  expect(queue.nextDueAt).not.toHaveBeenCalled();
});

it('retries a failed claim at the retry pace, not four times a second', async () => {
  const claims: number[] = [];
  vi.mocked(queue.claimDue).mockImplementation(() => {
    claims.push(Date.now());
    return Promise.reject(new Error('database unavailable'));
  });
  worker = make(systemClock, { pollMs: 50 });
  worker.start();

  await vi.waitFor(() => { expect(claims.length).toBe(2); }, { timeout: 2_000 });
  expect(claims[1]! - claims[0]!).toBeGreaterThanOrEqual(950);
  expect(worker.status().tickErrors).toBe(2);
});

it.each<[string, () => void]>([
  ['the reaper', () => { vi.mocked(queue.reap).mockReturnValue(stall.promise.then(() => 0)); }],
  ['the stranded sweep', () => { vi.mocked(repairs.sweepStranded).mockReturnValue(stall.promise.then(() => 0)); }],
  ['the spawn gate', () => { vi.mocked(spawnGates.advanceSpawnGates).mockReturnValue(stall.promise.then(() => 0)); }],
  ['the signal repair', () => { vi.mocked(signals.repairUnknownSignals).mockReturnValue(stall.promise); }],
  ['the bot sweep', () => {
    vi.spyOn(bots, 'runBotSweep').mockReturnValue(stall.promise.then((): bots.BotSweepResult => ({ seated: 0, turns: 0, awake: 0 })));
  }],
])('a two-second pass of %s does not delay a due event', async (_name, hang) => {
  hang();
  queueOf([event('raid', later(100))]);
  worker = make(systemClock, { pollMs: 5_000, botsEnabled: true });
  worker.start();

  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(1); }, { timeout: 1_000 });
  expect(handledAt[0]! - started).toBeLessThan(600);
  stall.release();
});

it('runs maintenance at once on start, so a restart reaps a dead process\'s claims', async () => {
  worker = make(systemClock);
  worker.start();
  await vi.waitFor(() => { expect(queue.reap).toHaveBeenCalledTimes(1); }, { timeout: 200 });
});

it('never runs a maintenance pass alongside another', async () => {
  vi.mocked(queue.reap).mockReturnValueOnce(stall.promise.then(() => 0));
  worker = make(systemClock);
  worker.start();
  await vi.waitFor(() => { expect(queue.reap).toHaveBeenCalledTimes(1); });
  const maintain = maintenanceTick(60_000);

  maintain();
  maintain();
  await pause(20);
  expect(queue.reap).toHaveBeenCalledTimes(1);

  stall.release();
  await vi.waitFor(async () => {
    maintain();
    await pause(5);
    expect(queue.reap).toHaveBeenCalledTimes(2);
  });
});

it('a failed maintenance pass stops neither the queue nor the next pass', async () => {
  vi.mocked(queue.reap).mockRejectedValueOnce(new Error('reap failed'));
  queueOf([event('raid', later(0))]);
  worker = make(systemClock, { pollMs: 5_000 });
  worker.start();
  await vi.waitFor(() => { expect(handler).toHaveBeenCalledTimes(1); });
  const maintain = maintenanceTick(5_000);

  maintain();
  await vi.waitFor(() => { expect(queue.reap).toHaveBeenCalledTimes(2); });
  expect(worker.status().tickErrors).toBe(0);
});

/**
 * A HUNG REPAIR USED TO HANG THE WORKER, AND THAT WAS ITS ALARM. Apart from the
 * queue, a pass that never returns stops the reaper and every sweep in silence, so
 * the worker reports when a pass last finished and how many threw.
 */
it('reports when maintenance last finished and how many passes threw', async () => {
  expect(make(systemClock).status().maintenance).toEqual({ lastAt: null, errors: 0 });
  vi.mocked(queue.reap).mockRejectedValueOnce(new Error('reap failed')).mockReturnValueOnce(stall.promise.then(() => 0));
  worker = make(systemClock);
  worker.start();
  await vi.waitFor(() => { expect(worker.status().maintenance.errors).toBe(1); });
  expect(worker.status().maintenance.lastAt).toBeNull();

  maintenanceTick(60_000)();
  await vi.waitFor(() => { expect(queue.reap).toHaveBeenCalledTimes(2); });
  expect(worker.status().maintenance.lastAt).toBeNull();
  const before = Date.now();
  stall.release();
  await vi.waitFor(() => { expect(worker.status().maintenance.lastAt).not.toBeNull(); });
  expect(Date.parse(worker.status().maintenance.lastAt!)).toBeGreaterThanOrEqual(before);
});

it('waits on stop for a maintenance pass in flight rather than tearing it down', async () => {
  vi.mocked(queue.reap).mockReturnValueOnce(stall.promise.then(() => 0));
  worker = make(systemClock);
  worker.start();
  await vi.waitFor(() => { expect(queue.reap).toHaveBeenCalledTimes(1); });

  let stopped = false;
  const stopping = worker.stop().then(() => { stopped = true; });
  await pause(50);
  expect(stopped).toBe(false);
  stall.release();
  await stopping;
  expect(stopped).toBe(true);
});

it('a stepped tick still runs maintenance before it claims', async () => {
  const order: string[] = [];
  vi.mocked(queue.reap).mockImplementation(() => { order.push('reap'); return Promise.resolve(3); });
  vi.mocked(queue.claimDue).mockImplementation(() => { order.push('claim'); return Promise.resolve([]); });
  worker = make(systemClock);

  expect(await worker.tick()).toMatchObject({ reaped: 3, claimed: 0 });
  expect(order).toEqual(['reap', 'claim']);
});
