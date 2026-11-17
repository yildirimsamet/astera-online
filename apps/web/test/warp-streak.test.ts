import { describe, expect, it } from 'vitest';
import { warpStreak } from '../src/galaxy/warpStreak.js';

/**
 * A SHIP LEAVING ON ITS JUMP (owner 2026-11-18: no round flash). The ship stretches forward into a
 * thin line of light along its heading and snaps out: longer and thinner as it goes, gone at the end.
 */
describe('the jump\'s streak', () => {
  it('is not there before the jump, and is gone after it', () => {
    expect(warpStreak(0).fade).toBe(0);
    expect(warpStreak(1).fade).toBe(0);
    expect(warpStreak(1).width).toBe(0);
  });

  it('stretches ahead and thins as the ship goes', () => {
    const early = warpStreak(0.2), late = warpStreak(0.8);
    expect(late.length).toBeGreaterThan(early.length);
    expect(late.width).toBeLessThan(early.width);
    expect(early.fade).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(5 * warpStreak(0.01).length);
  });
});
