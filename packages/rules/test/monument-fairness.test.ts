import { describe, expect, it } from 'vitest';
import {
  MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, monumentTierEligible,
} from '../src/index.js';

describe('Easy and Hard monuments', () => {
  it('deals four of each across a sphere, with each group balanced on its own', () => {
    expect(MONUMENT_SEASON_DEFAULTS.count).toBe(8);
    const positions = MONUMENT_SEASON_DEFAULTS.positions;
    expect(positions).toHaveLength(8);
    for (const position of positions) expect(Math.hypot(position.x, position.y, position.z)).toBeCloseTo(6000);
    expect(new Set(positions.map(position => JSON.stringify(position))).size).toBe(8);
    for (const group of [positions.slice(0, 4), positions.slice(4)]) {
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(group.reduce((sum, position) => sum + position[axis], 0)).toBeCloseTo(0);
        expect(group.every(position => position[axis] !== 0)).toBe(true);
      }
    }
  });

  it('uses the agreed capacity, per-ship damage, total production and neutral fleet', () => {
    expect(MONUMENT_BALANCE.EASY).toMatchObject({ capacity: 1550, radiationLevel: 1, intensityHpPerMinute: 9,
      productionPerMinute: 3, garrison: { STRONGHOLD: 3 } });
    expect(MONUMENT_BALANCE.HARD).toMatchObject({ capacity: 7270, radiationLevel: 2, intensityHpPerMinute: 12.5,
      productionPerMinute: 8, garrison: { LEVIATHAN: 10 } });
    expect(4 * MONUMENT_BALANCE.EASY.productionPerMinute + 4 * MONUMENT_BALANCE.HARD.productionPerMinute).toBe(44);
  });

  it.each(Array.from({ length: 30 }, (_, index) => index + 1))('separates Easy and Hard access at Core 10: Core %i', core => {
    expect(monumentTierEligible('EASY', core)).toBe(core <= 9);
    expect(monumentTierEligible('HARD', core)).toBe(core >= 10);
    expect(monumentTierEligible('LEGACY', core)).toBe(true);
  });

});
