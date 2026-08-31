import { describe, expect, it } from 'vitest';
import {
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECT_IDS,
  RESEARCH_TECH,
  cargoMult,
  hullTech,
  prospectorHoldMult,
  yardSpeedMult,
} from '@astera/rules';
import { researchGain } from '../src/lib/gains.js';

/**
 * WHAT A RUNG OF RESEARCH BUYS, AND WHETHER THE SCREEN SAYS SO.
 *
 * Research was the only ladder in the game with no figure on it. Buildings,
 * instruments and satellites all reach `UpgradeRow` with a "now → next" pair; the
 * research panel built the same row and passed nothing, so fifteen projects were
 * sold on prose alone — "Builds ships faster", "Better attack and armour", "Mining
 * craft carry more". How much, at which rung, was on no surface in the game.
 *
 * D124 is blunt: a rule the player cannot SEE is not a rule. These hold the fix,
 * and every figure is checked against the rule that produces it rather than
 * against a number typed here — a copy of the arithmetic would go stale the first
 * time `RESEARCH_TECH` moved, which is the failure this file exists to prevent.
 */
describe('what a rung of research buys', () => {
  it('has a figure for every project, with no gaps', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const gain = researchGain(id, 0);
      expect(gain.label, id).toBeTruthy();
      expect(gain.now, id).toBeTruthy();
      expect(gain.next, id).toBeTruthy();
    }
  });

  /**
   * A PERMISSION OPENS A DOOR; EVERYTHING ELSE MOVES A NUMBER.
   *
   * NAMED RATHER THAN INFERRED FROM `maxLevel`, and that distinction is the point:
   * `STRATEGIC_STOCKPILE` also has exactly one rung, and it is NOT a door — it
   * raises how many weapons may stand ready from one to two. Deriving "door" from
   * the rung count would have drawn a real quantity as a padlock. The five are a
   * closed set and naming them is the honest version.
   */
  const PERMISSIONS = [
    'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES',
    'DEATH_STAR_PROTOCOL', 'INTERCEPTION_GRID',
  ] as const;

  it('moves on every rung of everything that is not a door', () => {
    const ladders = RESEARCH_PROJECT_IDS.filter(
      (id) => !PERMISSIONS.some((door) => door === id),
    );
    expect(ladders.length).toBeGreaterThan(0);
    for (const id of ladders) {
      for (let level = 0; level < RESEARCH_MAX_LEVEL[id]; level += 1) {
        const gain = researchGain(id, level);
        expect(gain.now, `${id} L${String(level)}`).not.toBe(gain.next);
      }
    }
  });

  it('shows a permission as a door rather than a quantity', () => {
    for (const id of PERMISSIONS) {
      const shut = researchGain(id, 0);
      expect(shut.unlocks, id).toBeTruthy();
      expect(shut.maxed, id).toBeUndefined();
      expect(researchGain(id, 1).maxed, id).toBe(true);
    }
  });

  /** And the one-rung project that is NOT a door still quotes its quantity. */
  it('quotes the stockpile as a count, not a padlock', () => {
    const gain = researchGain('STRATEGIC_STOCKPILE', 0);
    expect(gain.now).toBe('1');
    expect(gain.next).toBe('2');
    expect(gain.unlocks).toBeUndefined();
  });

  /** D36: a maxed ladder must not offer a step it cannot sell. */
  it('stops offering a step at the top of every ladder', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const top = researchGain(id, RESEARCH_MAX_LEVEL[id]);
      expect(top.maxed, id).toBe(true);
      expect(top.now, id).toBe(top.next);
    }
  });

  /* ── the figures themselves, against the rules that make them ── */

  describe('the combat ladders', () => {
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

    it('quotes a doctrine at the multiplier the combat rule applies', () => {
      for (let level = 0; level < RESEARCH_TECH.weaponMaxLevel; level += 1) {
        const gain = researchGain('WASP_DOCTRINE', level);
        const expected = hullTech({ WASP_DOCTRINE: level + 1 }, 'WASP').atk - 1;
        expect(gain.next).toBe(pct(expected));
      }
    });

    /**
     * THE TWO ROWS THE PLAYER IS ACTUALLY CHOOSING BETWEEN.
     *
     * They split the ceiling evenly, so the percentages are the SAME and the
     * honest difference is reach. If the two ever printed the same scope line the
     * screen would be offering a choice it had not explained.
     */
    it('gives a doctrine and the general project the same step and different reach', () => {
      const doctrine = researchGain('WASP_DOCTRINE', 2);
      const general = researchGain('WEAPONS_GENERAL', 2);
      expect(general.next).toBe(doctrine.next);
      expect(general.unlocks).not.toBe(doctrine.unlocks);
      expect(general.unlocks).toMatch(/every ship and ground gun/i);
      expect(doctrine.unlocks).toMatch(/wasp/i);
    });

    /** And the general project is the only one a support hull ever feels. */
    it('reflects that no doctrine covers a support hull', () => {
      const top = RESEARCH_TECH.weaponMaxLevel;
      expect(hullTech({ WASP_DOCTRINE: top }, 'HAULER').atk).toBe(1);
      expect(hullTech({ WEAPONS_GENERAL: top }, 'HAULER').atk).toBeGreaterThan(1);
    });

    /** The combined ceiling is the one hard rule, and the copy states it. */
    it('names the combined ceiling on the general row', () => {
      const both = hullTech(
        { WASP_DOCTRINE: RESEARCH_TECH.weaponMaxLevel, WEAPONS_GENERAL: RESEARCH_TECH.weaponMaxLevel },
        'WASP',
      );
      expect(both.atk * both.hp).toBeCloseTo(RESEARCH_TECH.powerCeiling, 6);
      expect(researchGain('WEAPONS_GENERAL', 0).unlocks)
        .toMatch(new RegExp(String(Math.round((RESEARCH_TECH.powerCeiling - 1) * 100))));
    });
  });

  describe('the economy ladders', () => {
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

    /** A shorter build is a saving, and must not be quoted as a negative gain. */
    it('quotes yard automation as time SAVED', () => {
      const gain = researchGain('YARD_AUTOMATION', 0);
      expect(gain.next).toBe(pct(1 - yardSpeedMult({ YARD_AUTOMATION: 1 })));
      expect(gain.next).not.toMatch(/-/);
    });

    it('quotes prospector holds at the mining rule', () => {
      const gain = researchGain('PROSPECTOR_HOLDS', 3);
      expect(gain.next).toBe(pct(prospectorHoldMult({ PROSPECTOR_HOLDS: 4 }) - 1));
      expect(gain.unlocks).toMatch(/derrick/i);
    });

    it('quotes cargo holds at the loot rule, and says loot only', () => {
      const gain = researchGain('CARGO_HOLDS', 1);
      expect(gain.next).toBe(pct(cargoMult({ CARGO_HOLDS: 2 }) - 1));
      expect(gain.unlocks).toMatch(/loot/i);
    });
  });
});
