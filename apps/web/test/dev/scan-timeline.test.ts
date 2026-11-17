import { describe, expect, it } from 'vitest';
import { SCAN_ARRIVES, SCAN_LOCKS, scanFrame } from '../../src/dev/lab/scan.js';

describe('telescope scan reveal timeline (vfx lab)', () => {
  it('the wave reaches the world before the sweep starts', () => {
    expect(scanFrame(0).wave).toBeLessThan(scanFrame(SCAN_ARRIVES).wave);
    expect(scanFrame(SCAN_ARRIVES).wave).toBeCloseTo(1, 5);
    expect(scanFrame(SCAN_ARRIVES - 0.05).band).toBe(0);
  });

  it('the band sweeps the world once, top to bottom', () => {
    let last = Infinity;
    for (let t = SCAN_ARRIVES + 0.05; t < SCAN_LOCKS; t += 0.1) {
      const frame = scanFrame(t);
      expect(frame.band).toBeGreaterThan(0);
      expect(frame.sweep).toBeLessThan(last);
      last = frame.sweep;
    }
    expect(scanFrame(SCAN_LOCKS + 0.3).band).toBe(0);
  });

  it('the owner shows only once the sweep has passed, and stays', () => {
    expect(scanFrame(SCAN_LOCKS - 0.1).reveal).toBe(0);
    expect(scanFrame(SCAN_LOCKS + 0.5).reveal).toBeGreaterThan(0.9);
    expect(scanFrame(SCAN_LOCKS + 3).reveal).toBeGreaterThan(0.9);
  });

  it('the reticle closes in and snaps on the lock', () => {
    expect(scanFrame(SCAN_ARRIVES + 0.2).reticleSize).toBeGreaterThan(scanFrame(SCAN_LOCKS).reticleSize);
    expect(scanFrame(SCAN_LOCKS + 0.05).reticle).toBeGreaterThan(0.9);
  });

  it('bad clocks show nothing, never NaN', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const frame = scanFrame(t);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      expect(frame.band + frame.reveal + frame.reticle + frame.grid).toBe(0);
    }
  });
});
