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

/**
 * The Vault's own table, unchanged: 4 hours at L1 and 40 at L20, one step at a
 * time. It is the SHAPE of the building's progression and the owner keeps it.
 */
const TABLE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40,
] as const;

/**
 * WHAT THE STORE ACTUALLY HOLDS: the table times `ECON.storageScale`. D171.
 *
 * The two are separate on purpose. The TABLE is the Vault's progression, which
 * the owner authored and which nothing here may reshape; the SCALE is how much
 * ore a step is worth, which is an economy dial. Multiplying the table in place
 * would have destroyed the first and hidden the second inside it.
 */
const HOURS = TABLE.map((hours) => hours * 2.5);

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
      expect(storageHours(level)).toBeCloseTo(hours, 10);
    });
  });

  it('keeps the owner’s table at 3 to 40 and scales it by two and a half', () => {
    expect(ECON.storageHoursLadder[0]).toBe(3);
    expect(ECON.storageHoursLadder.at(-1)).toBe(40);
    expect(ECON.storageHoursLadder).toHaveLength(21);
    expect(ECON.storageScale).toBe(2.5);
  });

  /**
   * THE RULE THE SCALE EXISTS FOR. D171.
   *
   * The works sit in FRONT of the store and fill at the same rate, so a works
   * deeper than the store is production that cannot be banked — it piles up in
   * the open, on a world that has nowhere to put it, and every raid eats it. That
   * was live from D169 until here: 10 hours of works against 3 hours of store, so
   * a commander with no Vault could keep less than a third of what they made.
   *
   * It now holds at EVERY Vault level, including zero, which is what makes the
   * Vault a lift rather than a rescue.
   */
  it('never lets the works outgrow the store, at any Vault level', () => {
    for (let level = 0; level <= 20; level += 1) {
      expect(ECON.collectorHours, `Vault ${String(level)}`).toBeLessThan(storageHours(level));
    }
  });

  /**
   * The Command Core has no ceiling, so the Vault has none — the table continues
   * at its own last step rather than clamping. A store that stopped growing would
   * re-create the crossing the ladder exists to prevent.
   */
  it("continues the table's last step past its end", () => {
    expect(storageHours(21)).toBeCloseTo(44 * 2.5, 10);
    expect(storageHours(25)).toBeCloseTo(60 * 2.5, 10);
    expect(storageHours(-3)).toBeCloseTo(3 * 2.5, 10);
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
