import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STRUCTURE_CATALOG } from '@astera/rules/arena';
import { describe, expect, it } from 'vitest';

/**
 * V6g, 2026-10-22: the S22's 32-bit renderer died loading the Rift. Its structure maps were webp,
 * decoded to full RGBA: ~745 MB, the 17 kit pieces each carrying their own copy of the kit's four
 * maps. A KTX2 map stays block-compressed (tools/arena-ktx2.mjs `glbs`).
 */
const DIR = join(__dirname, '../../public/assets/arena/yarik');

interface Gltf { extensionsUsed?: string[]; extensionsRequired?: string[]; images?: { mimeType?: string; bufferView?: number }[];
  textures?: { source?: number; extensions?: Record<string, { source?: number }> }[]; bufferViews?: { byteOffset?: number; byteLength: number }[] }

function glb(key: string): { json: Gltf; bin: Buffer } {
  const file = readFileSync(join(DIR, `${key}.glb`));
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf;
  return { json, bin: file.subarray(20 + jsonLength + 8) };
}

/** Bytes the GPU holds for one KTX2 map: ETC1S lands as ETC2 RGB (half a byte a pixel), UASTC as ASTC 4×4 (one). */
function gpuBytes(ktx: Buffer): number {
  // «KTX 20»: anything else (a webp) has no such header to read.
  if (ktx.subarray(1, 7).toString('latin1') !== 'KTX 20') return Infinity;
  const width = ktx.readUInt32LE(20); const height = ktx.readUInt32LE(24);
  const levels = Math.max(1, ktx.readUInt32LE(40)); const etc1s = ktx.readUInt32LE(44) === 1;
  let bytes = 0;
  for (let level = 0; level < levels; level++) bytes += Math.max(16, Math.ceil(width / 2 ** level) * Math.ceil(height / 2 ** level) * (etc1s ? 0.5 : 1));
  return bytes;
}

describe('the Rift structure maps', () => {
  it('are KTX2 in every structure, the extension required, no webp left', () => {
    for (const { key } of STRUCTURE_CATALOG) {
      const { json } = glb(key);
      expect(json.extensionsRequired, key).toContain('KHR_texture_basisu');
      expect(json.extensionsUsed ?? [], key).not.toContain('EXT_texture_webp');
      expect(json.images?.every(image => image.mimeType === 'image/ktx2'), key).toBe(true);
      expect(json.textures?.every(texture => texture.extensions?.KHR_texture_basisu?.source !== undefined), key).toBe(true);
    }
  });

  it('carry their mips and fit a phone: under 200 MB on the GPU, every piece loaded', () => {
    let total = 0;
    for (const { key } of STRUCTURE_CATALOG) {
      const { json, bin } = glb(key);
      for (const image of json.images ?? []) {
        const view = json.bufferViews?.[image.bufferView ?? -1];
        if (!view) throw new Error(`${key}: image without a buffer view`);
        const ktx = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
        total += gpuBytes(ktx);
        expect(ktx.readUInt32LE(40), key).toBeGreaterThan(1);
      }
    }
    expect(total / 1048576).toBeLessThan(200);
  });
});
