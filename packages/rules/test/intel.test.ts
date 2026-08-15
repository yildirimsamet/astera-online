import { describe, expect, it } from 'vitest';
import {
  clarityState,
  detectChance,
  fuzzBand,
  mulberry32,
  probeAccuracy,
  radarDetectsFleets,
  radarLeadMinutes,
  telescopeReading,
  telescopeSeed,
} from '../src/index.js';

describe('clarity gradient', () => {
  it('maps the five states', () => {
    expect(clarityState(3)).toBe('FULL');
    expect(clarityState(1)).toBe('CLEAR');
    expect(clarityState(0)).toBe('INTERMITTENT');
    expect(clarityState(-1)).toBe('DEGRADED');
    expect(clarityState(-4)).toBe('BLIND');
  });

  it('gives ETA only at FULL', () => {
    const full = telescopeReading(4, 1, 'AWAY', 0, 25, mulberry32(1));
    const clear = telescopeReading(2, 1, 'AWAY', 0, 25, mulberry32(1));
    expect(full.etaMinutes).toBe(25);
    expect(clear.etaMinutes).toBeNull();
  });

  it('BLIND never leaks the true status', () => {
    for (let i = 0; i < 50; i++) {
      const r = telescopeReading(0, 3, 'AWAY', 0, null, mulberry32(i));
      expect(r.status).toBe('UNKNOWN');
    }
  });

  it('INTERMITTENT is real but possibly stale — the interesting state', () => {
    const stales = Array.from({ length: 40 }, (_, i) =>
      telescopeReading(2, 2, 'HOME', 5, null, mulberry32(i)).staleMinutes,
    );
    expect(new Set(stales).size).toBeGreaterThan(1);
    expect(Math.min(...stales)).toBeGreaterThanOrEqual(0);
  });

  it('DEGRADED mostly reads UNKNOWN', () => {
    const readings = Array.from({ length: 300 }, (_, i) =>
      telescopeReading(1, 2, 'HOME', 0, null, mulberry32(i)),
    );
    const unknown = readings.filter((r) => r.status === 'UNKNOWN').length;
    expect(unknown / readings.length).toBeGreaterThan(0.55);
    expect(unknown / readings.length).toBeLessThan(0.85);
  });
});

describe('refresh-spam resistance', () => {
  /**
   * THE EASIEST WAY TO SHIP A BROKEN INFORMATION GAME: if the roll were fresh per
   * request, a player defeats the entire fog layer by pulling to refresh until
   * INTERMITTENT happens to yield a confirmation.
   */
  it('a reading is identical however many times you ask inside a window', () => {
    const read = (minute: number) =>
      telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', minute));
    const first = read(100);
    for (const m of [100, 101, 105, 109, 119]) {
      expect(read(m)).toEqual(first);
    }
  });

  it('but does change once the window rolls over', () => {
    const a = telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', 100));
    const later = Array.from({ length: 12 }, (_, i) =>
      telescopeReading(2, 2, 'HOME', 9, null, telescopeSeed('watch-77', 140 + i * 20)),
    );
    expect(later.some((r) => r.staleMinutes !== a.staleMinutes)).toBe(true);
  });

  it('different watches roll independently', () => {
    const a = telescopeSeed('watch-a', 100)();
    const b = telescopeSeed('watch-b', 100)();
    expect(a).not.toBe(b);
  });
});

describe('probes', () => {
  it('detection rises with radar and falls with stealth', () => {
    expect(detectChance(5, 0)).toBeGreaterThan(detectChance(1, 0));
    expect(detectChance(3, 5)).toBeLessThan(detectChance(3, 0));
  });

  it('never becomes certain in either direction', () => {
    expect(detectChance(99, 0)).toBeLessThan(1);
    expect(detectChance(0, 99)).toBeGreaterThan(0);
  });

  it('a cheap probe gives a range, an expensive one a number', () => {
    const cheap = fuzzBand(61_000, probeAccuracy(1, 3), mulberry32(7));
    const good = fuzzBand(61_000, probeAccuracy(6, 0), mulberry32(7));
    expect(cheap.high - cheap.low).toBeGreaterThan(good.high - good.low);
  });

  it('bands are ordered and non-negative', () => {
    for (let i = 0; i < 100; i++) {
      const b = fuzzBand(40_000, probeAccuracy(2, 2), mulberry32(i));
      expect(b.low).toBeLessThanOrEqual(b.mid);
      expect(b.mid).toBeLessThanOrEqual(b.high);
      expect(b.low).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('radar', () => {
  it('detects inbound fleets only from L3', () => {
    expect(radarDetectsFleets(2)).toBe(false);
    expect(radarDetectsFleets(3)).toBe(true);
  });

  it('higher radar buys a longer fuse', () => {
    expect(radarLeadMinutes(5)).toBeGreaterThan(radarLeadMinutes(3));
  });

  it('keeps the panic window tight even on a long flight', () => {
    expect(radarLeadMinutes(5)).toBeLessThan(20);
  });

  it('clamps out-of-range levels', () => {
    expect(radarLeadMinutes(99)).toBe(radarLeadMinutes(5));
    expect(radarLeadMinutes(-3)).toBe(0);
  });
});
