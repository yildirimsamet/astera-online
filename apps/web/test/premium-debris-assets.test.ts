import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
const FRAGMENT = '/assets/models/debris/wreck-plate-gd-v3.glb';

const schema = z.object({
  accessors: z.array(z.object({ count: z.number() })),
  images: z.array(z.object({ mimeType: z.string() })).optional(),
  materials: z.array(z.object({
    pbrMetallicRoughness: z.object({ baseColorFactor: z.array(z.number()).optional(), baseColorTexture: z.object({ index: z.number().int().nonnegative() }), metallicRoughnessTexture: z.object({ index: z.number().int().nonnegative() }) }),
    normalTexture: z.object({ index: z.number().int().nonnegative() }), occlusionTexture: z.object({ index: z.number().int().nonnegative() }), emissiveTexture: z.unknown().optional(),
  })).optional(),
  meshes: z.array(z.object({ primitives: z.array(z.object({ indices: z.number(), attributes: z.record(z.number()) })) })),
});
const document = (url: string) => {
  const bytes = readFileSync(`public${url}`);
  return schema.parse(JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))));
};
const triangles = (url: string) => {
  const json = document(url);
  return json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + json.accessors[primitive.indices]!.count / 3, 0);
};

describe('Galaxy Division native explosion fragment', () => {
  it('ships the retained textured curved metal plate for impact particles', () => {
    const full = FRAGMENT;
    {
      const json = document(full);
      expect(json.meshes.flatMap(mesh => mesh.primitives)).toHaveLength(1);
      expect(json.materials).toHaveLength(1);
      expect(json.images).toHaveLength(3);
      expect(json.images?.every(image => image.mimeType === 'image/webp')).toBe(true);
      expect(json.materials?.[0]?.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1]).toEqual([1, 1, 1, 1]);
      expect(json.materials?.[0]?.emissiveTexture).toBeUndefined();
      expect(json.meshes[0]?.primitives[0]?.attributes.TEXCOORD_0).toBeDefined();
      // 512px native panel albedo/normal maps retain fracture detail at close zoom.
      expect(statSync(`public${full}`).size).toBeLessThan(300_000);
    }
  });

  it('keeps all strategic and ordinary impact particles within the geometry budget', () => {
    expect(triangles(FRAGMENT)).toBeLessThanOrEqual(160);
    expect(triangles(FRAGMENT) * 28).toBeLessThan(6_000);
    expect(triangles(FRAGMENT) * 6).toBeLessThan(1_000);
  });
});
