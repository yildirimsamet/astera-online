import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyDose,
  interpolatePosition,
  lethalAtMs,
  missionSegments,
  segmentExposure,
  segmentsDoseBp,
  segmentsUntil,
  sphereInterval,
  wingLethalAtMs,
  type RadiationSource,
  type Segment,
  type Vec3,
} from '../src/index.js';

/**
 * RADIATION, EXACTLY. Owner decision K3, 2026-09-29 (`plan.md` F8).
 *
 * A cloud takes a share of every ship's full hull per minute spent inside it. There is
 * no tick: a flight is straight segments at constant speed, the time each one spends in
 * each sphere is solved in closed form, and a SHELTER cancels every cloud for the time
 * it covers. The server settles with these functions, the client forecasts with them,
 * and nothing else computes a dose.
 */

const MIN = 60_000;
const at = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const emit = (over: Partial<RadiationSource> = {}): RadiationSource => ({
  id: 'e', mode: 'EMIT', center: at(0), radius: 10, intensityPctPerMinute: 1,
  activeFromMs: 0, activeUntilMs: null, ...over,
});
const shelter = (over: Partial<RadiationSource> = {}): RadiationSource => ({
  id: 's', mode: 'SHELTER', center: at(0), radius: 5, intensityPctPerMinute: 0,
  activeFromMs: 0, activeUntilMs: null, ...over,
});
const seg = (from: Vec3, to: Vec3, startMs: number, endMs: number): Segment => ({ from, to, startMs, endMs });

describe('the time a straight flight spends inside a sphere', () => {
  it('is the chord over the speed', () => {
    // Along the x axis through the centre: inside from x=-10 to x=10, 20 of 40 units.
    expect(sphereInterval(seg(at(-20), at(20), 0, 40 * MIN), at(0), 10)).toEqual([10 * MIN, 30 * MIN]);
  });

  it('is nothing for a flight that only grazes it', () => {
    expect(sphereInterval(seg(at(-20, 10), at(20, 10), 0, 40 * MIN), at(0), 10)).toBeNull();
    expect(sphereInterval(seg(at(-20, 11), at(20, 11), 0, 40 * MIN), at(0), 10)).toBeNull();
  });

  it('counts from the start for a flight that begins inside', () => {
    expect(sphereInterval(seg(at(0), at(40), 0, 40 * MIN), at(0), 10)).toEqual([0, 10 * MIN]);
  });

  it('is the whole segment for ships holding still inside, and nothing outside', () => {
    expect(sphereInterval(seg(at(3), at(3), 5 * MIN, 65 * MIN), at(0), 10)).toEqual([5 * MIN, 65 * MIN]);
    expect(sphereInterval(seg(at(30), at(30), 5 * MIN, 65 * MIN), at(0), 10)).toBeNull();
  });

  it('is nothing for a segment that takes no time', () => {
    expect(sphereInterval(seg(at(0), at(0), 5 * MIN, 5 * MIN), at(0), 10)).toBeNull();
  });
});

describe('the dose a flight takes', () => {
  it('is intensity × minutes inside, in basis points of the full hull', () => {
    // 20 minutes inside at 1%/min = 20% = 2000 bp.
    expect(segmentsDoseBp([seg(at(-20), at(20), 0, 40 * MIN)], [emit()])).toBe(2000);
    expect(segmentsDoseBp([seg(at(-20), at(20), 0, 40 * MIN)], [emit({ intensityPctPerMinute: 2.5 })])).toBe(5000);
  });

  it('holds still for the whole of its window', () => {
    expect(segmentsDoseBp([seg(at(1), at(1), 0, 60 * MIN)], [emit({ intensityPctPerMinute: 0.5 })])).toBe(3000);
  });

  it('adds clouds that overlap', () => {
    const path = [seg(at(-20), at(20), 0, 40 * MIN)];
    expect(segmentsDoseBp(path, [emit(), emit({ id: 'e2', intensityPctPerMinute: 3 })])).toBe(8000);
  });

  it('counts a cloud only while it is live', () => {
    const still = [seg(at(0), at(0), 0, 60 * MIN)];
    expect(segmentsDoseBp(still, [emit({ activeFromMs: 20 * MIN, activeUntilMs: 50 * MIN })])).toBe(3000);
    expect(segmentsDoseBp(still, [emit({ activeUntilMs: 0 })])).toBe(0);
    expect(segmentsDoseBp(still, [emit({ activeFromMs: 60 * MIN })])).toBe(0);
  });

  it('takes nothing under a shelter, and the shelter only while it stands', () => {
    const through = [seg(at(-20), at(20), 0, 40 * MIN)];
    // The shelter covers x in (-5, 5): 10 of the 20 minutes inside the cloud.
    expect(segmentsDoseBp(through, [emit(), shelter()])).toBe(1000);
    expect(segmentsDoseBp(through, [emit(), shelter({ radius: 50 })])).toBe(0);
    // A shelter covers every cloud at once, not one of them.
    expect(segmentsDoseBp(through, [emit(), emit({ id: 'e2' }), shelter()])).toBe(2000);
    expect(segmentsDoseBp(through, [emit(), shelter({ radius: 50, activeUntilMs: 20 * MIN })])).toBe(1000);
  });

  it('ignores a cloud of zero intensity and a shelter\'s own intensity', () => {
    const through = [seg(at(-20), at(20), 0, 40 * MIN)];
    expect(segmentsDoseBp(through, [emit({ intensityPctPerMinute: 0 })])).toBe(0);
    expect(segmentsDoseBp(through, [shelter({ intensityPctPerMinute: 9 })])).toBe(0);
  });

  it('refuses a source or a segment that cannot exist', () => {
    const path = [seg(at(0), at(1), 0, MIN)];
    for (const bad of [emit({ radius: 0 }), emit({ radius: -1 }), emit({ intensityPctPerMinute: -1 }),
      emit({ intensityPctPerMinute: Number.NaN }), emit({ radius: Number.POSITIVE_INFINITY })]) {
      expect(() => segmentsDoseBp(path, [bad])).toThrow(RangeError);
    }
    expect(() => segmentsDoseBp([seg(at(0), at(1), MIN, 0)], [emit()])).toThrow(RangeError);
    expect(() => segmentsDoseBp([seg(at(Number.NaN), at(1), 0, MIN)], [emit()])).toThrow(RangeError);
  });
});

/* ── properties ─────────────────────────────────────────────── */

const coord = fc.double({ min: -60, max: 60, noNaN: true });
const point = fc.record({ x: coord, y: coord, z: coord });
const alwaysOn = fc.record({
  center: point,
  radius: fc.double({ min: 1, max: 40, noNaN: true }),
  intensityPctPerMinute: fc.double({ min: 0, max: 5, noNaN: true }),
  mode: fc.constantFrom('EMIT' as const, 'EMIT' as const, 'SHELTER' as const),
}).map((s): RadiationSource => ({ id: 'r', activeFromMs: 0, activeUntilMs: null, ...s }));
const sources = fc.array(alwaysOn, { minLength: 1, maxLength: 4 });
const flight = fc.record({
  from: point, to: point,
  startMs: fc.integer({ min: 0, max: 600 * MIN }),
  minutes: fc.integer({ min: 1, max: 600 }),
}).map(({ from, to, startMs, minutes }) => seg(from, to, startMs, startMs + minutes * MIN));

const raw = (segments: readonly Segment[], s: readonly RadiationSource[]) =>
  segments.reduce((sum, one) => sum + segmentExposure(one, s), 0);

describe('the dose, as properties', () => {
  it('is the same for a segment cut in two anywhere', () => {
    fc.assert(fc.property(flight, sources, fc.double({ min: 0, max: 1, noNaN: true }), (whole, s, cut) => {
      const midMs = whole.startMs + (whole.endMs - whole.startMs) * cut;
      const mid = interpolatePosition(whole.from, whole.to, whole.startMs, whole.endMs, midMs);
      const halves = [seg(whole.from, mid, whole.startMs, midMs), seg(mid, whole.to, midMs, whole.endMs)];
      expect(raw(halves, s)).toBeCloseTo(raw([whole], s), 5);
    }));
  });

  it('is the same flown either way, when the clouds do not change', () => {
    fc.assert(fc.property(flight, sources, (there, s) => {
      const back = seg(there.to, there.from, there.startMs, there.endMs);
      expect(raw([back], s)).toBeCloseTo(raw([there], s), 5);
    }));
  });

  it('grows with the time spent: the same path ten times slower takes ten times the dose', () => {
    fc.assert(fc.property(flight, sources, (fast, s) => {
      const slow = seg(fast.from, fast.to, fast.startMs, fast.startMs + (fast.endMs - fast.startMs) * 10);
      expect(raw([slow], s)).toBeCloseTo(raw([fast], s) * 10, 4);
    }));
  });

  it('is never negative, and never more than every cloud for the whole flight', () => {
    fc.assert(fc.property(flight, sources, (one, s) => {
      const minutes = (one.endMs - one.startMs) / MIN;
      const ceiling = s.filter((x) => x.mode === 'EMIT')
        .reduce((sum, x) => sum + x.intensityPctPerMinute * 100 * minutes, 0);
      const dose = raw([one], s);
      expect(dose).toBeGreaterThanOrEqual(0);
      expect(dose).toBeLessThanOrEqual(ceiling + 1e-6);
    }));
  });
});

/* ── a mission's path ───────────────────────────────────────── */

describe('a mission\'s path', () => {
  const origin = at(-50), target = at(50);

  it('is one straight segment when nothing turned it', () => {
    expect(missionSegments({ origin, target, departAtMs: 0, arriveAtMs: 100 * MIN })).toEqual([
      seg(origin, target, 0, 100 * MIN),
    ]);
  });

  it('is two when it was called back: out to the turn, and home again', () => {
    const recallFrom = interpolatePosition(origin, target, 0, 100 * MIN, 30 * MIN);
    const path = missionSegments({
      origin, target, departAtMs: 0, arriveAtMs: 60 * MIN, recalledAtMs: 30 * MIN, recallFrom,
    });
    expect(path).toEqual([seg(origin, recallFrom, 0, 30 * MIN), seg(recallFrom, origin, 30 * MIN, 60 * MIN)]);
  });

  it('doses a recall exactly as two flights would', () => {
    fc.assert(fc.property(sources, fc.double({ min: 0.05, max: 0.95, noNaN: true }), (s, share) => {
      const turnMs = 100 * MIN * share;
      const recallFrom = interpolatePosition(origin, target, 0, 100 * MIN, turnMs);
      const recalled = missionSegments({
        origin, target, departAtMs: 0, arriveAtMs: 2 * turnMs, recalledAtMs: turnMs, recallFrom,
      });
      const out = missionSegments({ origin, target: recallFrom, departAtMs: 0, arriveAtMs: turnMs });
      const home = missionSegments({ origin: recallFrom, target: origin, departAtMs: turnMs, arriveAtMs: 2 * turnMs });
      expect(raw(recalled, s)).toBeCloseTo(raw(out, s) + raw(home, s), 5);
    }));
  });

  it('can be cut at a moment, for a settlement made while it is still in the air', () => {
    const path = missionSegments({ origin, target, departAtMs: 0, arriveAtMs: 100 * MIN });
    expect(segmentsUntil(path, 25 * MIN)).toEqual([seg(origin, at(-25), 0, 25 * MIN)]);
    expect(segmentsUntil(path, 0)).toEqual([]);
    expect(segmentsUntil(path, 500 * MIN)).toEqual(path);
  });
});

/* ── the moment it kills ────────────────────────────────────── */

describe('the moment a cloud finishes a ship', () => {
  it('is when the dose reaches a full hull, from where the ship already stood', () => {
    // Holding still at 1%/min: a sound hull goes in 100 minutes, one at 60% in 40.
    const still = [seg(at(0), at(0), 0, 500 * MIN)];
    const sound = lethalAtMs(still, [emit()]);
    const worn = lethalAtMs(still, [emit()], 6000);
    expect(sound).not.toBeNull();
    expect(Math.abs(sound! - 100 * MIN)).toBeLessThan(MIN);
    expect(Math.abs(worn! - 40 * MIN)).toBeLessThan(MIN);
  });

  /*
    THE SAME LINE THE SETTLEMENT DRAWS. 1.1%/min for exactly a full hull's worth of time comes
    out as 9999.999999999998 bp in floating point; the settlement counts that as a full hull,
    so the moment must exist too, or the disc flies a wing to a landing the server never makes.
  */
  it('exists wherever the settled dose is a full hull, float noise included', () => {
    const end = 10_000 / (1.1 * 100) * MIN;
    const path = [seg(at(0), at(0), 0, end)];
    const cloud = [emit({ intensityPctPerMinute: 1.1 })];
    expect(segmentExposure(path[0]!, cloud)).toBeLessThan(10_000);
    expect(segmentsDoseBp(path, cloud)).toBe(10_000);
    expect(lethalAtMs(path, cloud)).not.toBeNull();
  });

  it('is never, when the flight cannot take enough', () => {
    expect(lethalAtMs([seg(at(-20), at(20), 0, 40 * MIN)], [emit()])).toBeNull();
    expect(lethalAtMs([seg(at(0), at(0), 0, 500 * MIN)], [emit(), shelter({ radius: 50 })])).toBeNull();
  });

  it('agrees with the settled dose: the path cut there kills, a minute sooner does not', () => {
    fc.assert(fc.property(
      fc.double({ min: 0.5, max: 5, noNaN: true }), fc.integer({ min: 0, max: 9000 }),
      (intensity, startBp) => {
        const path = [seg(at(-30), at(30), 0, 1000 * MIN)];
        const cloud = [emit({ radius: 40, intensityPctPerMinute: intensity })];
        const dies = lethalAtMs(path, cloud, startBp);
        if (dies === null) return;
        const kill = applyDose({ DART: 1 }, startBp > 0 ? [{ hull: 'DART', count: 1, damageBp: startBp }] : [],
          segmentsDoseBp(segmentsUntil(path, dies), cloud));
        expect(kill.destroyed.DART).toBe(1);
        if (dies - MIN > 0) {
          const alive = applyDose({ DART: 1 }, startBp > 0 ? [{ hull: 'DART', count: 1, damageBp: startBp }] : [],
            segmentsDoseBp(segmentsUntil(path, dies - MIN), cloud));
          expect(alive.destroyed.DART ?? 0).toBe(0);
        }
      },
    ));
  });
});

describe('the moment a cloud finishes a whole wing', () => {
  const path = [seg(at(-50), at(50), 0, 200 * MIN)];

  it('is when its soundest ship goes: a worn one going first leaves the rest flying', () => {
    const worn = [{ hull: 'DART' as const, count: 1, damageBp: 6000 }];
    const mixed = wingLethalAtMs(path, [emit({ radius: 1_000 })], { DART: 2 }, worn);
    expect(Math.abs(mixed! - 100 * MIN)).toBeLessThan(MIN);
    const allWorn = wingLethalAtMs(path, [emit({ radius: 1_000 })], { DART: 1 }, worn);
    expect(Math.abs(allWorn! - 40 * MIN)).toBeLessThan(MIN);
  });

  it('is never for a wing with no ships, or one that lands first', () => {
    expect(wingLethalAtMs(path, [emit({ radius: 1_000 })], {}, null)).toBeNull();
    expect(wingLethalAtMs([seg(at(-50), at(50), 0, 50 * MIN)], [emit({ radius: 1_000 })], { DART: 2 }, null)).toBeNull();
  });
});
