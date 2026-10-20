import { describe, expect, it } from 'vitest';
import { clipTail } from '../../src/arena/render/effects.js';

/**
 * Owner 2026-10-21: "turbo basınca ateş ışınları geminin arkasına kadar ulaşıyor". A bolt
 * keeps the speed its ship had when it fired; a ship that accelerates afterwards runs
 * into its own tracers. A tail never reaches back past the muzzle plane of the ship.
 */
const forward = { x: 0, y: 0, z: 1 };

describe('own bolt tail', () => {
  it('keeps a tail that ends ahead of the muzzle', () => {
    expect(clipTail({ x: 0, y: 0, z: 200 }, forward, 120, { x: 0, y: 0, z: 10 }, forward)).toBe(120);
  });

  it('cuts a tail at the muzzle plane once the ship has caught up with it', () => {
    expect(clipTail({ x: 0, y: 0, z: 200 }, forward, 180, { x: 0, y: 0, z: 150 }, forward)).toBeCloseTo(50);
  });

  it('measures a converging bolt along the ship, not along the bolt', () => {
    const d = { x: Math.sin(0.5), y: 0, z: Math.cos(0.5) };
    const length = clipTail({ x: 0, y: 0, z: 100 }, d, 300, { x: 0, y: 0, z: 0 }, forward);
    expect(100 - length * d.z).toBeCloseTo(0);
  });

  it('draws nothing for a bolt the ship has already passed', () => {
    expect(clipTail({ x: 0, y: 0, z: 40 }, forward, 120, { x: 0, y: 0, z: 60 }, forward)).toBe(0);
  });

  it('leaves a bolt fired sideways or backwards to its own length cap', () => {
    expect(clipTail({ x: 100, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 46, { x: 0, y: 0, z: 0 }, forward)).toBe(46);
  });
});
