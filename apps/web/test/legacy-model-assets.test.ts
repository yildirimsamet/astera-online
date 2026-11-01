// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

const root = new URL('../public/assets/legacy/models/meshy-v1/', import.meta.url);
const document = z.object({
  materials: z.array(z.object({
    pbrMetallicRoughness: z.object({ metallicFactor: z.number().optional(), roughnessFactor: z.number().optional(), metallicRoughnessTexture: z.object({ index: z.number() }).optional() }),
    occlusionTexture: z.object({ index: z.number(), texCoord: z.number().optional() }).optional(),
  })),
  meshes: z.array(z.object({ primitives: z.array(z.object({ attributes: z.record(z.number()) })) })),
  images: z.array(z.object({ uri: z.string().optional(), bufferView: z.number().optional() })).optional(),
});

describe('award GLBs keep the surface data required by the actual renderer', () => {
  it('ships nine four-metal families as self-contained GLBs', () => {
    expect(readdirSync(root).filter(file => file.endsWith('.glb'))).toHaveLength(36);
    for (const family of ['honor', 'kupa', 'gezegen', 'roket', 'kazici', 'korsan', 'radyasyon', 'silah_arkadasi', 'anit_tutma']) {
      for (const metal of ['iron', 'bronz', 'silver', 'golden']) {
        const file = `${metal}_${family}.glb`;
        const bytes = readFileSync(new URL(file, root));
        expect(bytes.subarray(0, 4).toString(), file).toBe('glTF');
        expect(bytes.readUInt32LE(4), file).toBe(2);
        expect(bytes.readUInt32LE(8), file).toBe(bytes.length);
        const gltf = document.parse(JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()));
        expect(gltf.materials.some(material => (material.pbrMetallicRoughness.metallicFactor ?? 1) >= 0.9), file).toBe(true);
        for (const material of gltf.materials) {
          const metalness = material.pbrMetallicRoughness.metallicFactor ?? 1;
          expect(metalness, file).toBeGreaterThanOrEqual(0);
          expect(metalness, file).toBeLessThanOrEqual(1);
          const roughnessCeiling = material.pbrMetallicRoughness.metallicRoughnessTexture || metalness < 0.9 ? 1 : 0.4;
          expect(material.pbrMetallicRoughness.roughnessFactor ?? 1, file).toBeLessThanOrEqual(roughnessCeiling);
        }
        for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) expect(primitive.attributes.NORMAL, file).toBeDefined();
        for (const image of gltf.images ?? []) {
          expect(image.uri, file).toBeUndefined();
          expect(image.bufferView, file).toBeDefined();
        }
        if (['radyasyon', 'silah_arkadasi', 'anit_tutma'].includes(family)) {
          for (const material of gltf.materials) expect(material.occlusionTexture?.texCoord, file).toBe(1);
          for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) expect(primitive.attributes.TEXCOORD_1, file).toBeDefined();
        }
      }
    }
  });
});
