import { describe, expect, it } from 'vitest';
import {
  RESEARCH_CRYSTAL_UPLIFT,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  RESEARCH_TECH,
  researchBaseCostAt,
  cargoMult,
  hullTech,
  prospectorHoldMult,
  researchEffectAt,
  yardSpeedMult,
} from '../src/index.js';
import type { ResearchProjectId } from '../src/index.js';

/**
 * THE OWNER'S PRICE AND EFFECT TABLES, TYPED OUT ONCE AND ASSERTED HERE.
 *
 * Eight projects were re-priced by hand rather than by formula, and their effects
 * with them. A generated ladder is only honest while the generator agrees with the
 * intent; these are the intent, so the table is the test and the code is what has
 * to match it — not the other way round.
 *
 * The figures are the owner's BASE: no tempo scale and no Crystal mix runs on top
 * of them, which is exactly what the exemption in `research.ts` is for.
 *
 * ONE THING DOES SIT ON TOP, AND ONLY ONE. A later owner instruction raised the
 * Crystal on every research rung in the game by a quarter, and the only place all
 * fifteen projects meet — eight hand-priced, seven generated and Crystal-biased —
 * is where their price is quoted. So the Alloy and Deuterium cells below are read
 * literally and the Crystal cell is compared against `RESEARCH_CRYSTAL_UPLIFT`,
 * applied here rather than retyped, so the table on screen stays the table the
 * owner chose and the quote is still asserted cell by cell.
 */

type Rung = readonly [alloy: number, crystal: number, deuterium: number, effect?: number];

const TABLES: Partial<Record<ResearchProjectId, readonly Rung[]>> = {
  YARD_AUTOMATION: [
    [1500, 850, 0, 0.90],
    [3500, 2000, 0, 0.85],
    [7500, 4000, 0, 0.80],
    [16_500, 9000, 0, 0.75],
    [30_500, 17_000, 0, 0.70],
  ],
  PROSPECTOR_HOLDS: [
    [1500, 1000, 0, 1.25],
    [3500, 2250, 0, 1.50],
    [6000, 3500, 0, 1.75],
    [10_000, 7500, 0, 2.00],
    [15_000, 10_000, 0, 2.50],
  ],
  CARGO_HOLDS: [
    [2500, 1500, 0, 1.25],
    [5000, 3500, 0, 1.50],
    [7500, 5000, 0, 1.75],
    [10_000, 7500, 0, 2.00],
    [12_500, 10_000, 0, 2.50],
  ],
  STARSHIP_ENGINEERING: [
    [5000, 3500, 0, 1],
    [7500, 5000, 500, 2],
  ],
  SHIP_POWER: [
    [4500, 2500, 0, 1.05],
    [7500, 4500, 250, 1.10],
    [11_500, 6500, 500, 1.15],
    [17_500, 10_500, 750, 1.20],
    [26_000, 15_500, 1000, 1.25],
  ],
  SHIP_ARMOR: [
    [4500, 2500, 0, 1.05],
    [7500, 4500, 250, 1.10],
    [11_500, 6500, 500, 1.15],
    [17_500, 10_500, 750, 1.20],
    [26_000, 15_500, 1000, 1.25],
  ],
  SHIP_PROPULSION: [
    [4500, 2500, 0, 1.25],
    [7500, 4500, 500, 1.50],
    [11_500, 6500, 750, 1.75],
    [17_500, 10_500, 1000, 2.00],
  ],
  EMPLACEMENT_DOCTRINE: [
    [4500, 2500, 0, 1.05],
    [7500, 4500, 250, 1.10],
    [11_500, 6500, 500, 1.15],
    [17_500, 10_500, 750, 1.20],
    [26_000, 15_500, 1000, 1.25],
  ],
};

describe('the re-priced research tables', () => {
  for (const [id, rungs] of Object.entries(TABLES) as [ResearchProjectId, readonly Rung[]][]) {
    describe(id, () => {
      it('sells exactly as many rungs as the table has', () => {
        expect(RESEARCH_MAX_LEVEL[id]).toBe(rungs.length);
      });

      rungs.forEach(([alloy, crystal, deuterium, effect], index) => {
        const level = index + 1;
        it(`quotes the table price at L${String(level)}`, () => {
          expect(RESEARCH_PROJECTS[id].costAt(level)).toEqual({
            alloy,
            crystal: Math.round(crystal * RESEARCH_CRYSTAL_UPLIFT),
            deuterium,
          });
        });

        it(`pays the table effect at L${String(level)}`, () => {
          expect(researchEffectAt(id, level)).toBeCloseTo(effect ?? 0, 10);
        });
      });
    });
  }
});

describe('the effects behind the tables', () => {
  it('shaves the yard by a tenth at the first rung and by three at the last', () => {
    expect(yardSpeedMult({ YARD_AUTOMATION: 0 })).toBe(1);
    expect(yardSpeedMult({ YARD_AUTOMATION: 1 })).toBeCloseTo(0.90, 10);
    expect(yardSpeedMult({ YARD_AUTOMATION: 5 })).toBeCloseTo(0.70, 10);
    expect(yardSpeedMult({ YARD_AUTOMATION: 99 })).toBeCloseTo(0.70, 10);
  });

  it('lifts a prospector hold to two and a half', () => {
    expect(prospectorHoldMult({})).toBe(1);
    expect(prospectorHoldMult({ PROSPECTOR_HOLDS: 5 })).toBeCloseTo(2.50, 10);
  });

  it('lifts a raid hold to two and a half', () => {
    expect(cargoMult({})).toBe(1);
    expect(cargoMult({ CARGO_HOLDS: 5 })).toBeCloseTo(2.50, 10);
  });

  /** The ladder is legible from the number itself. D124. */
  it('reads a quarter of attack and a quarter of hit points off the fleet ladder', () => {
    const top = hullTech({ SHIP_POWER: 5, SHIP_ARMOR: 5 }, 'DART');
    expect(top.atk).toBeCloseTo(1.25, 10);
    expect(top.hp).toBeCloseTo(1.25, 10);
    expect(top.atk * top.hp).toBeCloseTo(RESEARCH_TECH.powerCeiling, 10);
  });

  it('gives an emplacement the same quarter on both stats', () => {
    const top = hullTech({ EMPLACEMENT_DOCTRINE: 5 }, 'BASTION');
    expect(top.atk).toBeCloseTo(1.25, 10);
    expect(top.hp).toBeCloseTo(1.25, 10);
  });

  /** Support hulls never take the attack lift; only combat hulls do. */
  it("leaves a support hull's attack alone", () => {
    expect(hullTech({ SHIP_POWER: 5 }, 'COURIER').atk).toBe(1);
  });
});

describe('the Crystal uplift the owner asked for', () => {
  /**
   * A QUARTER MORE CRYSTAL ON EVERY RUNG IN THE GAME, not only on the eight
   * hand-priced ladders. Owner instruction.
   *
   * The two families reach their price by different roads — eight are typed out
   * final and exempt from the Crystal bias, seven are generated, tempo-scaled and
   * biased — so a change made in either table alone would have moved half the
   * research screen and left the other half where it was. `withResearchCostMix`
   * is the one place both roads end, and that is where the uplift is applied.
   *
   * Asserted as a RATIO against the pre-uplift price rather than as a list of new
   * numbers, so this keeps meaning the same thing when a rung is re-priced.
   */
  it('raises Crystal on every project, and touches nothing else', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      const levels = RESEARCH_MAX_LEVEL[id];
      for (let level = 1; level <= levels; level++) {
        const quoted = RESEARCH_PROJECTS[id].costAt(level);
        const base = researchBaseCostAt(id, level);
        expect(quoted.crystal, `${id} L${String(level)} Crystal`)
          .toBe(Math.round(base.crystal * RESEARCH_CRYSTAL_UPLIFT));
        expect(quoted.alloy, `${id} L${String(level)} Alloy moved`).toBe(base.alloy);
        expect(quoted.deuterium, `${id} L${String(level)} Deuterium moved`).toBe(base.deuterium);
      }
    }
  });

  it('is an increase, not a rounding accident', () => {
    expect(RESEARCH_CRYSTAL_UPLIFT).toBeGreaterThan(1);
    // A project with real Crystal must actually cost more than it did.
    const before = researchBaseCostAt('YARD_AUTOMATION', 1).crystal;
    expect(RESEARCH_PROJECTS.YARD_AUTOMATION.costAt(1).crystal).toBeGreaterThan(before);
  });
});
