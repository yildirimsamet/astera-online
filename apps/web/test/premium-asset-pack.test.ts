import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ASTEROID_MODELS, ISOTOPE_MODEL, MODEL } from '../src/ui/assets.js';

const glbSchema = z.object({
  skins: z.array(z.unknown()).optional(), animations: z.array(z.unknown()).optional(),
  materials: z.array(z.object({
    emissiveTexture: z.unknown().optional(),
    emissiveFactor: z.array(z.number()).optional(),
    pbrMetallicRoughness: z.object({ baseColorFactor: z.array(z.number()).optional(), metallicFactor: z.number().optional(), roughnessFactor: z.number().optional(), metallicRoughnessTexture: z.unknown().optional() }).optional(),
  })).optional(),
  images: z.array(z.object({ mimeType: z.string() })).optional(),
  accessors: z.array(z.object({ count: z.number() })),
  meshes: z.array(z.object({ primitives: z.array(z.object({
    indices: z.number(), attributes: z.record(z.number()),
  })) })),
});
const served = (url: string): string => resolve('public', url.slice(1));
const document = (url: string) => {
  const bytes = readFileSync(served(url));
  const length = bytes.readUInt32LE(12);
  return glbSchema.parse(JSON.parse(bytes.toString('utf8', 20, 20 + length)));
};
const triangles = (url: string): number => {
  const json = document(url);
  return json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + json.accessors[primitive.indices]!.count / 3, 0);
};

describe('production galaxy reference asset pack', () => {
  it('keeps the accepted native missile static, textured and below 300 triangles', () => {
    expect(MODEL.missile).toContain('premium-v2');
    expect(existsSync(served(MODEL.missile))).toBe(true);
    const json = document(MODEL.missile);
    expect(json.skins ?? []).toHaveLength(0);
    expect(json.animations ?? []).toHaveLength(0);
    expect(json.meshes.flatMap(mesh => mesh.primitives)).toHaveLength(1);
    expect(json.images?.every(image => image.mimeType === 'image/webp')).toBe(true);
    expect(triangles(MODEL.missile)).toBeLessThanOrEqual(300);
    expect(statSync(served(MODEL.missile)).size).toBeLessThan(50_000);
  });

  it('uses native asteroid surfaces and a mineral isotope variant without extra crystal draws', () => {
    for (const url of [...ASTEROID_MODELS, ISOTOPE_MODEL]) {
      const json = document(url);
      expect(json.meshes.flatMap(mesh => mesh.primitives)).toHaveLength(1);
      expect(triangles(url)).toBeLessThanOrEqual(1_400);
      for (const material of json.materials ?? []) {
        expect(material.emissiveTexture).toBeUndefined();
        expect(material.emissiveFactor ?? [0, 0, 0]).toEqual([0, 0, 0]);
        expect(material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).toEqual([1, 1, 1, 1]);
      }
    }
  });

  it('keeps ordinary asteroid bodies opaque, single-primitive and cheaper than the former family', () => {
    expect(ASTEROID_MODELS).toHaveLength(3);
    for (const url of ASTEROID_MODELS) {
      expect(url).toContain('premium-v2');
      expect(triangles(url)).toBeLessThanOrEqual(1_400);
      expect(document(url).meshes.flatMap(mesh => mesh.primitives)).toHaveLength(1);
    }
  });
});
