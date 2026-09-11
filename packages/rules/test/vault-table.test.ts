import { describe, expect, it } from 'vitest';
import {
  ECON,
  alloyRate,
  buildingCost,
  protectedHours,
  storageCap,
  storageHours,
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
const PRICE_ALLOY = [40,88,154,548,886,1411,2225,3485,5427,8416,13009,20054,30842,47344,72555,111033,169703,259088,395167,602187];
const PRICE_CRYSTAL = [20,44,77,274,443,706,1113,1743,2714,4208,6505,10027,15421,23672,36278,55517,84852,129544,197584,301094];

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
 *
 * SO THE SCALE IS READ, NOT RETYPED. D181. It was written out as a literal `2.5`
 * here, which meant a deliberate economy tweak — the owner asking for +25% of
 * storage at every level — arrived as twenty-one failing assertions about the
 * VAULT, a building nobody had touched. The shape below is still asserted against
 * hand-written numbers, because the shape is the design; the dial belongs to
 * `storage-lift.test.ts`, which is where its value is now stated exactly once.
 */
const HOURS = TABLE.map((hours) => hours * ECON.storageScale);

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
      expect(buildingCost('REFINERY', level).alloy).toBeGreaterThan(0);
      expect(buildingCost('EXTRACTOR', level).crystal).toBeGreaterThan(0);
    }
  });
});

describe('the store the Vault buys', () => {
  HOURS.forEach((hours, level) => {
    it(`holds ${String(hours)} hours at Vault ${String(level)}`, () => {
      expect(storageHours(level)).toBeCloseTo(hours, 10);
    });
  });

  /**
   * THE SHAPE, AND ONLY THE SHAPE. The scale used to be asserted here too; D181
   * moved it to `storage-lift.test.ts` so an economy tweak lands in one place
   * instead of arriving as a failing claim about the Vault's progression.
   */
  it('keeps the owner’s table at 3 to 40 across twenty-one rungs', () => {
    expect(ECON.storageHoursLadder[0]).toBe(3);
    expect(ECON.storageHoursLadder.at(-1)).toBe(40);
    expect(ECON.storageHoursLadder).toHaveLength(21);
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
    expect(storageHours(21)).toBeCloseTo(44 * ECON.storageScale, 10);
    expect(storageHours(25)).toBeCloseTo(60 * ECON.storageScale, 10);
    expect(storageHours(-3)).toBeCloseTo(3 * ECON.storageScale, 10);
  });

  it('continues the price table at its own growth past its end', () => {
    expect(buildingCost('VAULT', 20).alloy).toBe(916936);
    expect(buildingCost('VAULT', 21).alloy).toBe(1395200);
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

  /**
   * THE SHARE FALLS AT THE TOP, AND THAT IS THE RULE NOW. D193.
   *
   * This asserted the share was ONE CONSTANT at every level, which was true while
   * protection was a pure percentage of the store — and was exactly what let a
   * developed commander's whole working day sit behind the floor. Protection is
   * capped at a night (`ECON.protectedHoursCap`), so past the crossing the share
   * falls as the store deepens. The intent this test was written for — protection
   * must never outgrow the store — is satisfied more strongly than before.
   */
  it('never grows faster than the store, and falls once the night cap binds', () => {
    const share = (level: number) => protectedHours(level) / storageHours(level);
    for (let level = 1; level <= 20; level += 1) {
      expect(share(level), `Vault ${String(level)}`).toBeLessThanOrEqual(share(level - 1) + 1e-9);
    }
    expect(share(20)).toBeLessThan(share(0));
  });
});

describe('a developed Vault can still hold what the next upgrade costs', () => {
  it('never creates an upgrade the store cannot reach', () => {
    for (let level = 1; level <= 20; level += 1) {
      const vault = Math.max(0, Math.min(20, level - 1));
      expect(buildingCost('REFINERY', level).alloy, `L${String(level)} at Vault ${String(vault)}`)
        .toBeLessThanOrEqual(storageCap(alloyRate(level), vault));
    }
  });
});
