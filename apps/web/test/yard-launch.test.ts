import { describe, expect, it } from 'vitest';
import { YARD_LAUNCH, yardLaunchAt } from '../src/galaxy/yardLaunch.js';

/**
 * THE CRAFT A REPAIR HANDS OVER (plan 2026-11-18 §5 A11; owner phone playtest 2026-11-18, item 8). Out of
 * the cargo bay, round to a station beside the hull with the nose forward, a breath there, then back into
 * the bay where it is kept: "where are my ships going?" is answered by the ship itself.
 */
const BAY = [0.09, -0.069, 0.025] as const;
const SLOT = [0.32, -0.14, 0.26] as const;
const near = (a: readonly number[], b: readonly number[]) => { a.forEach((value, i) => { expect(value).toBeCloseTo(b[i] ?? NaN, 3); }); };

describe('the first ships out of the yard', () => {
  it('comes out of the bay itself', () => {
    near(yardLaunchAt(BAY, SLOT, 0).at, BAY);
  });

  it('takes its station beside the hull, nose forward, and holds it', () => {
    const settled = yardLaunchAt(BAY, SLOT, YARD_LAUNCH.out);
    near(settled.at, SLOT);
    const later = yardLaunchAt(BAY, SLOT, YARD_LAUNCH.out + YARD_LAUNCH.hold * 0.9);
    near(later.at, SLOT);
    expect(later.facing[0]).toBeGreaterThan(0.99);
  });

  it('moves without a jump from the bay to its station and on', () => {
    let last = yardLaunchAt(BAY, SLOT, 0).at;
    for (let t = 0.05; t <= YARD_LAUNCH.total; t += 0.05) {
      const now = yardLaunchAt(BAY, SLOT, t).at;
      expect(Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2]), `t=${t.toFixed(2)}`).toBeLessThan(0.2);
      last = now;
    }
  });

  it('goes back into the bay at the end, nose toward it, and is kept there', () => {
    const turning = yardLaunchAt(BAY, SLOT, YARD_LAUNCH.out + YARD_LAUNCH.hold + 0.3);
    const toBay = [BAY[0] - turning.at[0], BAY[1] - turning.at[1], BAY[2] - turning.at[2]];
    const length = Math.hypot(toBay[0]!, toBay[1]!, toBay[2]!);
    expect(turning.facing.reduce((sum, value, i) => sum + value * toBay[i]! / length, 0)).toBeGreaterThan(0.5);
    near(yardLaunchAt(BAY, SLOT, YARD_LAUNCH.total).at, BAY);
    near(yardLaunchAt(BAY, SLOT, YARD_LAUNCH.total + 5).at, BAY);
  });
});
