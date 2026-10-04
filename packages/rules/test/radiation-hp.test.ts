import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HULLS,
  MOBILE_HULLS,
  applyDose,
  applyHpDose,
  firstHpLossAtMs,
  fleetCount,
  hpLethalAtMs,
  hpWingLethalAtMs,
  hullTech,
  interpolatePosition,
  segmentsExposureHp,
  segmentsUntil,
  type DamageLot,
  type Fleet,
  type HpDamageLot,
  type HpRadiationSource,
  type HullId,
  type Segment,
  type TechLevels,
  type Vec3,
} from '../src/index.js';

// These are test inputs, not approved Monument balance values.
const MIN = 60_000;
const at = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const seg = (from: Vec3, to: Vec3, startMs: number, endMs: number): Segment => ({ from, to, startMs, endMs });
const hold = (minutes: number): Segment[] => [seg(at(0), at(0), 0, minutes * MIN)];
const emit = (over: Partial<HpRadiationSource> = {}): HpRadiationSource => ({
  id: 'hp-cloud', mode: 'EMIT', center: at(0), radius: 10,
  intensityHpPerMinute: 3, activeFromMs: 0, activeUntilMs: null, ...over,
});
const shelter = (over: Partial<HpRadiationSource> = {}): HpRadiationSource =>
  emit({ id: 'shelter', mode: 'SHELTER', radius: 5, intensityHpPerMinute: 0, ...over });
const lot = (hull: HullId, count: number, damageBp: number, remainderBp = 0): HpDamageLot =>
  ({ hull, count, damageBp, remainderBp });
const maxHp = (hull: HullId, tech: TechLevels = {}): number => HULLS[hull].hp * hullTech(tech, hull).hp;
const preciseBp = (row: HpDamageLot): number => row.damageBp + (row.remainderBp ?? 0);
const properties = { seed: 20261003, numRuns: 150 };

describe('whole-wing HP fade time', () => {
  it('waits for the final surviving hull, accounting for carried damage and armor', () => {
    const sources = [emit({ intensityHpPerMinute: maxHp('CITADEL') })];
    expect(hpWingLethalAtMs(hold(5), sources, { DART: 1, CITADEL: 2 }, [], {})).toBe(60_000);
    expect(hpWingLethalAtMs(hold(5), sources, { CITADEL: 2 }, [lot('CITADEL', 1, 5000)], {})).toBe(60_000);
    expect(hpWingLethalAtMs(hold(5), sources, { CITADEL: 1 }, [lot('CITADEL', 1, 5000)], {})).toBe(30_000);
  });
  it('does not fade a wing when any hull survives the path or is immune', () => {
    expect(hpWingLethalAtMs(hold(1), [emit()], { CITADEL: 1 }, [], {})).toBeNull();
    expect(hpWingLethalAtMs(hold(5), [emit({ intensityHpPerMinute: 1_000_000 })], { DART: 1, PROSPECTOR: 1 }, [], {})).toBeNull();
    expect(hpWingLethalAtMs(hold(5), [emit()], {}, [], {})).toBeNull();
  });
});

describe('HP radiation exposure on a physical path', () => {
  it('counts only the chord inside the cloud and adds no tier or ship-count factor', () => {
    const path = [seg(at(-20), at(20), 0, 40 * MIN)];
    expect(segmentsExposureHp(path, [emit()])).toBe(60);
    expect(segmentsExposureHp(hold(10), [emit({ intensityHpPerMinute: 0.125 })])).toBe(1.25);
  });

  it('counts outbound, actual HOLD and return exposure together', () => {
    const path = [
      seg(at(-20), at(0), 0, 20 * MIN),
      seg(at(0), at(0), 20 * MIN, 30 * MIN),
      seg(at(0), at(-20), 30 * MIN, 50 * MIN),
    ];
    expect(segmentsExposureHp(path, [emit()])).toBe(90);
    expect(segmentsExposureHp(segmentsUntil(path, 25 * MIN), [emit()])).toBe(45);
  });

  it('adds overlapping emitters and a shelter cancels all of them only while active', () => {
    const path = [seg(at(-20), at(20), 0, 40 * MIN)];
    const clouds = [emit(), emit({ id: 'other', intensityHpPerMinute: 2 })];
    // Exposure deliberately stays unrounded; rate addition has IEEE-754 noise.
    expect(segmentsExposureHp(path, clouds)).toBeCloseTo(100, 10);
    expect(segmentsExposureHp(path, [...clouds, shelter()])).toBeCloseTo(50, 10);
    expect(segmentsExposureHp(path, [...clouds, shelter({ radius: 50, activeUntilMs: 20 * MIN })])).toBeCloseTo(50, 10);
    expect(segmentsExposureHp(path, [shelter({ intensityHpPerMinute: 50 })])).toBe(0);
  });

  it('keeps historical source rates in their own windows', () => {
    const sources = [
      emit({ activeUntilMs: 10 * MIN, intensityHpPerMinute: 1 }),
      emit({ id: 'new-rate', activeFromMs: 10 * MIN, intensityHpPerMinute: 4 }),
    ];
    expect(segmentsExposureHp(hold(20), sources)).toBe(50);
    expect(segmentsExposureHp(segmentsUntil(hold(20), 5 * MIN), sources)).toBe(5);
    expect(segmentsExposureHp(hold(20), [emit({ activeFromMs: 10 * MIN, activeUntilMs: 5 * MIN })])).toBe(0);
  });

  it('takes no dose outside, on the sphere boundary, at a tangent or in zero time', () => {
    expect(segmentsExposureHp([seg(at(30), at(30), 0, MIN)], [emit()])).toBe(0);
    expect(segmentsExposureHp([seg(at(10), at(10), 0, MIN)], [emit()])).toBe(0);
    expect(segmentsExposureHp([seg(at(-20, 10), at(20, 10), 0, 40 * MIN)], [emit()])).toBe(0);
    expect(segmentsExposureHp(hold(0), [emit()])).toBe(0);
    expect(segmentsExposureHp([], [emit()])).toBe(0);
    expect(segmentsExposureHp(hold(10), [])).toBe(0);
    expect(segmentsExposureHp(hold(10), [emit({ intensityHpPerMinute: 0 })])).toBe(0);
  });

  it('refuses malformed sources and routes rather than awarding negative or unbounded damage', () => {
    for (const bad of [
      emit({ radius: 0 }), emit({ radius: -1 }), emit({ radius: Number.POSITIVE_INFINITY }),
      emit({ center: at(Number.NaN) }), emit({ intensityHpPerMinute: -1 }),
      emit({ intensityHpPerMinute: Number.NaN }), emit({ intensityHpPerMinute: Number.POSITIVE_INFINITY }),
      emit({ activeFromMs: Number.NaN }), emit({ activeUntilMs: Number.POSITIVE_INFINITY }),
    ]) expect(() => segmentsExposureHp(hold(1), [bad])).toThrow(RangeError);
    expect(() => segmentsExposureHp([seg(at(0), at(0), MIN, 0)], [emit()])).toThrow(RangeError);
    expect(() => segmentsExposureHp([seg(at(Number.NaN), at(0), 0, MIN)], [emit()])).toThrow(RangeError);
    expect(() => segmentsExposureHp([seg(at(0), at(0), 0, Number.POSITIVE_INFINITY)], [])).toThrow(RangeError);
    expect(() => segmentsExposureHp([
      seg(at(0), at(0), 0, 2 * MIN), seg(at(0), at(0), MIN, 3 * MIN),
    ], [emit()])).toThrow(RangeError);
    expect(() => segmentsExposureHp([seg(at(0), at(0), 0, 2 * MIN)], [emit({
      intensityHpPerMinute: Number.MAX_VALUE,
    })])).toThrow(RangeError);
  });
});

describe('equal HP dose on each individual ship', () => {
  it('gives different hulls the same physical HP loss, with no protection from escorts', () => {
    const out = applyHpDose({ ATLAS: 3, ARGOSY: 1, CITADEL: 2 }, [], 54);
    expect(out.fleet).toEqual({ ATLAS: 3, ARGOSY: 1, CITADEL: 2 });
    expect(out.destroyed).toEqual({});
    for (const row of out.lots) {
      expect(maxHp(row.hull) * preciseBp(row) / 10_000).toBeCloseTo(54, 9);
    }
    expect(preciseBp(out.lots.find((row) => row.hull === 'ATLAS')!))
      .toBeGreaterThan(preciseBp(out.lots.find((row) => row.hull === 'CITADEL')!));
    expect(applyHpDose({ ATLAS: 1 }, [], 54).lots[0]?.damageBp)
      .toBe(out.lots.find((row) => row.hull === 'ATLAS')?.damageBp);
  });

  it('uses the same researched HP as combat and preserves already carried damage', () => {
    const tech: TechLevels = { SHIP_ARMOR: 4 };
    const old: DamageLot[] = [{ hull: 'ATLAS', count: 1, damageBp: 4000 }];
    const normal = applyHpDose({ ATLAS: 1 }, old, 54);
    const armored = applyHpDose({ ATLAS: 1 }, old, 54, tech);
    expect(preciseBp(normal.lots[0]!)).toBeCloseTo(5000, 9);
    expect(preciseBp(armored.lots[0]!) - 4000).toBeCloseTo(54 / maxHp('ATLAS', tech) * 10_000, 9);
    expect(preciseBp(armored.lots[0]!)).toBeGreaterThan(4000);
    expect(preciseBp(armored.lots[0]!)).toBeLessThan(preciseBp(normal.lots[0]!));
  });

  it('destroys worn ships at their threshold while healthier ships of that hull remain', () => {
    const out = applyHpDose({ ATLAS: 3 }, [lot('ATLAS', 1, 9000), lot('ATLAS', 1, 4000)], 54);
    expect(out.fleet).toEqual({ ATLAS: 2 });
    expect(out.destroyed).toEqual({ ATLAS: 1 });
    expect(out.lots).toEqual([lot('ATLAS', 1, 5000), lot('ATLAS', 1, 1000)]);
    const before = applyHpDose({ ATLAS: 1 }, [lot('ATLAS', 1, 9000)], 54 - 0.001);
    expect(before.fleet.ATLAS).toBe(1);
  });

  it('kills different hulls at different HP limits and no casualty leaves a damage lot behind', () => {
    const out = applyHpDose({ DART: 2, ATLAS: 1, CITADEL: 1 }, [], maxHp('ATLAS'));
    expect(out.destroyed).toEqual({ DART: 2, ATLAS: 1 });
    expect(out.fleet).toEqual({ CITADEL: 1 });
    expect(out.lots.map((row) => row.hull)).toEqual(['CITADEL']);
  });

  it('exempts the real mining craft alone; cargo and the Collector still take radiation', () => {
    const old = [lot('PROSPECTOR', 2, 3000, 0.25)];
    const out = applyHpDose({ PROSPECTOR: 2, ATLAS: 1, GARBAGE_COLLECTOR: 1 }, old, 10_000);
    expect(out.fleet).toEqual({ PROSPECTOR: 2 });
    expect(out.lots).toEqual(old);
    expect(out.destroyed).toEqual({ ATLAS: 1, GARBAGE_COLLECTOR: 1 });
  });

  it('keeps sub-basis-point damage instead of treating a small dose as free repair', () => {
    const out = applyHpDose({ CITADEL: 1 }, [], maxHp('CITADEL') / 40_000);
    expect(out.lots).toMatchObject([{ hull: 'CITADEL', count: 1, damageBp: 0 }]);
    expect(out.lots[0]?.remainderBp).toBeCloseTo(0.25, 12);
    expect(applyHpDose(out.fleet, out.lots, 0)).toEqual({ ...out, destroyed: {} });
    const kill = applyHpDose({ ATLAS: 1 }, [lot('ATLAS', 1, 9999, 0.75)], maxHp('ATLAS') / 40_000);
    expect(kill.destroyed).toEqual({ ATLAS: 1 });
  });

  it('merges identical lots but keeps fractional damage states distinct', () => {
    const out = applyHpDose({ ATLAS: 4 }, [
      lot('ATLAS', 1, 5000, 0.25), lot('ATLAS', 2, 5000, 0.25), lot('ATLAS', 1, 5000, 0.75),
    ], 0);
    expect(out.lots).toEqual([lot('ATLAS', 1, 5000, 0.75), lot('ATLAS', 3, 5000, 0.25)]);
  });

  it('does not mutate the fleet or the lots and treats absent damage as healthy', () => {
    const fleet: Fleet = { ATLAS: 2, DART: 0, ARGOSY: undefined };
    const lots = [lot('ATLAS', 1, 5000, 0.5)];
    const snapshot = structuredClone({ fleet, lots });
    applyHpDose(fleet, lots, 10);
    expect({ fleet, lots }).toEqual(snapshot);
    expect(applyHpDose(fleet, null, 0)).toEqual({ fleet: { ATLAS: 2 }, lots: [], destroyed: {} });
    expect(applyHpDose({}, undefined, 10)).toEqual({ fleet: {}, lots: [], destroyed: {} });
  });

  it('refuses malformed counts, non-flying hulls, invalid doses and damage on absent ships', () => {
    for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => applyHpDose({ ATLAS: count }, [], 1)).toThrow(RangeError);
    }
    expect(() => applyHpDose({ BASTION: 1 }, [], 1)).toThrow(RangeError);
    for (const dose of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => applyHpDose({ ATLAS: 1 }, [], dose)).toThrow(RangeError);
    }
    for (const bad of [
      lot('ATLAS', -1, 1), lot('ATLAS', 0.5, 1), lot('ATLAS', 1, -1),
      lot('ATLAS', 1, 0.5), lot('ATLAS', 1, 10_000), lot('ATLAS', 1, Number.NaN),
      lot('ATLAS', 1, 1, -0.1), lot('ATLAS', 1, 1, 1), lot('ATLAS', 1, 1, Number.NaN),
      lot('ATLAS', 1, 1, Number.POSITIVE_INFINITY), lot('DART', 1, 1), lot('ATLAS', 2, 1),
    ]) expect(() => applyHpDose({ ATLAS: 1 }, [bad], 0)).toThrow(RangeError);
  });

  it('leaves the existing percentage-dose behavior intact', () => {
    const legacy = applyDose({ ATLAS: 1, CITADEL: 1 }, [], 1000);
    expect(legacy.lots.map((row) => row.damageBp)).toEqual([1000, 1000]);
    const nextSeason = applyHpDose({ ATLAS: 1, CITADEL: 1 }, [], 54);
    expect(nextSeason.lots.map((row) => preciseBp(row))).not.toEqual([1000, 1000]);
  });
});

describe('the first HP radiation casualty, rather than whole-fleet extinction', () => {
  it('uses remaining researched HP and the carried fractional damage', () => {
    const path = hold(1000);
    const rate = emit({ intensityHpPerMinute: 54 });
    expect(hpLethalAtMs(path, [rate], { hull: 'ATLAS' })).toBe(10 * MIN);
    expect(hpLethalAtMs(path, [rate], { hull: 'ATLAS', damageBp: 5000 })).toBe(5 * MIN);
    expect(hpLethalAtMs(path, [rate], { hull: 'ATLAS', damageBp: 9999, remainderBp: 0.5 })).toBe(30);
    const tech: TechLevels = { SHIP_ARMOR: 4 };
    expect(hpLethalAtMs(path, [rate], { hull: 'ATLAS', tech }))
      .toBe(Math.ceil(maxHp('ATLAS', tech) / 54 * MIN));
  });

  it('chooses a worn ship first, even when a healthy ship of the same hull remains', () => {
    const path = hold(1000);
    const clouds = [emit({ intensityHpPerMinute: 54 })];
    const fleet: Fleet = { ATLAS: 3, CITADEL: 1 };
    const damage = [lot('ATLAS', 1, 9000), lot('ATLAS', 1, 4000)];
    expect(firstHpLossAtMs(path, clouds, fleet, damage)).toBe(MIN);
    const first = applyHpDose(fleet, damage, segmentsExposureHp(segmentsUntil(path, MIN), clouds));
    expect(first.destroyed).toEqual({ ATLAS: 1 });
    const remainingPath = [seg(at(0), at(0), MIN, 1000 * MIN)];
    expect(firstHpLossAtMs(remainingPath, clouds, first.fleet, first.lots)).toBe(6 * MIN);
  });

  it('counts a future exposure window and shelter gaps without charging the unexposed time', () => {
    const clouds = [emit({ activeFromMs: 10 * MIN, intensityHpPerMinute: 54 }), shelter({ activeUntilMs: 15 * MIN })];
    expect(hpLethalAtMs(hold(100), clouds, { hull: 'ATLAS' })).toBe(25 * MIN);
    expect(hpLethalAtMs(hold(100), [emit({ intensityHpPerMinute: 54, activeUntilMs: 9 * MIN })], { hull: 'ATLAS' })).toBeNull();
  });

  it('never announces death at a zero-dose instant, even within the float-noise band', () => {
    const startMs = 1_800_000_000_000;
    const path = [seg(at(0), at(0), startMs, startMs + MIN)];
    const clouds = [emit({ intensityHpPerMinute: 54 })];
    const damage = [lot('ATLAS', 1, 9999, 1 - 1e-10)];
    expect(applyHpDose({ ATLAS: 1 }, damage, 0).fleet.ATLAS).toBe(1);
    const death = hpLethalAtMs(path, clouds, { hull: 'ATLAS', damageBp: 9999, remainderBp: 1 - 1e-10 });
    expect(death).toBe(startMs + 1);
    expect(applyHpDose({ ATLAS: 1 }, damage, segmentsExposureHp(segmentsUntil(path, death!), clouds)).destroyed.ATLAS).toBe(1);
    expect(applyHpDose({ ATLAS: 1 }, damage, segmentsExposureHp(segmentsUntil(path, death! - 1), clouds)).fleet.ATLAS).toBe(1);
  });

  it('is absent for no exposure, no ships, an immune craft or a path ending before death', () => {
    expect(hpLethalAtMs(hold(1), [emit()], { hull: 'ATLAS' })).toBeNull();
    expect(hpLethalAtMs(hold(1000), [emit()], { hull: 'PROSPECTOR' })).toBeNull();
    expect(hpLethalAtMs(hold(1000), [], { hull: 'DART' })).toBeNull();
    expect(firstHpLossAtMs(hold(1000), [emit()], {}, null)).toBeNull();
    expect(firstHpLossAtMs(hold(1000), [emit()], { PROSPECTOR: 2 }, null)).toBeNull();
  });

  it('rejects impossible starting damage and validates the whole route before finding a loss', () => {
    for (const damageBp of [-1, 0.5, 10_000, Number.NaN]) {
      expect(() => hpLethalAtMs(hold(1), [emit()], { hull: 'ATLAS', damageBp })).toThrow(RangeError);
    }
    expect(() => hpLethalAtMs(hold(1), [emit()], { hull: 'ATLAS', remainderBp: 1 })).toThrow(RangeError);
    expect(() => firstHpLossAtMs(hold(1), [emit()], { ATLAS: 1 }, [lot('ATLAS', 2, 5000)])).toThrow(RangeError);
    const reversedLater = [seg(at(0), at(0), 0, 1000 * MIN), seg(at(0), at(0), 1001 * MIN, 999 * MIN)];
    expect(() => hpLethalAtMs(reversedLater, [emit()], { hull: 'DART' })).toThrow(RangeError);
  });
});

describe('HP radiation conservation properties', () => {
  it('frequent settlement cannot erase small doses or create extra damage', () => {
    fc.assert(fc.property(
      fc.constantFrom(...MOBILE_HULLS), fc.integer({ min: 1, max: 30 }),
      fc.integer({ min: 0, max: 9000 }), fc.integer({ min: 1, max: 100 }),
      (hull, count, damageBp, steps) => {
        const initial = [lot(hull, count, damageBp, 0.25)];
        const totalHp = maxHp(hull) * 0.073;
        const once = applyHpDose({ [hull]: count }, initial, totalHp);
        let repeated = applyHpDose({ [hull]: count }, initial, 0);
        for (let i = 0; i < steps; i++) repeated = applyHpDose(repeated.fleet, repeated.lots, totalHp / steps);
        expect(repeated.fleet).toEqual(once.fleet);
        expect(preciseBp(repeated.lots[0]!)).toBeCloseTo(preciseBp(once.lots[0]!), 7);
      },
    ), properties);
  });

  it('settling a flight cut anywhere yields the same physical dose', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 999 }),
      fc.double({ min: 0.01, max: 10, noNaN: true }),
      (minutes, cutPermille, rate) => {
        const whole = seg(at(-20), at(20), 0, minutes * MIN);
        const cutMs = whole.endMs * cutPermille / 1000;
        const mid = interpolatePosition(whole.from, whole.to, whole.startMs, whole.endMs, cutMs);
        const halves = [seg(whole.from, mid, 0, cutMs), seg(mid, whole.to, cutMs, whole.endMs)];
        expect(segmentsExposureHp(halves, [emit({ intensityHpPerMinute: rate })]))
          .toBeCloseTo(segmentsExposureHp([whole], [emit({ intensityHpPerMinute: rate })]), 7);
      },
    ), properties);
  });

  it('splitting an identical cohort between fleets changes neither damage nor casualty counts', () => {
    fc.assert(fc.property(
      fc.constantFrom(...MOBILE_HULLS), fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 100_000 }),
      (hull, a, b, damageBp, doseHp) => {
        const whole = applyHpDose({ [hull]: a + b }, [lot(hull, a + b, damageBp, 0.5)], doseHp);
        const left = applyHpDose({ [hull]: a }, [lot(hull, a, damageBp, 0.5)], doseHp);
        const right = applyHpDose({ [hull]: b }, [lot(hull, b, damageBp, 0.5)], doseHp);
        expect(fleetCount(left.fleet) + fleetCount(right.fleet)).toBe(fleetCount(whole.fleet));
        expect(fleetCount(left.destroyed) + fleetCount(right.destroyed)).toBe(fleetCount(whole.destroyed));
        if (whole.lots.length > 0) {
          expect(preciseBp(left.lots[0]!)).toBe(preciseBp(whole.lots[0]!));
          expect(preciseBp(right.lots[0]!)).toBe(preciseBp(whole.lots[0]!));
        }
      },
    ), properties);
  });

  it('the scheduled whole millisecond kills, while the preceding millisecond leaves the ship alive', () => {
    fc.assert(fc.property(
      fc.constantFrom(...MOBILE_HULLS), fc.integer({ min: 0, max: 9500 }),
      fc.integer({ min: 0, max: 4 }), fc.double({ min: 0.1, max: 25, noNaN: true }),
      (hull, damageBp, armor, rate) => {
        const tech: TechLevels = { SHIP_ARMOR: armor };
        const path = hold(50_000);
        const clouds = [emit({ intensityHpPerMinute: rate })];
        const initial = [lot(hull, 1, damageBp, 0.25)];
        const death = hpLethalAtMs(path, clouds, { hull, damageBp, remainderBp: 0.25, tech });
        expect(death).not.toBeNull();
        const dead = applyHpDose({ [hull]: 1 }, initial, segmentsExposureHp(segmentsUntil(path, death!), clouds), tech);
        const alive = applyHpDose({ [hull]: 1 }, initial, segmentsExposureHp(segmentsUntil(path, death! - 1), clouds), tech);
        expect(fleetCount(dead.destroyed)).toBe(1);
        expect(fleetCount(alive.fleet)).toBe(1);
      },
    ), properties);
  });
});
