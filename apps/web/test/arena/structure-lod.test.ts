import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PreparedModel } from '../../src/arena/assets/load.js';
import { fogDensity, STRUCTURE_FADE, structureLevels } from '../../src/arena/render/stage.js';

/**
 * V6d: the Rift has ~90 kit pieces. Past the distance where the fog has swallowed a structure,
 * drawing it is a draw call for nothing; on a phone those calls are the frame.
 */
const model = (): PreparedModel => ({
  parts: [{ geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial(), glow: false }],
  radius: 100, mean: 80, size: new THREE.Vector3(), engines: [],
});

describe('structure levels of detail', () => {
  it('draws nothing where the clear-space fog has hidden it', () => {
    expect(Math.exp(-((STRUCTURE_FADE * fogDensity(0, 0)) ** 2))).toBeLessThan(0.03);
    const lod = structureLevels({ ...model(), lods: [model(), model()] });
    expect(lod.getObjectForDistance(STRUCTURE_FADE + 1)?.children).toHaveLength(0);
    expect(lod.getObjectForDistance(STRUCTURE_FADE - 1)?.children.length).toBeGreaterThan(0);
    expect(lod.getObjectForDistance(10)?.children.length).toBeGreaterThan(0);
  });

  // Owner 2026-10-22: the swap to a coarser level happened ~160 m out, in plain sight while
  // flying through a building, and the coarse kit levels show hairline holes (black cracks).
  it('keeps the full model until a piece is small on screen, and does not flicker at the swap', () => {
    const lod = structureLevels({ ...model(), radius: 64, lods: [model(), model()] });
    expect(lod.levels[1]?.distance).toBeGreaterThanOrEqual(900);
    expect(lod.levels[2]?.distance).toBeGreaterThanOrEqual(2000);
    expect(lod.levels[2]?.distance).toBeLessThan(STRUCTURE_FADE);
    expect(lod.levels.slice(1, -1).every(level => level.hysteresis > 0)).toBe(true);
    const big = structureLevels({ ...model(), radius: 235, lods: [model(), model()] });
    expect(big.levels[1]?.distance).toBeGreaterThan(lod.levels[1]?.distance ?? Infinity);
  });
});
