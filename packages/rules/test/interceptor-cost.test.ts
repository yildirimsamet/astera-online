import { describe, expect, it } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR } from '../src/index.js';

/**
 * WHAT A STRATEGIC BATTERY COSTS. D170, owner figures.
 *
 * The interceptor and the Death Star are priced against EACH OTHER rather than
 * separately — that is the whole interlock. A cheap defence throws D113's work
 * away, and a defence nobody can afford leaves a 71,000-resource weapon
 * unanswerable. It was 13,600 / 13,600 / 1,560, which is about 40% of a strike;
 * the owner's figures take it to about 60%, so committing a battery is now a real
 * share of the weapon it exists to stop.
 *
 * THESE ARE FINAL FIGURES, like the research tables. No tempo scale runs on top of
 * them: what the sheet quotes is what a person typed.
 */
describe('the strategic battery price', () => {
  it('is the owner’s table exactly', () => {
    expect(ANTI_STRATEGIC.cost).toEqual({ alloy: 11_000, crystal: 8_000, deuterium: 1_500 });
  });

  /** Still under the weapon, and still by a margin worth defending with. */
  it('stays below what a Death Star costs', () => {
    const total = (c: { alloy: number; crystal: number; deuterium: number }) =>
      c.alloy + c.crystal + c.deuterium;
    const share = total(ANTI_STRATEGIC.cost) / total(DEATH_STAR.cost);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.75);
  });
});
