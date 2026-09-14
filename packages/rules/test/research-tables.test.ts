import { describe, expect, it } from 'vitest';
import {
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  RESEARCH_TECH,
  cargoMult,
  hullTech,
  prospectorHoldMult,
  researchEffectAt,
  robotSpeedMult,
  yardSpeedMult,
} from '../src/index.js';
import type { ResearchProjectId } from '../src/index.js';

/** Monthly recipe fixtures. Effects remain the authored ladders; Propulsion now caps at 1.5. */
type Rung = readonly [alloy: number, crystal: number, deuterium: number, effect?: number];

const TABLES: Partial<Record<ResearchProjectId, readonly Rung[]>> = {
  YARD_AUTOMATION: [
    [7897, 4860, 0, 0.9],
    [14214, 8747, 0, 0.85],
    [25584, 15744, 0, 0.8],
    [46051, 28339, 0, 0.75],
    [82892, 51010, 0, 0.7],
  ],
  /** The surface's ladder: Yard Automation's family, a sixth dearer at every rung. D198. */
  AI_ROBOTS: [
    [9213, 5670, 0, 0.95],
    [16583, 10205, 0, 0.9],
    [29848, 18368, 0, 0.85],
    [53726, 33062, 0, 0.8],
    [96707, 59512, 0, 0.75],
  ],
  PROSPECTOR_HOLDS: [
    [6230, 3834, 0, 1.25],
    [11214, 6902, 0, 1.5],
    [20185, 12422, 0, 1.75],
    [36333, 22359, 0, 2.0],
    [65400, 40246, 0, 2.5],
  ],
  CARGO_HOLDS: [
    [6230, 3834, 0, 1.25],
    [11214, 6902, 0, 1.5],
    [20185, 12422, 0, 1.75],
    [36333, 22359, 0, 2.0],
    [65400, 40246, 0, 2.5],
  ],
  STARSHIP_ENGINEERING: [
    [17059, 10498, 0, 1.0],
    [64092, 39442, 0, 2.0],
  ],
  SHIP_POWER: [
    [6824, 4199, 61, 1.05],
    [15694, 9658, 141, 1.1],
    [24658, 15174, 221, 1.15],
    [56714, 34901, 507, 1.2],
    [130441, 80271, 1165, 1.25],
  ],
  SHIP_ARMOR: [
    [4662, 2869, 42, 1.05],
    [10721, 6598, 96, 1.1],
    [24658, 15174, 221, 1.15],
    [56714, 34901, 507, 1.2],
    [130441, 80271, 1165, 1.25],
  ],
  SHIP_PROPULSION: [
    [3885, 2390, 84, 1.125],
    [8158, 5020, 175, 1.25],
    [17131, 10542, 368, 1.375],
    [35974, 22138, 771, 1.5],
  ],
  EMPLACEMENT_DOCTRINE: [
    [3108, 1913, 42, 1.05],
    [6526, 4016, 88, 1.1],
    [13705, 8434, 184, 1.15],
    [28779, 17710, 386, 1.2],
    [60435, 37191, 810, 1.25],
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
            crystal,
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

  /**
   * The two build queues, side by side. Neither may reach into the other's lane:
   * a project that shortened both would leave one of them nothing to sell.
   */
  it('shaves the surface by a twentieth at the first rung and by a quarter at the last', () => {
    expect(robotSpeedMult({ AI_ROBOTS: 0 })).toBe(1);
    expect(robotSpeedMult({ AI_ROBOTS: 1 })).toBeCloseTo(0.95, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 5 })).toBeCloseTo(0.75, 10);
    expect(robotSpeedMult({ AI_ROBOTS: 99 })).toBeCloseTo(0.75, 10);
    expect(robotSpeedMult({ YARD_AUTOMATION: 5 })).toBe(1);
    expect(yardSpeedMult({ AI_ROBOTS: 5 })).toBe(1);
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

describe('monthly research recipes', () => {
  it('charges whole resources at every reachable level', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        const cost = RESEARCH_PROJECTS[id].costAt(level);
        expect(cost.alloy).toBeGreaterThan(0);
        expect(cost.crystal).toBeGreaterThan(0);
        for (const value of Object.values(cost)) expect(Number.isSafeInteger(value)).toBe(true);
      }
    }
  });
});
