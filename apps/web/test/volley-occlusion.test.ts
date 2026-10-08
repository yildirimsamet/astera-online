import { describe, expect, it } from 'vitest';
import { behindTarget } from '../src/galaxy/volley.js';

// Worlds are opaque (owner, 2026-10-08): a raid fired from the far side of its
// target is hidden by that target, like the squadron firing it.
describe('a volley behind the world it strikes', () => {
  const eye = [0, 0, 10] as const;
  const centre = [0, 0, 0] as const;

  it('is hidden when the target stands between the camera and the squadron', () => {
    expect(behindTarget(eye, [0, 0, -3], centre, 1)).toBe(true);
    expect(behindTarget(eye, [0.5, 0.3, -2], centre, 1)).toBe(true);
  });
  it('is shown when the squadron is on the camera side of the target', () => {
    expect(behindTarget(eye, [0, 0, 3], centre, 1)).toBe(false);
  });
  it('is shown when the line of sight passes beside the target', () => {
    expect(behindTarget(eye, [3, 0, -3], centre, 1)).toBe(false);
  });
  it('is hidden for a camera inside the world, and safe for a degenerate sight line', () => {
    expect(behindTarget([0, 0, 0.5], [0, 0, 3], centre, 1)).toBe(true);
    expect(behindTarget([0, 0, 3], [0, 0, 3], centre, 1)).toBe(false);
  });
});
