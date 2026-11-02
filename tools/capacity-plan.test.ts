import { describe, expect, it } from 'vitest';
import { SERVERS } from '../packages/rules/src/index.js';
import { coldStartReads, eventReads, joinAll, failedReads, FULL_READS, galaxyOf, RUNNER_LIMITS, seatPlan, soonestArrival, workerVerdict } from './capacity-plan.js';

describe('the seat plan follows SERVERS', () => {
  it('fills the galaxies in order, one capacity each', () => {
    expect(SERVERS).toMatchObject({ count: 2, capacity: 1000 });
    expect(seatPlan(2000)).toEqual([1000, 1000]);
    expect(seatPlan(1000)).toEqual([1000, 0]);
    expect(seatPlan(1250)).toEqual([1000, 250]);
    expect(galaxyOf(999)).toBe(0);
    expect(galaxyOf(1000)).toBe(1);
  });

  it('lets a run hold every seat online, three streams per account at most', () => {
    expect(RUNNER_LIMITS).toEqual({ maxUsers: 2000, streamsPerAccount: 3 });
  });
});

describe('the arrival a client follows', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  it('is the soonest instant still ahead, as the web arms it', () => {
    expect(soonestArrival([
      { arriveAt: '2026-10-30T12:05:00Z' },
      { arriveAt: '2026-10-30T11:59:00Z' },
      { arriveAt: '2026-10-30T12:01:00Z' },
    ], now)).toBe(Date.parse('2026-10-30T12:01:00Z'));
  });
  it('is nothing when every thread has landed', () => {
    expect(soonestArrival([{ arriveAt: '2026-10-30T11:00:00Z' }], now)).toBeNull();
    expect(soonestArrival([], now)).toBeNull();
  });
});

/**
 * THE RUN SAYS WHICH FIX THE WORKER NEEDS (scaling plan F1.3, F1.7, F7).
 * Late waking is the poll's; waiting in line is the handlers'; a worker busy most of
 * a peak window needs lanes, because trimming handlers rarely buys that much back.
 */
describe('the worker verdict', () => {
  const frames = (busyPerSecondMs: readonly number[]) => busyPerSecondMs.reduce<{ atMs: number; busyMs: number }[]>(
    (all, busy, i) => [...all, { atMs: (i + 1) * 30_000, busyMs: (all.at(-1)?.busyMs ?? 0) + busy * 30 }],
    [{ atMs: 0, busyMs: 0 }]);
  const kinds = {
    build_complete: { events: 900, busyMs: 54_000, durationMs: { p95: 90 } },
    mission_arrival: { events: 300, busyMs: 36_000, durationMs: { p95: 210 } },
  };
  const base = { kinds, thresholdMs: 2_000 };

  it('passes a worker that is idle most of the time and on time', () => {
    const verdict = workerVerdict({ ...base, frames: frames([100, 200, 150]),
      lateness: { p99: 300 }, wake: { p99: 20 }, queue: { p99: 280 } });
    expect(verdict.verdict).toBe('OK');
    expect(verdict.peakUtilization).toBeCloseTo(0.2, 6);
    expect(verdict.meanUtilization).toBeCloseTo(0.15, 6);
  });

  it('names the handlers when events wait in line past the threshold', () => {
    const verdict = workerVerdict({ ...base, frames: frames([300, 600, 400]),
      lateness: { p99: 2_600 }, wake: { p99: 40 }, queue: { p99: 2_550 } });
    expect(verdict.verdict).toBe('F1.7');
    // Ranked by the share of the worker's time each kind took.
    expect(verdict.heaviestKinds.map(kind => kind.kind)).toEqual(['build_complete', 'mission_arrival']);
    expect(verdict.heaviestKinds[0]!.busyShare).toBeCloseTo(0.6, 6);
  });

  it('names the poll when the claim itself comes late', () => {
    const verdict = workerVerdict({ ...base, frames: frames([100, 100]),
      lateness: { p99: 2_400 }, wake: { p99: 2_300 }, queue: { p99: 100 } });
    expect(verdict.verdict).toBe('POLL');
  });

  it('calls for lanes when a peak window keeps the worker busy almost all the time', () => {
    const verdict = workerVerdict({ ...base, frames: frames([300, 900, 400]),
      lateness: { p99: 900 }, wake: { p99: 20 }, queue: { p99: 880 } });
    expect(verdict.verdict).toBe('F7');
    expect(verdict.peakUtilization).toBeCloseTo(0.9, 6);
  });

  it('ignores a worker restart instead of reading it as negative load', () => {
    const verdict = workerVerdict({ ...base,
      frames: [{ atMs: 0, busyMs: 9_000 }, { atMs: 30_000, busyMs: 12_000 }, { atMs: 60_000, busyMs: 500 }],
      lateness: { p99: 100 }, wake: { p99: 10 }, queue: { p99: 90 } });
    expect(verdict.peakUtilization).toBeCloseTo(0.1, 6);
  });
});

/**
 * A STREAM EVENT COSTS WHAT IT COSTS THE WEB. Scaling plan F0.1.
 *
 * The runner answered every event that was not `shard:` with the full resync, while the
 * web routes private, global and finished-work events to a read or two: a fleet's own
 * `private:memory` on every arrival was fourteen reads in the run and one on a phone.
 * The runner now asks the web's own tables, limited to the screens a session keeps open.
 */
describe('the reads a stream event provokes', () => {
  it('follows the web for narrow events', () => {
    expect(eventReads('private:memory')).toEqual({ paths: ['/api/galaxy'], heavy: false });
    expect(eventReads('private:sight')).toEqual({ paths: ['/api/intel'], heavy: false });
    expect(eventReads('build_complete')).toEqual({
      paths: ['/api/planets', '/api/session/pending', '/api/rewards', '/api/galaxy'], heavy: false });
    expect(eventReads('shard:launch')).toEqual({ paths: ['/api/galaxy/traffic'], heavy: false });
  });
  it('puts growth on the heavy lane', () => {
    expect(eventReads('shard:world')).toEqual({ paths: ['/api/galaxy', '/api/leaderboard'], heavy: true });
  });
  it('resyncs for what happened to you, and for a private kind the web does not know', () => {
    expect(eventReads('raided')).toEqual({ paths: FULL_READS, heavy: false });
    expect(eventReads('private:something-new')).toEqual({ paths: FULL_READS, heavy: false });
  });
  it('reads nothing for a screen a session does not keep open, or a kind nobody knows', () => {
    expect(eventReads('global:announcement')).toEqual({ paths: [], heavy: false });
    expect(eventReads('shard:something-new')).toEqual({ paths: [], heavy: false });
  });
});

describe('a cold-start read that failed', () => {
  it('names each failed read with its status and code, so a run that stops says why', () => {
    expect(failedReads(['/api/season', '/api/galaxy', '/api/planets', '/api/mining/field'], [
      { valid: true, response: { status: 200 }, body: {} },
      { valid: false, response: { status: 503 }, body: { error: 'RETRYABLE' } },
      { valid: false, response: { status: 200 }, body: { planets: 'no' } },
      { valid: false, response: null, body: null },
    ])).toBe('/api/galaxy 503 RETRYABLE; /api/planets 200 invalid payload; /api/mining/field no response');
  });
});

/**
 * ONE REFUSED READ WAS THE END OF A WHOLE RUN. Capacity fix plan, item 9.
 * A real client asks again after a pause, so the runner does: only what failed, a few times.
 */
describe('the opening reads', () => {
  const answering = (failures: Record<string, number>) => {
    const asked: string[] = [];
    const read = async (path: string) => {
      await Promise.resolve();
      asked.push(path);
      const left = failures[path] ?? 0;
      failures[path] = left - 1;
      return { path, valid: left <= 0 };
    };
    return { asked, read };
  };
  const pauses: number[] = [];
  const pause = async (ms: number) => { await Promise.resolve(); pauses.push(ms); };

  it('asks once when everything answers', async () => {
    const { asked, read } = answering({});
    const out = await coldStartReads(['/a', '/b'], read, pause);
    expect(asked).toEqual(['/a', '/b']);
    expect(out.map((each) => each.path)).toEqual(['/a', '/b']);
  });

  it('asks again only for what failed, and keeps the order', async () => {
    pauses.length = 0;
    const { asked, read } = answering({ '/b': 2 });
    const out = await coldStartReads(['/a', '/b', '/c'], read, pause, () => 1);
    expect(asked).toEqual(['/a', '/b', '/c', '/b', '/b']);
    expect(out.map((each) => [each.path, each.valid])).toEqual([['/a', true], ['/b', true], ['/c', true]]);
    expect(pauses).toEqual([1_000, 2_000]);
  });

  it('hands back the failure once its attempts are spent', async () => {
    const { asked, read } = answering({ '/b': 99 });
    const out = await coldStartReads(['/b'], read, pause);
    expect(asked).toHaveLength(5);
    expect(out[0]?.valid).toBe(false);
  });
});

describe('the commanders of a ramp joining', () => {
  it('keeps the ones who joined when one fails, and says who failed and why', async () => {
    const out = await joinAll(['a', 'b', 'c'], async (name) => {
      await Promise.resolve();
      if (name === 'b') throw new Error('login failed: 429 RATE_LIMITED');
    }, (name) => `join:${name}`);
    expect(out.joined).toEqual(['a', 'c']);
    expect(out.failures).toEqual([{ label: 'join:b', error: 'login failed: 429 RATE_LIMITED' }]);
  });

  it('keeps the original order whatever order they finish in', async () => {
    const out = await joinAll([30, 1, 10], async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }, String);
    expect(out.joined).toEqual([30, 1, 10]);
    expect(out.failures).toEqual([]);
  });

  it('hands the index to the join, for the ramp delay', async () => {
    const seen: number[] = [];
    await joinAll(['a', 'b'], async (_, index) => { await Promise.resolve(); seen.push(index); }, String);
    expect(seen).toEqual([0, 1]);
  });
});
