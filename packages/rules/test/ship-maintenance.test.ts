import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  HULLS, fleetCount, maintenanceLanding, partitionCombatFleet, selectHealthGroups,
  shipCanFight, shipScrapReturn, splitHealthFleet, applyMaintenanceDoseBp, type Fleet, type HpDamageLot,
} from '../src/index.js';

const wound = (count: number, damageBp: number, remainderBp = 0): HpDamageLot =>
  ({ hull: 'DART', count, damageBp, remainderBp });

describe('manual ship maintenance: health remains independent of location', () => {
  it('preserves exact wounds when an older percentage cloud adds integer basis points', () => {
    const result = applyMaintenanceDoseBp({ DART: 3 }, [wound(1, 0, Number.MIN_VALUE), wound(1, 9000, 0.25)], 100);
    expect(result.fleet).toEqual({ DART: 3 });
    expect(result.lots).toEqual([wound(1, 9100, 0.25), wound(1, 100, Number.MIN_VALUE), wound(1, 100, 0)]);
    expect(applyMaintenanceDoseBp({ DART: 1 }, [wound(1, 9999, 0.75)], 1).destroyed).toEqual({ DART: 1 });
    expect(applyMaintenanceDoseBp({ DART: 1 }, [wound(1, 0, Number.MIN_VALUE)], 0).lots)
      .toEqual([wound(1, 0, Number.MIN_VALUE)]);
    expect(() => applyMaintenanceDoseBp({ DART: 1 }, [], -1)).toThrow(RangeError);
  });
  it('lands every survivor at home with its exact wounds, without repairs or docking', () => {
    const damage = [wound(1, 1), wound(2, 2000), wound(1, 9999, 0.75), wound(1, 0, Number.MIN_VALUE)];
    const result = maintenanceLanding({ DART: 7 }, damage);
    expect(result.home).toEqual({ DART: 7 });
    expect(result.autoRepaired).toEqual([]);
    expect(result.docked).toEqual([]);
    expect(result.damage).toHaveLength(4);
    expect(result.damage).toContainEqual(wound(1, 0, Number.MIN_VALUE));
    expect(() => maintenanceLanding({ DART: 1 }, [wound(2, 1)])).toThrow(RangeError);
  });

  it('allows combat only strictly above 5% HP, without rounding the label', () => {
    expect(shipCanFight(wound(1, 9499, 1 - Number.EPSILON))).toBe(true);
    expect(shipCanFight(wound(1, 9500))).toBe(false);
    expect(shipCanFight(wound(1, 9500, Number.MIN_VALUE))).toBe(false);
    expect(shipCanFight(wound(1, 9999))).toBe(false);
  });

  it('partitions actual ships while leaving ground rules unchanged', () => {
    expect(partitionCombatFleet({ DART: 6, BASTION: 1 }, [wound(2, 9500), wound(1, 9499)])).toEqual({
      eligible: { DART: 4, BASTION: 1 }, damage: [wound(1, 9499)],
      excluded: { DART: 2 }, excludedDamage: [wound(2, 9500)],
    });
  });

  it('selects exact health and quantity without changing the unselected cohort', () => {
    const result = selectHealthGroups({ DART: 8 }, [wound(3, 100), wound(2, 5000, 0.125)],
      [wound(1, 100), wound(1, 5000, 0.125), wound(1, 0)]);
    expect(result.selected).toEqual({ DART: 3 });
    expect(result.selectedDamage).toEqual([wound(1, 5000, 0.125), wound(1, 100)]);
    expect(result.remaining).toEqual({ DART: 5 });
    expect(result.remainingDamage).toEqual([wound(1, 5000, 0.125), wound(2, 100)]);
  });

  it('rejects missing, changed, duplicate and excessive health selections', () => {
    const fleet = { DART: 3 };
    const damage = [wound(2, 5000, 0.5)];
    for (const selections of [[], [wound(1, 5000)], [wound(3, 5000, 0.5)], [wound(2, 0)],
      [wound(1, 5000, 0.5), wound(1, 5000, 0.5)], [wound(0, 5000, 0.5)], [wound(1.5, 5000, 0.5)]]) {
      expect(() => selectHealthGroups(fleet, damage, selections)).toThrow(RangeError);
    }
  });

  it('uses healthy then least damaged for ordinary launches and carries exact leftovers', () => {
    const result = splitHealthFleet({ DART: 8 }, [wound(3, 100), wound(2, 9700, 0.25)], { DART: 5 });
    expect(result.selectedDamage).toEqual([wound(2, 100)]);
    expect(result.remainingDamage).toEqual([wound(2, 9700, 0.25), wound(1, 100)]);
    expect(() => splitHealthFleet({ DART: 8 }, [wound(4, 9700)], { DART: 5 }, true)).toThrow(RangeError);
    expect(splitHealthFleet({ DART: 8 }, [wound(4, 9700)], { DART: 8 }).selectedDamage).toEqual([wound(4, 9700)]);
  });

  it('conserves count and each wound in arbitrary partial launches', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 30 }), fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 30 }),
      fc.integer({ min: 0, max: 60 }), (healthy, wounds, requested) => {
        const fleet: Fleet = { DART: healthy + wounds.length };
        const count = Math.min(requested, fleet.DART ?? 0);
        const result = splitHealthFleet(fleet, wounds.map((bp) => wound(1, bp)), { DART: count });
        expect(fleetCount(result.remaining) + fleetCount(result.selected)).toBe(fleetCount(fleet));
        for (const bp of new Set(wounds)) {
          const carried = [...result.remainingDamage, ...result.selectedDamage].filter((row) => row.damageBp === bp);
          expect(carried.reduce((sum, row) => sum + row.count, 0)).toBe(wounds.filter((value) => value === bp).length);
        }
      }));
  });
});

describe('scrap returns: half the exact surviving share of the production recipe', () => {
  it('includes every resource and healthy ships', () => {
    for (const bp of [0, 4000, 8000]) {
      const result = shipScrapReturn({ BALLISTA: 10 }, [{ hull: 'BALLISTA', count: 10, damageBp: bp }]);
      const share = (10_000 - bp) / 20_000;
      expect(result).toEqual({
        alloy: Math.floor(HULLS.BALLISTA.alloy * 10 * share),
        crystal: Math.floor(HULLS.BALLISTA.crystal * 10 * share),
        deuterium: Math.floor(HULLS.BALLISTA.deuterium * 10 * share),
      });
    }
  });

  it('floors only after summing the batch, preserving arbitrarily tiny damage', () => {
    const whole = shipScrapReturn({ DART: 2 }, []);
    const fraction = shipScrapReturn({ DART: 2 }, [wound(2, 0, Number.MIN_VALUE)]);
    expect(fraction.alloy).toBe(whole.alloy - 1);
    expect(shipScrapReturn({}, [])).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(() => shipScrapReturn({ BASTION: 1 }, [])).toThrow(RangeError);
    expect(() => shipScrapReturn({ DART: 1 }, [wound(2, 1)])).toThrow(RangeError);
  });

  it('cannot increase refunds by dividing a batch into separate scrap requests', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 9999 }),
      fc.integer({ min: 1, max: 100 }), (count, bp, portion) => {
        const first = Math.min(portion, count);
        const total = shipScrapReturn({ DART: count }, [wound(count, bp, 0.125)]);
        const a = shipScrapReturn({ DART: first }, [wound(first, bp, 0.125)]);
        const b = shipScrapReturn({ DART: count - first }, [wound(count - first, bp, 0.125)]);
        for (const resource of ['alloy', 'crystal', 'deuterium'] as const) expect(a[resource] + b[resource]).toBeLessThanOrEqual(total[resource]);
      }));
  });
});
