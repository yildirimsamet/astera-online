import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  HANGAR,
  START_BUILDINGS,
  academyExitCheckpoint,
  ACADEMY_STEPS,
  buildingCost,
  hangarCapacity,
  hangarCeiling,
  hangarLoad,
  hangarSeedLevel,
  hullBulk,
  type HullId,
  type Resources,
} from '../src/index.js';

const totalOf = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

/**
 * THE HANGAR CAME BACK, AND ITS RUNGS ARE THE CORE'S TIERS. 2026-09-18.
 *
 * Owner instruction: commanders kept their Command Core low to stay inside the
 * beginners' tier band and printed an unbounded fleet there. The Hangar bounds a
 * world's fleet, and its rungs open only at the Core levels where a development
 * tier changes (4, 7, 10, 13, 16) — so staying small now also means staying few.
 */
/**
 * THE CORE NO LONGER GATES THE HANGAR. Owner decision, 2026-09-22.
 *
 * This suite held the gate rung by rung — Core 4 allows Hangar 2, Core 16 opens the top four — and
 * that rule is gone: *"tier atlamadan bir kullanıcı filocu olabilmeli."* Its replacement, with the
 * measurement that made removing it safe, is `hangar-free-of-core.test.ts`.
 *
 * What survives here is SEEDING, which was always a different question: a neutral template and a
 * migrating world are GIVEN a rung nobody paid for, so that one is still sized to the Core.
 */
describe('what a world is handed, rather than what it may buy', () => {
  it('seeds a live world at the rung its Core opened, never at a purchased one', () => {
    expect(hangarSeedLevel(1)).toBe(1);
    expect(hangarSeedLevel(5)).toBe(2);
    expect(hangarSeedLevel(11)).toBe(4);
    expect(hangarSeedLevel(16)).toBe(6);
    expect(hangarSeedLevel(25)).toBe(6);
  });

  it('never seeds a purchased rung, however developed the world is', () => {
    for (const core of [1, 4, 16, 30, 99]) {
      expect(hangarSeedLevel(core), `core ${String(core)}`).toBeLessThanOrEqual(HANGAR.seedTop);
    }
  });

  it('seeds nothing on a world with no Core', () => {
    expect(hangarSeedLevel(0)).toBe(0);
  });

  /** And the ladder itself still ends where it ended. */
  it('keeps ten rungs', () => {
    expect(HANGAR.maxLevel).toBe(10);
    expect(hangarCeiling(1)).toBe(HANGAR.maxLevel);
  });
});

describe('Hangar capacity', () => {
  it('is the frozen owner ladder, in room', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(hangarCapacity)).toEqual([
      80, 180, 470, 810, 1550, 2290, 3250, 4400, 5740, 7270,
    ]);
  });

  it('never falls below the base, and never exceeds the top rung', () => {
    expect(hangarCapacity(0)).toBe(80);
    expect(hangarCapacity(-3)).toBe(80);
    expect(hangarCapacity(99)).toBe(7270);
  });

  it('holds every fleet the Academy can hand a new commander', () => {
    for (let step = 0; step <= ACADEMY_STEPS.length; step++) {
      expect(hangarLoad(academyExitCheckpoint(step).fleet)).toBeLessThanOrEqual(hangarCapacity(1));
    }
  });
});

describe('Hangar load', () => {
  it('charges every flying hull its bulk, and no gun', () => {
    expect(hangarLoad({ DART: 3, TEMPEST: 2, THORN: 5, BASTION: 1 }))
      .toBe(3 * hullBulk('DART') + 2 * hullBulk('TEMPEST'));
  });

  it('counts the craft that do not fight, because they still take a berth', () => {
    const craft: HullId[] = ['PROSPECTOR', 'COURIER', 'GARBAGE_COLLECTOR'];
    for (const id of craft) expect(hangarLoad({ [id]: 1 })).toBe(hullBulk(id));
  });

  it('is zero for an empty or ground-only fleet', () => {
    expect(hangarLoad({})).toBe(0);
    expect(hangarLoad({ THORN: 4 })).toBe(0);
  });
});

describe('Hangar as a building', () => {
  it('is a building every new world starts with at its base rung', () => {
    expect(BUILDING_IDS).toContain('HANGAR');
    expect(START_BUILDINGS.HANGAR).toBe(1);
  });

  /**
   * STILL RISING, BUT NO LONGER A LUXURY LADDER. Owner decision, 2026-09-22, plan 2B.3.
   *
   * Rung 7 used to cost more than twice rung 6, and the top rung cost a third MORE than every ship
   * it could hold while a commander's whole store was a fraction of the price — so the ladder
   * above the gates was not expensive, it was unbuyable. The late rungs are now a third of the
   * fleet they make room for, which still rises with the room but rises WITH it rather than away
   * from it. `hangar-price.test.ts` holds the rule and the pacing it leaves behind.
   */
  it('costs more at every rung', () => {
    const prices = Array.from({ length: HANGAR.maxLevel }, (_, level) =>
      totalOf(buildingCost('HANGAR', level)));
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]!);
  });

  /**
   * THE SEEDED RUNGS KEEP THE PRICE THE OWNER SET. 2026-09-18 (a quarter over the Core stage that
   * opened them), narrowed 2026-09-22.
   *
   * It used to be read off the live Core invoice. Two things have since cut that tie: 2B.6 took the
   * Hangar off the Core gate, and Faz 4.1 moved the Core onto the producer curve — a Core rung is
   * now a fraction of what it was. The Hangar is not part of that decision, so its seeded rungs are
   * held at the figures the owner priced, where a Core reprice cannot move them silently.
   */
  it('keeps the seeded rungs at the price the owner set', () => {
    expect(buildingCost('HANGAR', 1)).toEqual({ alloy: 556, crystal: 150, deuterium: 0 });
    expect(buildingCost('HANGAR', 2)).toEqual({ alloy: 2260, crystal: 609, deuterium: 0 });
    expect(buildingCost('HANGAR', 3)).toEqual({ alloy: 8548, crystal: 2302, deuterium: 0 });
    expect(buildingCost('HANGAR', 4)).toEqual({ alloy: 31324, crystal: 8434, deuterium: 0 });
  });
});
