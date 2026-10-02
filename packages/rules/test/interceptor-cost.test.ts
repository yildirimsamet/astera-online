import { describe, expect, it } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR } from '../src/index.js';

/**
 * WHAT A STRATEGIC BATTERY COSTS. D170/D203, owner figures.
 *
 * The interceptor and the Death Star are priced against EACH OTHER rather than
 * separately — that is the whole interlock. A cheap defence throws D113's work
 * away, and a defence nobody can afford leaves the weapon unanswerable. D203
 * raises every battery component by 50% while tripling every weapon component;
 * nearest-integer component rounding leaves the pair at almost exactly 30%.
 *
 * THESE ARE FINAL FIGURES, like the research tables. No tempo scale runs on top of
 * them: what the sheet quotes is what a person typed.
 */
describe('the strategic battery price', () => {
  it('is the owner’s table exactly', () => {
    expect(ANTI_STRATEGIC.cost).toEqual({ alloy: 21_550, crystal: 10_776, deuterium: 894 });
  });

  /** Still under the weapon; owner 2026-10-01 cheapened the weapon, so about 38%. */
  it('stays below what a Death Star costs', () => {
    const total = (c: { alloy: number; crystal: number; deuterium: number }) =>
      c.alloy + c.crystal + c.deuterium;
    const share = total(ANTI_STRATEGIC.cost) / total(DEATH_STAR.cost);
    expect(share).toBeGreaterThan(0.37);
    expect(share).toBeLessThan(0.39);
  });
});
