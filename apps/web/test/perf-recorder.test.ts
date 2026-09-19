import { describe, expect, it } from 'vitest';
import { PERF_MAX_SAMPLES, createPerfRecorder, type PerfContext } from '../src/lib/perfRecorder.js';

/**
 * THE OWNER'S PERFORMANCE RECORDER. Owner request, 2026-09-19: play on the phone
 * for a while and find out what drops the frame rate, what stutters and freezes,
 * the peaks and the averages. This is the arithmetic; the wiring feeds it.
 */

const ctx = (over: Partial<PerfContext> = {}): PerfContext => ({
  heapMb: 80,
  galaxy: true,
  hidden: false,
  ctx: { planets: 1230, flights: 2 },
  ...over,
});

const info = { calls: 120, triangles: 80_000, geometries: 60, textures: 40, programs: 25 };

describe('one second of samples', () => {
  it('counts frames, the worst display gap and the hitches in it', () => {
    const rec = createPerfRecorder(0);
    // A 60Hz display with one 120ms hitch and one 300ms freeze.
    let at = 0;
    for (let i = 0; i < 30; i += 1) {
      at += i === 10 ? 120 : i === 20 ? 300 : 16.7;
      rec.displayFrame(at);
    }
    for (let i = 0; i < 24; i += 1) rec.galaxyFrame(3, info);
    rec.flush(1000, ctx());
    const [s] = rec.samples();
    expect(s?.t).toBe(1);
    expect(s?.fps).toBe(24);
    expect(s?.jankMaxMs).toBe(300);
    expect(s?.jank50).toBe(2);
    expect(s?.jank250).toBe(1);
    expect(s?.renderMs).toBe(72);
    expect(s?.renderMaxMs).toBe(3);
    expect(s?.calls).toBe(120);
  });

  /**
   * A LATE CLOCK IS NOT A FAST GALAXY. The one-second timer fires late on a busy
   * phone; the first recording showed 97 fps on a 60Hz display because one
   * "second" held a second and a half of frames. The rate is per real second.
   */
  it('measures the rate over the time that actually passed', () => {
    const rec = createPerfRecorder(0);
    for (let i = 0; i < 90; i += 1) rec.galaxyFrame(3, info);
    rec.flush(1500, ctx());
    for (let i = 0; i < 15; i += 1) rec.galaxyFrame(3, info);
    rec.flush(2000, ctx());
    expect(rec.samples().map((s) => s.fps)).toEqual([60, 30]);
  });

  it('adds up the main thread’s long tasks and the network in that second', () => {
    const rec = createPerfRecorder(0);
    rec.longTask(80);
    rec.longTask(120);
    rec.resource(2.5);
    rec.resource(1.5);
    rec.flush(1000, ctx());
    const [s] = rec.samples();
    expect(s).toMatchObject({ longTasks: 2, longTaskMs: 200, requests: 2, kb: 4 });
  });

  it('starts every second from nothing', () => {
    const rec = createPerfRecorder(0);
    rec.galaxyFrame(9, { ...info, calls: 400 });
    rec.longTask(90);
    rec.flush(1000, ctx());
    rec.flush(2000, ctx());
    const second = rec.samples()[1];
    expect(second).toMatchObject({ fps: 0, calls: 0, longTasks: 0, renderMaxMs: 0, jankMaxMs: 0 });
  });

  it('keeps what was on the disc beside the numbers', () => {
    const rec = createPerfRecorder(0);
    rec.flush(1000, ctx({ ctx: { planets: 900, contacts: 44 }, hidden: true, heapMb: null }));
    expect(rec.samples()[0]).toMatchObject({ ctx: { planets: 900, contacts: 44 }, hidden: true, heapMb: null });
  });

  it('stops taking samples at two hours rather than growing without end', () => {
    const rec = createPerfRecorder(0);
    for (let i = 1; i <= PERF_MAX_SAMPLES + 50; i += 1) rec.flush(i * 1000, ctx());
    expect(rec.samples()).toHaveLength(PERF_MAX_SAMPLES);
    expect(rec.full()).toBe(true);
  });
});

describe('the summary', () => {
  const recorded = () => {
    const rec = createPerfRecorder(0);
    // Ten seconds: 30fps mostly, one bad second at 8fps with a 900ms freeze.
    for (let i = 1; i <= 10; i += 1) {
      const bad = i === 7;
      for (let f = 0; f < (bad ? 8 : 30); f += 1) rec.galaxyFrame(bad ? 20 : 4, { ...info, calls: bad ? 480 : 120 });
      // The display ticks every 20ms; the bad second loses 900ms of it in one stall.
      const base = (i - 1) * 1000;
      for (let at = base; at < base + 1000; at += 20) {
        if (bad && at > base + 40 && at < base + 940) continue;
        rec.displayFrame(at);
      }
      rec.flush(i * 1000, ctx({ heapMb: 80 + i, ctx: { planets: 1230, flights: bad ? 9 : 2 } }));
    }
    return rec;
  };

  it('gives the averages, the low end and the peaks', () => {
    const s = recorded().summary();
    expect(s.seconds).toBe(10);
    expect(s.fpsAvg).toBeCloseTo(27.8, 1);
    expect(s.fpsMin).toBe(8);
    expect(s.freezes).toBe(1);
    expect(s.jankMaxMs).toBe(900);
    expect(s.callsMax).toBe(480);
    expect(s.callsAvg).toBe(156);
    expect(s.renderMaxMs).toBe(20);
    expect(s.heapStartMb).toBe(81);
    expect(s.heapEndMb).toBe(90);
    expect(s.heapMaxMb).toBe(90);
  });

  it('names the worst moment and what was on the disc when it happened', () => {
    const s = recorded().summary();
    expect(s.worst1).toMatch(/^t=7s jank=900ms fps=8 calls=480/);
    expect(s.worst1).toContain('flights=9');
  });

  it('leaves the frame-rate figures out of seconds the galaxy was not showing', () => {
    const rec = createPerfRecorder(0);
    for (let f = 0; f < 30; f += 1) rec.galaxyFrame(4, info);
    rec.flush(1000, ctx());
    rec.flush(2000, ctx({ galaxy: false }));
    rec.flush(3000, ctx({ hidden: true }));
    expect(rec.summary().fpsAvg).toBe(30);
  });

  it('is empty-safe', () => {
    const s = createPerfRecorder(0).summary();
    expect(s.seconds).toBe(0);
    expect(s.fpsAvg).toBeNull();
  });
});
