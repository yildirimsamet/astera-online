import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { HULLS, MOBILE_HULLS, hullWorkMinutes, shipHpRepairCost, shipHpRepairMinutes, shipRepairCost, splitForHpLanding, type HpDamageLot } from '../src/index.js';

describe('precise HP landing and Repair Station', () => {
  it('patches exact twenty percent, but docks every positive fraction above it', () => {
    const fractions = [0, Number.MIN_VALUE, 0.125, 1 - Number.EPSILON];
    for (const remainderBp of fractions) {
      const lot = { hull: 'DART' as const, count: 1, damageBp: 2000, remainderBp };
      const result = splitForHpLanding({ DART: 1 }, [lot]);
      expect(result.docked).toEqual(remainderBp > 0 ? [lot] : []);
      expect(result.home).toEqual(remainderBp > 0 ? {} : { DART: 1 });
    }
  });

  it('keeps implicit healthy ships and patches a fractional wound below twenty percent', () => {
    const lot = { hull: 'COURIER' as const, count: 2, damageBp: 0, remainderBp: 0.5 };
    const result = splitForHpLanding({ COURIER: 5, DART: 1 }, [lot]);
    expect(result.home).toEqual({ DART: 1, COURIER: 5 });
    expect(result.autoRepaired).toEqual([lot]);
    expect(result.docked).toEqual([]);
  });

  it('does not merge ships carrying different health fractions', () => {
    const lots: HpDamageLot[] = [
      { hull: 'DART', count: 1, damageBp: 3000, remainderBp: 0.25 },
      { hull: 'DART', count: 1, damageBp: 3000, remainderBp: 0.75 },
    ];
    const result = splitForHpLanding({ DART: 2 }, lots);
    expect(result.docked).toEqual([...lots].reverse());
  });

  it('can judge ground defenders after a planet battle without making them flying radiation targets', () => {
    const lot = { hull: 'BASTION' as const, count: 1, damageBp: 2000, remainderBp: 0.1 };
    expect(splitForHpLanding({ BASTION: 2 }, [lot])).toMatchObject({ home: { BASTION: 1 }, docked: [lot] });
  });

  it('charges the fraction even when floating addition would swallow it at an integer price', () => {
    const half = { hull: 'COURIER' as const, count: 1, damageBp: 5000, remainderBp: Number.MIN_VALUE };
    expect(HULLS.COURIER.alloy % 2).toBe(0);
    expect(shipHpRepairCost([half], 100)).toEqual({
      alloy: HULLS.COURIER.alloy / 2 + 1,
      crystal: HULLS.COURIER.crystal / 2 + 1,
      deuterium: 0,
    });
  });

  it('preserves legacy invoices when the fraction is absent or zero', () => {
    for (const hull of MOBILE_HULLS) {
      const lots = [{ hull, count: 3, damageBp: 2345 }];
      for (const pct of [50, 75, 100]) expect(shipHpRepairCost(lots, pct)).toEqual(shipRepairCost(lots, pct));
    }
  });

  it('uses the whole carried wound for repair duration and Industrial’s price share', () => {
    const lot = { hull: 'DART' as const, count: 3, damageBp: 2345, remainderBp: 0.625 };
    const tech = { YARD_AUTOMATION: 2 };
    const expected = hullWorkMinutes(lot.hull, lot.count, 4, tech) * (2345.625 / 10_000) * 0.5;
    expect(shipHpRepairMinutes([lot], 4, tech, 50)).toBeCloseTo(expected, 12);
  });

  it('rejects malformed health, excessive damaged counts and unsafe population', () => {
    const lot = { hull: 'DART' as const, count: 1, damageBp: 2345, remainderBp: 0.625 };
    for (const remainderBp of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => splitForHpLanding({ DART: 1 }, [{ ...lot, remainderBp }])).toThrow(RangeError);
      expect(() => shipHpRepairCost([{ ...lot, remainderBp }], 100)).toThrow(RangeError);
    }
    expect(() => splitForHpLanding({ DART: 1 }, [{ ...lot, count: 2 }])).toThrow(RangeError);
    expect(() => splitForHpLanding({ DART: -1 }, [])).toThrow(RangeError);
    expect(() => splitForHpLanding({ DART: Number.MAX_SAFE_INTEGER + 1 }, [])).toThrow(RangeError);
  });

  it('conserves every landing population for arbitrary cohorts', () => {
    fc.assert(fc.property(fc.constantFrom(...MOBILE_HULLS), fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 9999 }), fc.double({ min: 0, max: 0.999999, noNaN: true }), (hull, count, damageBp, remainderBp) => {
      const result = splitForHpLanding({ [hull]: count + 2 }, [{ hull, count, damageBp, remainderBp }]);
      expect((result.home[hull] ?? 0) + result.docked.reduce((n, lot) => n + lot.count, 0)).toBe(count + 2);
      expect(result.docked.reduce((n, lot) => n + lot.count, 0)).toBe(damageBp > 2000 || (damageBp === 2000 && remainderBp > 0) ? count : 0);
    }), { seed: 20261003, numRuns: 150 });
  });
});
