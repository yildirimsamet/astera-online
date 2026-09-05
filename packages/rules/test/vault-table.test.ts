import { describe, expect, it } from 'vitest';
import {
  ECON,
  alloyRate,
  buildingCost,
  protectedHours,
  storageCap,
  storageHours,
  upgradeCost,
} from '../src/index.js';

/**
 * THE VAULT'S OWN LADDER, PRICED AND MEASURED BY HAND.
 *
 * The Vault used to be an ordinary building: the shared `upgradeCost` curve and a
 * store that already held fifteen hours before anybody built one. Both halves
 * moved together on the owner's table — the store now OPENS at three hours and the
 * Vault is what makes it forty, and the price it charges for that is its own.
 *
 * The two are asserted here rather than derived, because the table IS the design.
 */

/** Alloy the owner's table charges to REACH each level, L1 first. */
const PRICE_ALLOY = [
  200, 300, 450, 675, 1013, 1519, 2280, 3417, 5126, 7689,
  11_533, 17_300, 25_950, 38_925, 58_388, 87_582, 131_373, 197_060, 295_590, 443_385,
] as const;

const PRICE_CRYSTAL = [
  100, 150, 225, 338, 506, 760, 1140, 1520, 2280, 3845,
  5767, 8650, 12_975, 19_463, 29_194, 43_791, 65_687, 98_530, 147_795, 221_693,
] as const;

/** Hours of production the STORE holds, indexed by Vault level, zero first. */
const HOURS = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40,
] as const;

describe('the Vault price table', () => {
  PRICE_ALLOY.forEach((alloy, index) => {
    const level = index + 1;
    it(`charges the table price to reach L${String(level)}`, () => {
      expect(buildingCost('VAULT', level - 1)).toEqual({
        alloy,
        crystal: PRICE_CRYSTAL[index],
        deuterium: 0,
      });
    });
  });

  /** Every other building keeps the shared curve; only the Vault left it. */
  it('leaves the ordinary building ladder alone', () => {
    for (let level = 0; level < 20; level += 1) {
      expect(buildingCost('REFINERY', level)).toEqual(upgradeCost(level));
      expect(buildingCost('EXTRACTOR', level)).toEqual(upgradeCost(level));
    }
  });
});

describe('the store the Vault buys', () => {
  HOURS.forEach((hours, level) => {
    it(`holds ${String(hours)} hours at Vault ${String(level)}`, () => {
      expect(storageHours(level)).toBe(hours);
    });
  });

  it('opens at three hours and tops out at forty', () => {
    expect(ECON.storageHoursLadder[0]).toBe(3);
    expect(ECON.storageHoursLadder.at(-1)).toBe(40);
    expect(ECON.storageHoursLadder).toHaveLength(21);
  });

  /**
   * The Command Core has no ceiling, so the Vault has none — the table continues
   * at its own last step rather than clamping. A store that stopped growing would
   * re-create the crossing the ladder exists to prevent.
   */
  it("continues the table's last step past its end", () => {
    expect(storageHours(21)).toBe(44);
    expect(storageHours(25)).toBe(60);
    expect(storageHours(-3)).toBe(3);
  });

  it('continues the price table at its own growth past its end', () => {
    expect(buildingCost('VAULT', 20).alloy).toBe(Math.round(443_385 * 1.5));
    expect(buildingCost('VAULT', 21).alloy).toBe(Math.round(443_385 * 2.25));
  });

  it('never shrinks as the Vault grows', () => {
    for (let level = 1; level <= 20; level += 1) {
      expect(storageHours(level)).toBeGreaterThan(storageHours(level - 1));
    }
  });
});

describe('the vault floor follows the store it sits in', () => {
  /** D61: at most half a store may ever be safe — now true by construction. */
  it('keeps the protected share under half at every level', () => {
    for (let level = 0; level <= 20; level += 1) {
      expect(protectedHours(level) / storageHours(level)).toBeLessThan(0.5);
    }
  });

  /** D161: under a fifth of a full store at every Vault level. */
  it('keeps the protected share under a fifth at every level', () => {
    for (let level = 0; level <= 20; level += 1) {
      expect(protectedHours(level) / storageHours(level)).toBeLessThan(0.2);
    }
  });

  it('grows with the store rather than faster than it', () => {
    const share = (level: number) => protectedHours(level) / storageHours(level);
    expect(share(20)).toBeCloseTo(share(0), 10);
  });
});

describe('a developed Vault can still hold what the next upgrade costs', () => {
  it('never creates an upgrade the store cannot reach', () => {
    for (let level = 1; level <= 20; level += 1) {
      const vault = Math.max(0, Math.min(20, level - 1));
      expect(upgradeCost(level).alloy, `L${String(level)} at Vault ${String(vault)}`)
        .toBeLessThanOrEqual(storageCap(alloyRate(level), vault));
    }
  });
});
