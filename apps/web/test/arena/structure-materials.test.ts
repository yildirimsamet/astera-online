import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shareMaterials, type ModelPart, type PreparedModel } from '../../src/arena/assets/load.js';

/**
 * V6d: every kit piece ships the same station material with its own copy of the textures. A
 * building is dozens of pieces; drawn as loaded, a phone would upload one texture set per piece.
 */
const part = (name: string): ModelPart => {
  const material = new THREE.MeshStandardMaterial({ name });
  material.map = new THREE.Texture();
  return { geometry: new THREE.BufferGeometry(), material, glow: false };
};
const model = (...parts: ModelPart[]): PreparedModel => ({ parts, radius: 1, mean: 1, size: new THREE.Vector3(), engines: [] });

describe('shared structure materials', () => {
  it('gives every model the first material of the same name, levels of detail included', () => {
    const a = model(part('kit'));
    a.lods = [model(part('kit'))];
    const b = model(part('kit'), part('own'));
    shareMaterials([a, b]);
    const kit = a.parts[0]?.material;
    expect(a.lods[0]?.parts[0]?.material).toBe(kit);
    expect(b.parts[0]?.material).toBe(kit);
    expect(b.parts[1]?.material).not.toBe(kit);
  });

  it('keeps unnamed materials apart', () => {
    const a = model(part(''));
    const b = model(part(''));
    shareMaterials([a, b]);
    expect(b.parts[0]?.material).not.toBe(a.parts[0]?.material);
  });
});

