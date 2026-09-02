import { describe, expect, it } from 'vitest';
import {
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  RESEARCH_TECH,
  researchEffectAt,
  researchMaxed,
  type ResearchProjectId,
} from '../src/index.js';

/**
 * A PROJECT STOPS WHERE ITS EFFECT STOPS. T12, the instrument rule applied to
 * research.
 *
 * D36 recorded what happens when a ceiling is typed rather than derived: the
 * Telescope's range table ended at L5 while the interface went on selling L6, and
 * it charged for it. `INSTRUMENT_MAX_LEVEL` fixed that by reading the table
 * length, and this is the same fix for the fifteen research projects — with one
 * difference that matters. An instrument's effect is a lookup table, so its length
 * IS the answer. A research effect is a function, so the ceiling has to be found
 * by walking it: the last rung that changes the number is the last rung worth
 * selling.
 *
 * Written this way the ceiling cannot be wrong. Add a rung to a cost ladder
 * without extending its effect and this file goes red rather than the screen
 * quoting a price for nothing.
 */

/** Comfortably above any ceiling the game has: every effect clamps long before. */
const BEYOND = 32;

describe('the derived research ceiling', () => {
  it('agrees with the ceiling each project declares', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      expect(RESEARCH_PROJECTS[id].maxLevel, id).toBe(RESEARCH_MAX_LEVEL[id]);
    }
  });

  it('has a ceiling of at least one for every project', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      expect(RESEARCH_MAX_LEVEL[id], id).toBeGreaterThanOrEqual(1);
    }
  });

  /**
   * THE HALF THAT CATCHES A DEAD RUNG. Every level up to the ceiling must move
   * the number; a ladder with a flat step in the middle is a rung sold for
   * nothing, and it would still pass the ceiling check above.
   */
  it('changes its effect at every rung up to the ceiling', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        expect(
          researchEffectAt(id, level),
          `${id} L${String(level)} buys nothing over L${String(level - 1)}`,
        ).not.toBe(researchEffectAt(id, level - 1));
      }
    }
  });

  /** And the half that catches a ceiling set too high. */
  it('changes nothing above the ceiling', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const top = researchEffectAt(id, RESEARCH_MAX_LEVEL[id]);
      for (let level = RESEARCH_MAX_LEVEL[id] + 1; level <= BEYOND; level++) {
        expect(researchEffectAt(id, level), `${id} L${String(level)}`).toBe(top);
      }
    }
  });

  it('reads a level below zero as holding nothing', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      expect(researchEffectAt(id, -3), id).toBe(researchEffectAt(id, 0));
    }
  });

  it('ignores a fractional rung rather than interpolating one', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      expect(researchEffectAt(id, 1.9), id).toBe(researchEffectAt(id, 1));
    }
  });
});

describe('what each kind of project turns out to be', () => {
  /**
   * NOTHING DECLARES ITSELF A PERMISSION. The four Frontier projects, the grid and
   * the stockpile are permissions because their effect stops moving after one
   * rung — not because a flag says so. That is the whole point of deriving it:
   * give the stockpile a third Death Star tomorrow and it becomes a ladder here
   * without anyone remembering to edit a second table.
   */
  const permissions: ResearchProjectId[] = [
    'ISOTOPE_SPECTROMETRY',
    'DENSE_FUEL_CELLS',
    'GRAVITIC_CHARGES',
    'DEATH_STAR_PROTOCOL',
    'INTERCEPTION_GRID',
    'STRATEGIC_STOCKPILE',
  ];

  it('finds one rung under every permission', () => {
    for (const id of permissions) {
      expect(RESEARCH_MAX_LEVEL[id], id).toBe(1);
      expect(researchMaxed(id, 1), id).toBe(true);
      expect(researchMaxed(id, 0), id).toBe(false);
    }
  });

  it('finds five under each economy ladder', () => {
    for (const id of ['DEUTERIUM_SYNTHESIS', 'YARD_AUTOMATION',
      'PROSPECTOR_HOLDS', 'CARGO_HOLDS'] as const) {
      expect(RESEARCH_MAX_LEVEL[id], id).toBe(RESEARCH_TECH.economyMaxLevel);
    }
  });

  /**
   * PROPULSION COUNTS ITS OWN RUNGS SINCE D152. The other three split
   * `powerCeiling` between them and share the ladder length that ceiling is
   * divided across; speed takes no share of a combat product, so it carries
   * `propulsionMaxLevel` instead — and the walk has to find that, not the
   * weapon figure, or the cost ladder and the effect part company again.
   */
  it('finds two useful Engineering permissions and the stated rungs under each stat ladder', () => {
    expect(RESEARCH_MAX_LEVEL.STARSHIP_ENGINEERING)
      .toBe(RESEARCH_TECH.engineeringMaxLevel);
    for (const id of ['SHIP_POWER', 'SHIP_ARMOR', 'EMPLACEMENT_DOCTRINE'] as const) {
      expect(RESEARCH_MAX_LEVEL[id], id).toBe(RESEARCH_TECH.weaponMaxLevel);
    }
    expect(RESEARCH_MAX_LEVEL.SHIP_PROPULSION).toBe(RESEARCH_TECH.propulsionMaxLevel);
  });

  /**
   * THE COST LADDER AND THE EFFECT LADDER MUST END TOGETHER. `weaponLadder` and
   * `economyLadder` clamp their prices with their own constant; if that constant
   * and the effect ever part company, one of them is quoting a rung the other
   * does not sell.
   */
  it('quotes the same price at the ceiling and above it', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const top = RESEARCH_PROJECTS[id].costAt(RESEARCH_MAX_LEVEL[id]);
      expect(RESEARCH_PROJECTS[id].costAt(RESEARCH_MAX_LEVEL[id] + 1), id).toEqual(top);
    }
  });

  it('never quotes a free rung', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        const cost = RESEARCH_PROJECTS[id].costAt(level);
        expect(cost.alloy + cost.crystal + cost.deuterium, `${id} L${String(level)}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('climbs in price with every rung', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 2; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        const below = RESEARCH_PROJECTS[id].costAt(level - 1);
        const here = RESEARCH_PROJECTS[id].costAt(level);
        expect(
          here.alloy + here.crystal + here.deuterium,
          `${id} L${String(level)} is not dearer than L${String(level - 1)}`,
        ).toBeGreaterThan(below.alloy + below.crystal + below.deuterium);
      }
    }
  });
});

describe('researchMaxed', () => {
  it('is false below the ceiling and true at or above it', () => {
    expect(researchMaxed('CARGO_HOLDS', 0)).toBe(false);
    expect(researchMaxed('CARGO_HOLDS', RESEARCH_TECH.economyMaxLevel - 1)).toBe(false);
    expect(researchMaxed('CARGO_HOLDS', RESEARCH_TECH.economyMaxLevel)).toBe(true);
    expect(researchMaxed('CARGO_HOLDS', RESEARCH_TECH.economyMaxLevel + 4)).toBe(true);
  });
});
