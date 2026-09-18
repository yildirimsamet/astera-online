import { describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  HANGAR,
  HULLS,
  START_BUILDINGS,
  academyExitCheckpoint,
  ACADEMY_STEPS,
  alloyRate,
  buildingCost,
  crystalRate,
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
describe('Hangar ceiling by Command Core', () => {
  it.each([
    [1, 1], [3, 1],
    [4, 2], [6, 2],
    [7, 3], [9, 3],
    [10, 4], [12, 4],
    [13, 5], [15, 5],
    [16, HANGAR.maxLevel], [30, HANGAR.maxLevel],
  ])('Core %i allows Hangar %i', (core, hangar) => {
    expect(hangarCeiling(core)).toBe(hangar);
  });

  it('allows nothing on a world with no Core', () => {
    expect(hangarCeiling(0)).toBe(0);
  });

  it('seeds a live world at the rung its Core opened, never at a purchased one', () => {
    expect(hangarSeedLevel(1)).toBe(1);
    expect(hangarSeedLevel(5)).toBe(2);
    expect(hangarSeedLevel(11)).toBe(4);
    expect(hangarSeedLevel(16)).toBe(6);
    expect(hangarSeedLevel(25)).toBe(6);
  });

  it('opens rungs seven to ten only to a Core-16 world', () => {
    expect(HANGAR.maxLevel).toBe(10);
    expect(hangarCeiling(15)).toBe(5);
    expect(hangarCeiling(16)).toBe(10);
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

  /**
   * THE LADDER IS DERIVED, THEN FROZEN. Each rung is what the producer pair at the
   * gate Core buys in combat hulls over the owner's day count (2, 3, 5, 8, 12, then
   * 17/23/30/38 past Core 16), deuterium ignored. A retune of the producers must
   * fail here rather than silently move every fleet ceiling in the galaxy.
   */
  it('stays within 5% of the production it was derived from', () => {
    const combat = Object.values(HULLS).filter(
      (h) => !h.ground && (h.family === 'OFFENSIVE' || h.family === 'DEFENSIVE'),
    );
    const derive = (core: number, days: number, tiers: number[]): number => {
      const hs = combat.filter((h) => h.tier !== null && tiers.includes(h.tier));
      const cost = hs.reduce((s, h) => s + h.alloy + h.crystal, 0) / hs.length;
      const bulk = hs.reduce((s, h) => s + hullBulk(h.id), 0) / hs.length;
      return ((alloyRate(core) + crystalRate(core)) * 24 * days / cost) * bulk;
    };
    const plan: [number, number, number, number[]][] = [
      [1, 3, 1, [1]],
      [2, 4, 2, [1, 2]],
      [3, 7, 3, [2]],
      [4, 10, 5, [2, 3]],
      [5, 13, 8, [3]],
      [6, 16, 12, [3, 4]],
      [7, 16, 17, [3, 4]],
      [8, 16, 23, [3, 4]],
      [9, 16, 30, [3, 4]],
      [10, 16, 38, [3, 4]],
    ];
    for (const [level, core, days, tiers] of plan) {
      const derived = derive(core, days, tiers);
      expect(Math.abs(hangarCapacity(level) - derived) / derived).toBeLessThan(0.05);
    }
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

  it('costs more at every rung, and far more past the Core gates', () => {
    const prices = Array.from({ length: HANGAR.maxLevel }, (_, level) =>
      totalOf(buildingCost('HANGAR', level)));
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]!);
    // Rung 7 costs at least twice rung 6: the purchased rungs are a luxury, not a step.
    expect(prices[6]!).toBeGreaterThan(prices[5]! * 2);
  });

  // Owner decision, 2026-09-18: 1.25× the Core upgrade that opens the rung (was 2×).
  it('costs a quarter more than the Core upgrade that opens it', () => {
    for (let rung = 2; rung <= 6; rung++) {
      const gate = HANGAR.coreGate[rung]!;
      const hangar = buildingCost('HANGAR', rung - 1);
      const core = buildingCost('CORE', gate - 1);
      // Invoices round up per resource, so allow one unit either way.
      expect(Math.abs(hangar.alloy - core.alloy * 1.25)).toBeLessThanOrEqual(1);
      expect(Math.abs(hangar.crystal - core.crystal * 1.25)).toBeLessThanOrEqual(1);
    }
  });
});
