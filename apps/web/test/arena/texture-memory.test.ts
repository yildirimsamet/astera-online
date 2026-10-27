import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emptyArenaAssets, type PreparedModel } from '../../src/arena/assets/load.js';
import { assetTextureBytes, compressedSupport, textureBytes, TRANSCODER_PATH, TRANSCODER_PROBE } from '../../src/arena/assets/memory.js';

interface Ktx2File { isValid(): boolean; getWidth(): number; isUASTC(): boolean; startTranscoding(): number; close(): void; delete(): void }
interface BasisModule { initializeBasis(): void; KTX2File: new (bytes: Uint8Array) => Ktx2File }
type BasisFactory = (options: { wasmBinary: ArrayBuffer }) => Promise<BasisModule>;
const isBasisFactory = (value: unknown): value is BasisFactory => typeof value === 'function';

/**
 * Y3 gate (plan 14 §17): an iPhone holds at most 120 MB of arena textures on the GPU. The
 * arena counts what it uploaded, so the figure is measured, not estimated by hand.
 */
const compressed = (size: number, bytesPerTexel: number): THREE.CompressedTexture => {
  const mipmaps = [];
  for (let s = size; s >= 1; s = Math.floor(s / 2)) mipmaps.push({ data: new Uint8Array(Math.max(16, s * s * bytesPerTexel)), width: s, height: s });
  return new THREE.CompressedTexture(mipmaps, size, size);
};

describe('texture memory', () => {
  it('counts a compressed texture by the bytes of its levels', () => {
    const texture = compressed(1024, 1);
    const expected = texture.mipmaps.reduce((sum, level) => sum + ('data' in level ? level.data.byteLength : 0), 0);
    expect(textureBytes(texture)).toBe(expected);
    expect(textureBytes(texture)).toBeGreaterThan(1024 * 1024);
    expect(textureBytes(texture)).toBeLessThan(1024 * 1024 * 1.4);
  });

  it('counts an image texture as RGBA, a third more with mips, six faces for a cube', () => {
    const image = { width: 512, height: 256 };
    const plain = new THREE.Texture(image); plain.generateMipmaps = false; plain.minFilter = THREE.LinearFilter;
    expect(textureBytes(plain)).toBe(512 * 256 * 4);
    const mipped = new THREE.Texture(image);
    expect(textureBytes(mipped)).toBe(Math.round(512 * 256 * 4 * 4 / 3));
    const cube = new THREE.CubeTexture(Array.from({ length: 6 }, () => ({ width: 64, height: 64 })));
    cube.generateMipmaps = false; cube.minFilter = THREE.LinearFilter;
    expect(textureBytes(cube)).toBe(64 * 64 * 4 * 6);
  });

  it('counts a texture with no image yet as nothing', () => {
    expect(textureBytes(new THREE.Texture())).toBe(0);
  });

  it('adds up every texture the arena holds once, however many materials and levels share it', () => {
    const shared = compressed(256, 1);
    const material = new THREE.MeshStandardMaterial({ map: shared, roughnessMap: shared, metalnessMap: shared });
    const model = (): PreparedModel => ({ parts: [{ geometry: new THREE.BufferGeometry(), material, glow: false }], radius: 1, mean: 1, size: new THREE.Vector3(1, 1, 1), engines: [] });
    const assets = emptyArenaAssets();
    const ship = model(); ship.lods = [model(), model()];
    assets.classes.set('akinci', ship);
    assets.hero = model();
    const glow = compressed(64, 1);
    assets.fx.set('glow', glow);
    expect(assetTextureBytes(assets)).toBe(textureBytes(shared) + textureBytes(glow));
  });
});

describe('compressed formats', () => {
  it('asks the GPU which block formats it decodes', () => {
    const has = new Set(['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc']);
    const config = compressedSupport({ getExtension: (name: string) => (has.has(name) ? {} : null) });
    expect(config.astcSupported).toBe(true);
    expect(config.etc2Supported).toBe(true);
    expect(config.dxtSupported).toBe(false);
    expect(config.bptcSupported).toBe(false);
  });

  it('falls back to plain RGBA when there is no GPU to ask', () => {
    const config = compressedSupport(null);
    expect(Object.values(config).every(v => v === false)).toBe(true);
  });

  it('serves three\'s basis wasm byte for byte', () => {
    const basis = dirname(createRequire(import.meta.url).resolve('three/examples/jsm/libs/basis/basis_transcoder.js'));
    const ours = join(import.meta.dirname, '../../public', TRANSCODER_PATH);
    expect(readFileSync(join(ours, 'basis_transcoder.wasm')).equals(readFileSync(join(basis, 'basis_transcoder.wasm')))).toBe(true);
  });

  // Stage 2026-10-27: the page's CSP has no 'unsafe-eval' and the KTX2 worker inherits it. Three's
  // glue builds its call wrappers with `new Function`, so every device fell back to the webp pack.
  // A context that refuses code from strings is that CSP; no `process` makes the glue run as in a worker.
  it('serves a transcoder that starts and transcodes where code from strings is refused', async () => {
    const ours = join(import.meta.dirname, '../../public', TRANSCODER_PATH);
    const csp = createContext({ TextDecoder, console }, { codeGeneration: { strings: false, wasm: true } });
    const factory: unknown = runInContext(`${readFileSync(join(ours, 'basis_transcoder.js'), 'utf8')}\nBASIS`, csp);
    if (!isBasisFactory(factory)) throw new Error('basis_transcoder.js defines no BASIS factory');
    const wasm = readFileSync(join(ours, 'basis_transcoder.wasm'));
    const basis = await factory({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
    basis.initializeBasis();
    const file = new basis.KTX2File(new Uint8Array(TRANSCODER_PROBE()));
    expect([file.isValid(), file.getWidth(), file.isUASTC(), file.startTranscoding()]).toEqual([true, 4, true, 1]);
    file.close(); file.delete();
  });
});
