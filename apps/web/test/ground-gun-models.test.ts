import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HULL_LOD_MODEL, HULL_MODEL, MODEL_FACING } from '../src/ui/assets.js';

const GUNS = ['BASTION', 'HARPOON', 'THORN'] as const;
const file = (url: string) => resolve(__dirname, `../public${url}`);
/** The JSON chunk of a binary glTF: the scene's nodes, meshes and materials. */
const gltf = (url: string) => {
  const bytes = readFileSync(file(url));
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as { meshes: { primitives: unknown[] }[]; materials: unknown[]; images?: unknown[] };
};

/**
 * THE GROUND GUNS LOOK LIKE GUNS (owner 2026-10-26). They borrowed two spaceship hulls, and the
 * Harpoon wore the Bastion's. Each now has its own low-poly turret, built after its 2D render,
 * drawn up to a hundred at a time as GPU instances on the planet's face.
 */
describe('the ground gun models', () => {
  it('gives each gun its own turret, aimed along +Z like every craft', () => {
    expect(new Set(GUNS.map(id => HULL_MODEL[id])).size).toBe(3);
    for (const id of GUNS) {
      expect(HULL_MODEL[id]).toMatch(/^\/assets\/models\/ground\//);
      expect(HULL_LOD_MODEL[id]).toBe(HULL_MODEL[id]);
      expect(MODEL_FACING[HULL_MODEL[id]]).toBe('+z');
    }
  });

  it.each(GUNS)('keeps %s cheap enough to draw a hundred: one mesh, two materials, no textures, under 250 KB', id => {
    const url = HULL_MODEL[id];
    expect(statSync(file(url)).size).toBeLessThan(250_000);
    const doc = gltf(url);
    expect(doc.meshes).toHaveLength(1);
    expect(doc.meshes[0]!.primitives.length).toBeLessThanOrEqual(2);
    expect(doc.materials.length).toBeLessThanOrEqual(2);
    expect(doc.images ?? []).toHaveLength(0);
  });
});
