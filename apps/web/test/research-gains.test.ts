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
import { percent } from '../src/lib/format.js';

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

  describe('the Fleet V2 ladders', () => {
    const pct = percent;

    it('quotes Power at the attack multiplier the combat rule applies', () => {
      for (let level = 0; level < RESEARCH_TECH.weaponMaxLevel; level += 1) {
        const gain = researchGain('SHIP_POWER', level);
        const expected = hullTech({ SHIP_POWER: level + 1 }, 'DART').atk - 1;
        expect(gain.next).toBe(pct(expected));
      }
    });

    it('shows Engineering as T3/T4 access rather than a combat percentage', () => {
      const first = researchGain('STARSHIP_ENGINEERING', 0);
      const second = researchGain('STARSHIP_ENGINEERING', 1);
      expect(first.now).toMatch(/tier 2/i);
      expect(first.next).toMatch(/tier 3/i);
      expect(second.now).toMatch(/tier 3/i);
      expect(second.next).toMatch(/tier 4/i);
      expect(first.unlocks).toMatch(/individual hulls.*power.*armor.*propulsion/i);
    });

    it('shows the separate attack, armour and propulsion boundaries', () => {
      const top = RESEARCH_TECH.weaponMaxLevel;
      expect(hullTech({ SHIP_POWER: top }, 'COURIER').atk).toBe(1);
      expect(hullTech({ SHIP_ARMOR: top }, 'COURIER').hp).toBeGreaterThan(1);
      expect(hullTech({ SHIP_PROPULSION: top }, 'COURIER').speed).toBeGreaterThan(1);
      /*
        Power's scope is the NARROW one — warships only — while Armor and
        Propulsion cover the whole fleet. The wording moved when "Fleet V2" was
        taken out of player-facing copy (it names a decision, not anything a
        commander can see); the distinction it draws is what is asserted.
      */
      expect(researchGain('SHIP_POWER', 0).unlocks).toMatch(/warship/i);
      expect(researchGain('SHIP_POWER', 0).unlocks).not.toMatch(/all 18/i);
      expect(researchGain('SHIP_ARMOR', 0).unlocks).toMatch(/all 18/i);
      expect(researchGain('SHIP_PROPULSION', 0).unlocks).toMatch(/all 18/i);
    });

    /** The combined Power × Armor ceiling is the one hard research rule. */
    it('names the combined ceiling on the Power and Armor rows', () => {
      const both = hullTech(
        { SHIP_POWER: RESEARCH_TECH.weaponMaxLevel, SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel },
        'DART',
      );
      expect(both.atk * both.hp).toBeCloseTo(RESEARCH_TECH.powerCeiling, 6);
      expect(researchGain('SHIP_POWER', 0).unlocks)
        .toMatch(new RegExp(String(Math.round((RESEARCH_TECH.powerCeiling - 1) * 100))));
      expect(researchGain('SHIP_ARMOR', 0).unlocks)
        .toMatch(new RegExp(String(Math.round((RESEARCH_TECH.powerCeiling - 1) * 100))));
    });
  });

  describe('the economy ladders', () => {
    const pct = percent;

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
