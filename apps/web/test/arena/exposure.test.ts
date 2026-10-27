import { describe, expect, it } from 'vitest';
import { ARENA_EXPOSURE } from '../../src/arena/render/post.js';

/**
 * Owner 2026-10-22: the whole arena read a little dark; everything ~15–20 % brighter. One
 * exposure before the AgX curve lifts the scene and the mirror alike (the HUD is DOM); measured
 * 1.3 → +15–25 % mean frame brightness in open space, at a mouth and inside a room.
 */
describe('arena exposure', () => {
  it('lifts the frame by the owner\'s ~15–20 %, short of washing it out', () => {
    expect(ARENA_EXPOSURE).toBeGreaterThanOrEqual(1.25);
    expect(ARENA_EXPOSURE).toBeLessThanOrEqual(1.35);
  });
});
