import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { COSMETICS, EFFECT_SKIN_IDS } from '@astera/rules';

it('ships actual product cards and valid model files for every non-planet cosmetic', () => {
  for (const id of EFFECT_SKIN_IDS) {
    const file = readFileSync(resolve('public/assets/images/cosmetics', `${id}.webp`));
    expect(file.toString('ascii', 8, 12), id).toBe('WEBP');
    expect(file.byteLength, id).toBeGreaterThan(1000);
  }
  for (const item of COSMETICS) if (item.model) {
    const path = resolve('public', item.model.slice(1));
    expect(existsSync(path), item.id).toBe(true);
    expect(item.previewModel).toBeTruthy();
    expect(existsSync(resolve('public', item.previewModel!.slice(1)))).toBe(true);
    const file = readFileSync(path);
    expect(file.toString('ascii', 0, 4)).toBe('glTF');
    const jsonLength = file.readUInt32LE(12);
    const gltf = z.object({
      meshes: z.array(z.object({ primitives: z.array(z.object({ indices: z.number() })) })),
      accessors: z.array(z.object({ count: z.number() })),
    }).parse(JSON.parse(file.toString('utf8', 20, 20 + jsonLength)));
    const triangles = gltf.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + gltf.accessors[primitive.indices]!.count / 3, 0);
    expect(triangles, item.id).toBeGreaterThan(item.category === 'PROBE' ? 9000 : 3500);
    expect(triangles, item.id).toBeLessThanOrEqual(item.category === 'PROBE' ? 12000 : 5000);
  }
});

it('organizes ship masters without changing their supplied contents and delivers bounded flight/LOD models', () => {
  const sources = [
    ['red-dragon', 'ce2f63008ef5'], ['scorpion', 'f044d82b0845'],
    ['shark', '50a708c8edb0'], ['stingray', 'ee7046b0c639'],
  ];
  const schema = z.object({
    meshes: z.array(z.object({ primitives: z.array(z.object({ indices: z.number() })) })),
    accessors: z.array(z.object({ count: z.number() })),
    materials: z.array(z.object({ emissiveTexture: z.object({ index: z.number() }), emissiveFactor: z.array(z.number()) })),
    extensionsUsed: z.array(z.string()),
  });
  for (const [name, hash] of sources) {
    const master = readFileSync(resolve('../../assets/source/models/ships/skins', name!, 'model.glb'));
    expect(createHash('sha256').update(master).digest('hex').startsWith(hash!)).toBe(true);
    for (const [variant, limit] of [['', 5000], ['_lod', 3000], ['_preview', 32000]] as const) {
      const file = readFileSync(resolve('public/assets/models/ships/skins', name!, `model${variant}.glb`));
      const gltf = schema.parse(JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12))));
      const triangles = gltf.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + gltf.accessors[primitive.indices]!.count / 3, 0);
      expect(triangles, `${name}${variant}`).toBeLessThanOrEqual(limit);
      expect(gltf.extensionsUsed).not.toContain('KHR_draco_mesh_compression');
      expect(gltf.materials[0]?.emissiveFactor).toEqual([1, 1, 1]);
      expect(file.byteLength).toBeLessThan(variant === '_preview' ? 900_000 : 700_000);
    }
    const card = readFileSync(resolve('public/assets/images/cosmetics/ships', `ship-${name}.webp`));
    expect(card.toString('ascii', 8, 12)).toBe('WEBP');
  }
});
