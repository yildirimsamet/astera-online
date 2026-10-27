// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const directory = new URL('../public/assets/vfx/engine-flames/', import.meta.url);
describe('engine flame asset budget', () => {
  it('ships a tiny seamless noise map and four original GLB reference volumes', () => {
    const files = readdirSync(directory);
    expect(files.filter(file => file.endsWith('.glb')).sort()).toEqual(['cryo.glb', 'siege.glb', 'solar.glb', 'vacuum.glb']);
    expect(files.reduce((sum, file) => sum + statSync(new URL(file, directory)).size, 0)).toBeLessThan(200 * 1024);
    const png = readFileSync(new URL('flow-noise.png', directory));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([128, 128]);
    for (const id of ['solar', 'cryo', 'vacuum', 'siege']) {
      const glb = readFileSync(new URL(`${id}.glb`, directory));
      expect(glb.subarray(0, 4).toString()).toBe('glTF');
      expect(glb.readUInt32LE(4)).toBe(2);
      expect(glb.readUInt32LE(8)).toBe(glb.length);
      const document = z.object({ accessors: z.array(z.object({
        type: z.string(), min: z.array(z.number()).optional(),
      })) }).parse(JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()));
      const zMin = Math.min(...document.accessors.filter(a => a.type === 'VEC3' && a.min).map(a => a.min![2]!));
      expect(zMin).toBeCloseTo(id === 'vacuum' ? -2.7 : -3, 5);
    }
  });
});
