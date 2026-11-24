import { describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import {
  moonClearStagingDirection,
  moonFlashProgress,
  moonOrbitPosition,
  moonRadiusFor,
  moonRarityRimColor,
} from '../src/galaxy/moonOrbit.js';

describe('moon 3D orbit & visual rules (F9d)', () => {
  it('computes deterministic orbital coordinates around the parent planet', () => {
    const out1 = { x: 0, y: 0, z: 0 };
    const out2 = { x: 0, y: 0, z: 0 };
    const parent = { x: 100, y: 20, z: -50 };
    moonOrbitPosition(parent, 12, 42, 1_000, out1);
    moonOrbitPosition(parent, 12, 42, 1_000, out2);
    expect(out1).toEqual(out2);

    const dx = out1.x - parent.x;
    const dy = out1.y - parent.y;
    const dz = out1.z - parent.z;
    const dist = Math.hypot(dx, dy, dz);
    expect(dist).toBeGreaterThan(12 * 2.4);
    expect(dist).toBeLessThan(12 * 3.0);

    // Advances along orbit over time.
    const later = { x: 0, y: 0, z: 0 };
    moonOrbitPosition(parent, 12, 42, 1_040, later);
    expect(later.x).not.toBeCloseTo(out1.x, 3);
  });

  it('lights no limb for an unknown rarity (V17) and distinct colors for each known rarity', () => {
    expect(moonRarityRimColor(undefined)).toBeNull();
    const colors = new Set([
      moonRarityRimColor('COMMON'),
      moonRarityRimColor('RARE'),
      moonRarityRimColor('EPIC'),
      moonRarityRimColor('LEGENDARY'),
    ]);
    expect(colors.size).toBe(4);
    expect(colors.has(null)).toBe(false);
  });

  it('scales moon radius proportionally to the parent planet', () => {
    const r = moonRadiusFor(10, 'COMMON');
    expect(r).toBeGreaterThan(2);
    expect(r).toBeLessThan(4);
  });

  it('deflects staging direction away from parent planet + Dyson shell when moon sits on far hemisphere', () => {
    const parent = { x: 0, y: 0, z: 0 };
    const moon = { x: -30, y: 0, z: 0 };
    const target = { x: 200, y: 0, z: 0 }; // straight line passes right through planet at (0,0,0)!
    const dir = { x: 0, y: 0, z: 0 };
    moonClearStagingDirection(parent, 10, moon, target, dir);
    // Must stay normalized and deflect away from the +X planet axis
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 4);
    expect(Math.hypot(dir.y, dir.z)).toBeGreaterThan(0.4);

    // When target is on the clear side of the moon, direction points straight at target
    const clearTarget = { x: -200, y: 0, z: 0 };
    moonClearStagingDirection(parent, 10, moon, clearTarget, dir);
    expect(dir.x).toBeCloseTo(-1, 4);
    expect(dir.y).toBeCloseTo(0, 4);
    expect(dir.z).toBeCloseTo(0, 4);
  });

  it('tracks gate flash lifetime over MOON.flashSeconds and expires cleanly', () => {
    const at = 100_000;
    expect(moonFlashProgress(at, at)).toBeCloseTo(0, 5);
    expect(moonFlashProgress(at, at + (MOON.flashSeconds * 500))).toBeCloseTo(0.5, 2);
    expect(moonFlashProgress(at, at + MOON.flashSeconds * 1_000 + 1)).toBeNull();
    expect(moonFlashProgress(at, at - 1_000)).toBeNull();
  });
});
