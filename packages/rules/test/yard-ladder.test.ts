import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS, HULLS, YARD_GATE_TOP, alloyRate, buildingCost, crystalRate, yardThroughput,
} from '../src/index.js';

/** The last rung that unlocks a hull, read off the table rather than typed. */
const LAST_GATE = Math.max(...ALL_HULLS.map((id) => HULLS[id].minShipyard));

/** What a rung costs in hours of a same-stage world's production — the economy's numéraire. */
const hoursAt = (level: number): number => {
  const cost = buildingCost('SHIPYARD', level - 1);
  return (cost.alloy + cost.crystal) / (alloyRate(level) + crystalRate(level));
};

/**
 * THE YARD SELLS TWO DIFFERENT THINGS, SO IT IS PRICED TWO DIFFERENT WAYS. D185.
 *
 * Up to `LAST_GATE` it sells HULL TIERS — a step function, and the step that opens
 * the top of the catalogue should cost real time. Above it there are no hulls left
 * to unlock and it sells THROUGHPUT, which `yardThroughput` grows by a flat +35% of
 * base per rung. A constant marginal benefit priced on a geometric curve is the
 * defect this file exists to hold shut: measured before the fix, rung 12 cost 1,912
 * hours of production — eighty days of a thirty-day season — for +91 build speed,
 * while the Command Core's rung at the same level cost 5.5.
 *
 * The gate half is UNCHANGED. This is not a discount on the catalogue; it is a
 * price for the half that had none.
 */
describe('the Yard ladder', () => {
  /**
   * `YARD_GATE_TOP` is written in `economy-profile.ts` because `HULLS` imports that
   * file; this is the assertion that keeps the copy honest. If a hull is ever given
   * a higher `minShipyard`, this fails before the ladder can price the wrong half.
   */
  it('reads its last gate off the hull table', () => {
    expect(LAST_GATE).toBe(6);
    expect(YARD_GATE_TOP).toBe(LAST_GATE);
    expect(HULLS.CATACLYSM.minShipyard).toBe(LAST_GATE);
  });

  it('leaves every gate rung exactly where it was', () => {
    expect(buildingCost('SHIPYARD', 0)).toEqual({ alloy: 143, crystal: 55, deuterium: 0 });
    expect(buildingCost('SHIPYARD', 3)).toEqual({ alloy: 5662, crystal: 2178, deuterium: 0 });
    expect(buildingCost('SHIPYARD', LAST_GATE - 1))
      .toEqual({ alloy: 32587, crystal: 12534, deuterium: 0 });
  });

  /**
   * The effect above the gate is a straight line, so the price is one too — in
   * HOURS, which is the unit every other price in this economy is written in. A
   * commander at Core 16 pays the same time for the same speed as one at Core 8;
   * the resource figure grows only because their hour is worth more.
   */
  it('charges a constant number of production-hours for every rung past the gate', () => {
    const gate = hoursAt(LAST_GATE);
    for (let level = LAST_GATE + 1; level <= 21; level++) {
      expect(hoursAt(level), `rung ${String(level)}`).toBeCloseTo(gate, 1);
    }
  });

  it('never charges more for a rung than the gate it follows', () => {
    for (let level = LAST_GATE + 1; level <= 21; level++) {
      expect(hoursAt(level)).toBeLessThanOrEqual(hoursAt(LAST_GATE) + 0.001);
    }
  });

  /** Bounded by the Core ceiling, so the speed it sells is finite and so is the bill. */
  it('keeps the whole ladder past the gate inside one season of production', () => {
    let total = 0;
    for (let level = LAST_GATE + 1; level <= 21; level++) {
      const cost = buildingCost('SHIPYARD', level - 1);
      total += cost.alloy + cost.crystal;
    }
    // The 30-day reference produces 1,517,487 alloy and 744,576 crystal.
    expect(total).toBeLessThan(1_517_487 + 744_576);
  });

  it('still buys something for the money — the line climbs and never doubles back', () => {
    for (let level = 1; level <= 21; level++) {
      expect(yardThroughput(level)).toBeGreaterThan(yardThroughput(level - 1));
    }
  });
});
