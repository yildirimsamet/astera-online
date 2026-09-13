import { describe, expect, it } from 'vitest';
import { ECON, alloyRate, collectorCap, storageCap, storageHours } from '../src/index.js';

/**
 * EVERY STORE IS A QUARTER DEEPER. D181 — owner instruction, uniform and flat.
 *
 * The owner asked for +25% of storage at EVERY level, ahead of a fuller look at
 * the economy. `ECON.storageScale` is exactly the dial for that and D171 says so
 * in as many words: `storageHoursLadder` is the Vault's authored PROGRESSION and
 * nothing may reshape it, while the scale is what one step of it is worth in ore.
 * So this is one number, 2.5 → 3.125, and the shape of the building is untouched.
 *
 * WHAT MUST SURVIVE IT, and is asserted here rather than assumed:
 *   · the lift is UNIFORM — the same factor at Vault 0, at the top of the table
 *     and past its end, where the last step extrapolates;
 *   · the works stay smaller than the store at every level, which is the bug D171
 *     existed to fix (ore with nowhere to bank is ore produced for nothing);
 *   · the vault floor is a SHARE of the store, so raising the store raises the
 *     protected and the raidable pile together and moves no ratio. `raidable.test.ts`
 *     holds that band and must stay green without being touched.
 */
const MONTHLY_SCALE = 5.25;

describe('the uniform storage lift', () => {
  it('is one dial, and the Vault’s own progression is untouched', () => {
    expect(ECON.storageScale).toBeCloseTo(MONTHLY_SCALE, 10);
    expect(ECON.storageHoursLadder[0]).toBe(3);
    expect(ECON.storageHoursLadder[1]).toBe(4);
  });

  it('keeps the monthly scale as the authored minimum', () => {
    const authored = new Map([[0, 3], [1, 4], [5, 8], [10, 13], [20, 40], [40, 120]]);
    for (const [level, hours] of authored) {
      expect(storageHours(level)).toBeGreaterThanOrEqual(hours * MONTHLY_SCALE);
    }
  });

  /**
   * THE INVARIANT D171 WAS WRITTEN FOR. Ore that cannot be banked is ore produced
   * for nothing, so the works may never be deeper than the store — at any Vault
   * level, zero included.
   */
  it('keeps the store deeper than the works at every Vault level', () => {
    for (let level = 0; level <= 20; level += 1) {
      const rate = alloyRate(6);
      expect(storageCap(rate, level)).toBeGreaterThan(collectorCap(rate));
    }
  });

  it('still grows with the Vault rather than flattening', () => {
    for (let level = 1; level <= 20; level += 1) {
      expect(storageHours(level)).toBeGreaterThan(storageHours(level - 1));
    }
  });
});
