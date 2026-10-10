import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const models = [
  ['monument_abandoned_space_wreckage', 1, true, false],
  ['monument_abandoned_station', 3, true, true],
  ['monument_ancient_observatory', 3, true, true],
  ['monument_ancient_stargate', 1, true, false],
  ['monument_shattered_world_ship', 3, true, true],
  ['monument_fragmented_dyson_sphere', 1, true, false],
  ['monument_sleeping_guard', 3, true, true],
  ['monument_ancient_war_cemetery', 3, false, false],
] as const;

const textureInfo = z.object({
  index: z.number().int().nonnegative(),
  extensions: z.object({
    KHR_texture_transform: z.object({
      offset: z.tuple([z.number(), z.number()]).optional(),
      scale: z.tuple([z.number(), z.number()]).optional(),
    }).optional(),
  }).optional(),
});
const documentSchema = z.object({
  extensionsRequired: z.array(z.string()),
  accessors: z.array(z.object({ count: z.number().int().positive() })),
  meshes: z.array(z.object({ primitives: z.array(z.object({ indices: z.number().int() })) })),
  images: z.array(z.object({ mimeType: z.string(), bufferView: z.number().int() })),
  bufferViews: z.array(z.object({ byteOffset: z.number().int().default(0), byteLength: z.number().int() })),
  materials: z.array(z.object({
    doubleSided: z.boolean().optional(),
    normalTexture: textureInfo.optional(),
    pbrMetallicRoughness: z.object({
      baseColorTexture: textureInfo,
      metallicRoughnessTexture: textureInfo.optional(),
    }),
  })),
});

function glb(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  const jsonLength = bytes.readUInt32LE(12);
  const document = documentSchema.parse(JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)));
  const binOffset = 20 + jsonLength;
  expect(bytes.readUInt32LE(binOffset + 4)).toBe(0x004e4942);
  return { document, binary: bytes.subarray(binOffset + 8) };
}

function webpDimensions(bytes: Buffer): readonly [number, number] {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  for (let offset = 12; offset + 8 < bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const payload = offset + 8;
    if (kind === 'VP8X') return [bytes.readUIntLE(payload + 4, 3) + 1, bytes.readUIntLE(payload + 7, 3) + 1];
    if (kind === 'VP8 ') return [bytes.readUInt16LE(payload + 6) & 0x3fff, bytes.readUInt16LE(payload + 8) & 0x3fff];
    if (kind === 'VP8L') {
      const packed = bytes.readUInt32LE(payload + 1);
      return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
    }
    const length = bytes.readUInt32LE(offset + 4);
    offset += 8 + length + (length % 2);
  }
  throw new Error('WebP is missing its image header');
}

const served = (name: string) => resolve('public/assets/models/monuments', `${name}.glb`);

describe('monument runtime model budgets', () => {
  it.each(models)('%s preserves its material inside the geometry and texture budgets', (name, textureCount, doubleSided, tiled) => {
    const path = served(name);
    expect(existsSync(path), `Missing optimized monument: ${path}`).toBe(true);
    const { document, binary } = glb(path);
    const triangles = document.meshes.reduce((total, mesh) => total + mesh.primitives.reduce(
      (sum, primitive) => sum + document.accessors[primitive.indices]!.count / 3, 0,
    ), 0);
    // The owner's visual review requested more of the guardian's armour detail.
    // Only this model has a larger geometry budget; its textures stay unchanged.
    const guardian = name === 'monument_sleeping_guard';
    expect(triangles).toBeGreaterThanOrEqual(guardian ? 6_500 : 4_000);
    expect(triangles).toBeLessThanOrEqual(guardian ? 7_500 : 5_000);
    expect(statSync(path).size).toBeLessThanOrEqual(1.3 * 1024 * 1024);
    expect(document.extensionsRequired).toContain('EXT_meshopt_compression');
    expect(document.extensionsRequired).toContain('EXT_texture_webp');
    expect(document.materials).toHaveLength(1);
    expect(document.extensionsRequired).not.toContain('KHR_draco_mesh_compression');
    expect(document.materials[0]?.doubleSided ?? false).toBe(doubleSided);
    expect(document.images).toHaveLength(textureCount);
    for (const image of document.images) {
      expect(image.mimeType).toBe('image/webp');
      const view = document.bufferViews[image.bufferView]!;
      const [width, height] = webpDimensions(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength));
      expect(width).toBeGreaterThanOrEqual(1_024);
      expect(height).toBeGreaterThanOrEqual(1_024);
      expect(Math.max(width, height)).toBeLessThanOrEqual(textureCount === 1 ? 2_048 : 1_536);
    }
    const material = document.materials[0]!;
    if (tiled) {
      for (const info of [
        material.normalTexture,
        material.pbrMetallicRoughness.baseColorTexture,
        material.pbrMetallicRoughness.metallicRoughnessTexture,
      ]) {
        const tiling = info?.extensions?.KHR_texture_transform?.scale;
        expect(tiling).toBeDefined();
        expect(tiling?.[0]).toBeCloseTo(16, 1);
        expect(tiling?.[1]).toBeCloseTo(16, 1);
      }
    }
  });

  it('keeps the eight-model mean near a one-megabyte transfer', () => {
    const bytes = models.reduce((sum, [name]) => sum + statSync(served(name)).size, 0);
    expect(bytes / models.length).toBeLessThanOrEqual(1.1 * 1024 * 1024);
  });
});
