import { describe, expect, it } from 'vitest';
import {
  orbitStandoff,
  surfaceStandoff,
  toWorld,
  visualLeg,
  type Vec3,
} from '../src/index.js';

const gap = (a: Vec3, b: Vec3): number => {
  const left = toWorld(a);
  const right = toWorld(b);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
};

describe('the shared visual leg', () => {
  it('uses tight surface clearance rather than the wider orbital hold', () => {
    expect(surfaceStandoff(1.4)).toBeCloseTo(1.61, 8);
    expect(surfaceStandoff(1.4)).toBeLessThan(orbitStandoff(1.4));
  });

  it('bakes both endpoint clearances into one straight leg in world space', () => {
    const from = { x: -400, y: -60, z: 20 };
    const to = { x: 600, y: 90, z: -130 };
    const start = surfaceStandoff(0.82);
    const end = orbitStandoff(1.4);
    const drawn = visualLeg(from, to, start, end);

    expect(gap(from, drawn.from)).toBeCloseTo(start, 8);
    expect(gap(to, drawn.to)).toBeCloseTo(end, 8);
    expect(gap(drawn.from, drawn.to)).toBeGreaterThan(0);
  });

  it('never reverses a very short leg when both ends need clearance', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 10, y: 0, z: 0 };
    const drawn = visualLeg(from, to, 40, 40);
    const start = toWorld(drawn.from)[0];
    const end = toWorld(drawn.to)[0];

    expect(start).toBeLessThanOrEqual(end);
    expect(start).toBeCloseTo(end, 8);
  });
});
