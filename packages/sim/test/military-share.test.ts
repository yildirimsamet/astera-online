import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ARCHETYPE_NAMES, militaryShareAt } from '../src/archetypes.js';

/**
 * WHAT A COMMANDER SPENDS ON A FLEET CHANGES AS THEY GROW. D192, owner instruction:
 * *"İlk seviyelerde bina odaklı, biraz gelişince %70 bina %30 filo, biraz daha
 * fazla gelişince %50 %50."*
 *
 * A single fraction for the whole season modelled a commander who fights as hard on
 * day one as on day twenty, which nobody does: the opening has nothing worth
 * defending and every hour of production is worth more in a Refinery than in a
 * Dart. The split earns its place later, when the buildings are tall enough that
 * the next rung repays slowly and a raid does not.
 *
 * THE ARCHETYPE STILL VARIES AROUND IT. The stage sets what the GALAXY does and each
 * habit keeps its own tilt against the mean, so a Turtle is still a Turtle at every
 * stage and a Raider still a Raider. Flattening them onto one curve would delete the
 * spread the ladder is measured against.
 */
describe('the fleet share follows development', () => {
  const mean = (level: number) =>
    ARCHETYPE_NAMES.reduce((sum, name) => sum + militaryShareAt(name, level), 0)
    / ARCHETYPE_NAMES.length;

  /**
   * BUILDING-FOCUSED, AND NOT MORE THAN THAT. Roughly three quarters into the
   * world and a quarter into hulls. Pushed further down — 0.12 was tried — the
   * informed archetype stops topping the ladder on seed 4242, which is the design's
   * central claim; an opening that silences the raider is not a stage, it is a
   * different archetype.
   */
  it('keeps the opening building-focused', () => {
    expect(mean(1)).toBeLessThan(0.3);
    expect(mean(4)).toBeLessThan(0.3);
    expect(mean(1)).toBeLessThan(mean(9));
  });

  /**
   * THE INSTRUCTION'S RANGE, AT THE END OF IT THAT SURVIVES ITS OWN GOAL. The brief
   * opened at 70/30 and widened to *"%30-%40 civarı"*; swept across five seeds, a
   * mid share of 0.30 puts VFR at 0.083 against a 0.09 floor AND flies fewer raids
   * than 0.40 does, so the cheap end buys nothing the instruction was after.
   */
  it('reaches roughly four tenths once a world is developing', () => {
    expect(mean(7)).toBeCloseTo(0.4, 1);
    expect(mean(10)).toBeCloseTo(0.4, 1);
    // Still inside the briefed 30-40% band, and above where the measurement breaks.
    expect(mean(7)).toBeLessThanOrEqual(0.4);
    expect(mean(7)).toBeGreaterThan(0.36);
  });

  /**
   * HALF, WHICH IS THE BRIEF'S OWN FIGURE. It briefly had to sit at 0.55: with the
   * vault covering a developed commander's whole working day, 0.50 left VFR at
   * 0.089 against a 0.09 floor. D193 capped protection at a night, the galaxy holds
   * something worth taking again, and the number the owner actually asked for fits.
   *
   * Worth keeping as a lesson: a band that will not accept the design's own figure
   * is usually reporting a defect somewhere else, not a bad figure.
   */
  it('reaches roughly half once a world is developed', () => {
    expect(mean(13)).toBeCloseTo(0.5, 2);
    expect(mean(18)).toEqual(mean(13));
  });

  it('never goes backwards as a commander grows', () => {
    for (const name of ARCHETYPE_NAMES) {
      for (let level = 1; level < 22; level++) {
        expect(militaryShareAt(name, level + 1), `${name} L${String(level)}`)
          .toBeGreaterThanOrEqual(militaryShareAt(name, level));
      }
    }
  });

  it('keeps every habit distinct, and in the order the archetypes author', () => {
    for (const level of [4, 8, 14]) {
      const order = [...ARCHETYPE_NAMES].sort(
        (a, b) => militaryShareAt(a, level) - militaryShareAt(b, level),
      );
      const authored = [...ARCHETYPE_NAMES].sort(
        (a, b) => ARCHETYPES[a].militaryShare - ARCHETYPES[b].militaryShare,
      );
      expect(order).toEqual(authored);
    }
  });

  /** A share outside (0, 1) is not a split; it is a bug that empties a treasury. */
  it('stays a fraction at every level for every habit', () => {
    for (const name of ARCHETYPE_NAMES) {
      for (let level = 0; level <= 22; level++) {
        const share = militaryShareAt(name, level);
        expect(share).toBeGreaterThan(0);
        expect(share).toBeLessThan(1);
      }
    }
  });
});
