import { describe, expect, it } from 'vitest';
import { ALL_HULLS, hullWorkMinutes, shipyardSpeedMultiplier, shipyardTimeReduction } from '../src/index.js';

describe('the Shipyard production effect', () => {
  it('keeps the existing speed rule and reports time saved from the preceding level', () => {
    expect(shipyardSpeedMultiplier(0)).toBe(1);
    expect(shipyardSpeedMultiplier(4)).toBe(1.48);
    expect(shipyardSpeedMultiplier(5)).toBe(1.6);
    expect(shipyardTimeReduction(4)).toBeCloseTo(0.075, 12);
    expect(shipyardTimeReduction(5)).toBeCloseTo(1 - 1.6 / 1.72, 12);
    expect(shipyardTimeReduction(6)).toBeCloseTo(1 - 1.72 / 1.84, 12);
  });

  it('matches live ship and ground-defence clocks regardless of recipe, batch size or research', () => {
    for (const hull of ALL_HULLS) for (const level of [0, 4, 5, 6, 14, 29]) {
      for (const count of [1, 7]) for (const automation of [0, 1, 2]) {
        const tech = { YARD_AUTOMATION: automation };
        const before = hullWorkMinutes(hull, count, level, tech);
        const after = hullWorkMinutes(hull, count, level + 1, tech);
        expect(1 - after / before, `${hull} at ${String(level)}`).toBeCloseTo(shipyardTimeReduction(level), 12);
      }
    }
  });

  it('has diminishing savings without a zero-effect upgrade throughout the building range', () => {
    let previous = 1;
    for (let level = 0; level < 30; level++) {
      const reduction = shipyardTimeReduction(level);
      expect(reduction).toBeGreaterThan(0);
      expect(reduction).toBeLessThan(previous);
      previous = reduction;
    }
  });

  it.each([-1, 0.5, NaN, Infinity])('rejects an invalid level: %s', level => {
    expect(() => shipyardSpeedMultiplier(level)).toThrow();
    expect(() => shipyardTimeReduction(level)).toThrow();
  });
});
