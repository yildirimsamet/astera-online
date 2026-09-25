import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cachedDress, cachedGeometry } from '../src/galaxy/PlanetSkinModel.js';

/**
 * A LOOK'S TIER IS BUILT ONCE A SESSION (code review, 2026-09-25). A fast zoom empties a
 * tier's group and fills it again; each refill used to remount it from scratch — the
 * unit geometry copied attribute by attribute, the material cloned, a new program
 * looked up. The geometry is kept per model file and the dressed material per file and
 * dress, so a remount is a count and a few matrices.
 */
const mesh = () => new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshStandardMaterial());

describe('a model file’s geometry', () => {
  it('is built once per file and handed back after', () => {
    const a = cachedGeometry('/m/one.glb', mesh());
    expect(cachedGeometry('/m/one.glb', mesh())).toBe(a);
    expect(cachedGeometry('/m/two.glb', mesh())).not.toBe(a);
  });

  it('is normalised to a unit sphere', () => {
    const geometry = cachedGeometry('/m/three.glb', mesh());
    expect(geometry.boundingSphere?.radius).toBeCloseTo(1);
  });
});

describe('a dressed material', () => {
  it('is dressed once per file and dress', () => {
    const source = new THREE.MeshStandardMaterial();
    let dressed = 0;
    const dress = (from: THREE.Material) => {
      dressed += 1;
      return { material: from.clone(), uniforms: null };
    };
    const a = cachedDress('/m/one.glb', 'lite', source, dress);
    expect(cachedDress('/m/one.glb', 'lite', source, dress)).toBe(a);
    expect(cachedDress('/m/one.glb', 'full', source, dress)).not.toBe(a);
    expect(dressed).toBe(2);
  });

  it('is never disposed with a mesh that goes away', () => {
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).not.toMatch(/geometry\?\.dispose\(\)/);
    expect(model).not.toMatch(/dressed\?\.material\.dispose\(\)/);
  });
});
