import { describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import {
  moonFlashProgress,
  moonOrbitPosition,
  moonRadiusFor,
  moonRarityRingColor,
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
    expect(dist).toBeGreaterThan(12 * 1.6);
    expect(dist).toBeLessThan(12 * 3.0);

    // Advances along orbit over time.
    const later = { x: 0, y: 0, z: 0 };
    moonOrbitPosition(parent, 12, 42, 1_040, later);
    expect(later.x).not.toBeCloseTo(out1.x, 3);
  });

  it('draws no ring for unknown rarity (V17) and distinct colors for each known rarity', () => {
    expect(moonRarityRingColor(undefined)).toBeNull();
    const colors = new Set([
      moonRarityRingColor('COMMON'),
      moonRarityRingColor('RARE'),
      moonRarityRingColor('EPIC'),
      moonRarityRingColor('LEGENDARY'),
    ]);
    expect(colors.size).toBe(4);
    expect(colors.has(null)).toBe(false);
  });

  it('scales moon radius proportionally to the parent planet', () => {
    const r = moonRadiusFor(10, 'COMMON');
    expect(r).toBeGreaterThan(2);
    expect(r).toBeLessThan(4);
  });

  it('tracks gate flash lifetime over MOON.flashSeconds and expires cleanly', () => {
    const at = 100_000;
    expect(moonFlashProgress(at, at)).toBeCloseTo(0, 5);
    expect(moonFlashProgress(at, at + (MOON.flashSeconds * 500))).toBeCloseTo(0.5, 2);
    expect(moonFlashProgress(at, at + MOON.flashSeconds * 1_000 + 1)).toBeNull();
    expect(moonFlashProgress(at, at - 1_000)).toBeNull();
  });
});
