import { describe, expect, it } from 'vitest';
import { DEATH_STAR, MULTI_WORLD, recoveryMinutesFor } from '../src/index.js';

/**
 * WHAT A DEATH STAR DOES TO A COLONY. D167 — owner instruction.
 *
 * The weapon stops being a way to TAKE a world and becomes a way to make somebody
 * lose one. A struck colony goes dark for eight hours, and if its commander does
 * not put a single ship on it inside that window it stops being theirs at the end
 * of it — the buildings stay exactly where they are, the world simply has no
 * owner and is open to anybody.
 *
 * A CAPITAL IS UNTOUCHED BY ALL OF IT. Two hours, as it has been since D113, and
 * it can never be lost: "capitals cannot be captured" is a locked constraint and
 * this feature does not get to reinterpret it as "captured slowly".
 *
 * THE ASYMMETRY IS THE POINT. Two hours is a punishment you can sleep through;
 * eight is one you have to answer. That is why only the colony — the holding a
 * commander chose to take on and can lose — carries the longer clock.
 */
describe('how long a struck world stays dark', () => {
  it('gives a colony four times the capital’s window', () => {
    expect(MULTI_WORLD.recoveryMinutes.capital).toBe(2 * 60);
    expect(MULTI_WORLD.recoveryMinutes.colony).toBe(8 * 60);
  });

  it('reads the window off the world’s kind, in one place', () => {
    expect(recoveryMinutesFor('CAPITAL')).toBe(MULTI_WORLD.recoveryMinutes.capital);
    expect(recoveryMinutesFor('COLONY')).toBe(MULTI_WORLD.recoveryMinutes.colony);
  });

  /**
   * A NEUTRAL WORLD TAKES THE CAPITAL'S WINDOW, and that is not an oversight: it
   * has no commander to answer the threat, so the long clock would only be a
   * longer wait for whoever is trying to take it. Nothing can be "dropped" from a
   * world nobody holds.
   */
  it('leaves a neutral world on the short window', () => {
    expect(recoveryMinutesFor('NEUTRAL')).toBe(MULTI_WORLD.recoveryMinutes.capital);
  });
});

describe('what the weapon costs', () => {
  it('carries the owner’s figures exactly', () => {
    expect(DEATH_STAR.cost).toEqual({ alloy: 40_000, crystal: 25_000, deuterium: 6_000 });
  });

  /**
   * IT WENT UP WITH WHAT IT DOES. The strike no longer hands the attacker a world:
   * it opens one for everybody, so the price is the cost of making a decision for
   * the whole galaxy rather than of buying a planet.
   */
  it('is dearer than it was when it captured', () => {
    expect(DEATH_STAR.cost.alloy + DEATH_STAR.cost.crystal + DEATH_STAR.cost.deuterium)
      .toBeGreaterThan(25_500 + 25_500 + 3_900);
  });
});
