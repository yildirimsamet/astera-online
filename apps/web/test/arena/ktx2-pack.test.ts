import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { STRUCTURE_CATALOG } from '@astera/rules/arena';
import { loadSky, loadTexture, modelsToLoad, packTexture, type TextureLoaders } from '../../src/arena/assets/load.js';
import { parseReferenceManifest, type ReferenceManifest } from '../../src/arena/assets/manifest.js';
import { textureBytes } from '../../src/arena/assets/memory.js';

/**
 * Y3 gate (plan 14 §14.1 step 4, §17): the pack's maps are KTX2 (tools/arena-ktx2.mjs) and stay
 * block-compressed on the GPU. A webp decodes to full RGBA, which is what killed the iPhone tab.
 */
const descriptor = (model: string) => ({ model, uvFlip: false, rotateY: 0 });
const faces = (folder: string) => ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(face => `/__ref/dist/${folder}/${face}.webp`);
const pack = (extra: Record<string, unknown> = {}, sky: Record<string, unknown> = {}) => ({
  version: 2,
  ships: { hero: descriptor('/__ref/dist/a.glb'), rivals: [descriptor('/__ref/dist/b.glb'), descriptor('/__ref/dist/c.glb')], ...extra },
  rocks: [descriptor('/__ref/dist/r.glb')], giants: [descriptor('/__ref/dist/g.glb')], crystals: [descriptor('/__ref/dist/c.glb')], shards: [],
  structures: {
    hub: descriptor('/__ref/dist/h.glb'), gate: descriptor('/__ref/dist/h.glb'), outpost: [], generator: descriptor('/__ref/dist/h.glb'),
    wreck: [], relay: descriptor('/__ref/dist/h.glb'), pad: descriptor('/__ref/dist/h.glb'),
  },
  props: { debris: [], cargo: descriptor('/__ref/dist/h.glb') },
  textures: { 'mining-d': '/__ref/dist/v2/tex/mining-d.ktx2' }, sky: { faces: faces('sky'), env: faces('env'), ...sky },
  fx: {}, sounds: {}, music: [],
});
const parsed = (value: unknown): ReferenceManifest => {
  const manifest = parseReferenceManifest(value);
  if (!manifest) throw new Error('manifest refused');
  return manifest;
};

describe('the KTX2 sky', () => {
  it('reads a pack whose sky is one KTX2 cube beside its six faces, and refuses one outside the served folders', () => {
    expect(parsed(pack({}, { cube: '/__ref/dist/v2/sky/cube.ktx2' })).sky.cube).toBe('/__ref/dist/v2/sky/cube.ktx2');
    expect(parseReferenceManifest(pack({}, { cube: '/__ref/dist/../sky.ktx2' }))).toBeNull();
    expect(parsed(pack()).sky.cube).toBeUndefined();
  });
});

/** Loaders that record what they were asked for and answer with a texture, or fail. */
const loaders = (asked: string[], failing = new Set<string>()): TextureLoaders => {
  const answer = <T>(path: string, make: () => T): Promise<T> => {
    asked.push(path);
    return failing.has(path) ? Promise.reject(new Error('404')) : Promise.resolve(make());
  };
  return {
    image: path => answer(path, () => new THREE.Texture()),
    ktx2: path => answer(path, () => {
      if (path.endsWith('/cube.ktx2')) {
        const face = { mipmaps: [{ data: new Uint8Array(16), width: 4, height: 4 }], width: 4, height: 4 };
        return new THREE.CompressedCubeTexture(Array.from({ length: 6 }, () => face), THREE.RGBA_ASTC_4x4_Format, THREE.UnsignedByteType);
      }
      const result = new THREE.CompressedTexture([], 4, 4);
      result.generateMipmaps = false; result.minFilter = THREE.LinearMipmapLinearFilter;
      return result;
    }),
    cube: list => answer(list.join(','), () => new THREE.CubeTexture()),
  };
};

describe('a texture of the pack', () => {
  it('loads a .ktx2 map through the KTX2 loader and keeps the mip chain the file carries', async () => {
    const asked: string[] = [];
    const result = await loadTexture(loaders(asked), '/__ref/dist/v2/tex/cloud-d.ktx2');
    expect(asked).toEqual(['/__ref/dist/v2/tex/cloud-d.ktx2']);
    expect(result).toBeInstanceOf(THREE.CompressedTexture);
    // The GPU cannot build mips of a block-compressed texture; asking it to is a GL error.
    expect(result?.generateMipmaps).toBe(false);
    expect(result?.wrapS).toBe(THREE.RepeatWrapping);
    expect(result?.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('still loads a webp map as an image with mips built on upload', async () => {
    const asked: string[] = [];
    const result = await loadTexture(loaders(asked), '/__ref/dist/v2/tex/cloud-d.webp');
    expect(result).not.toBeInstanceOf(THREE.CompressedTexture);
    expect(result?.generateMipmaps).toBe(true);
    expect(result?.flipY).toBe(false);
  });

  it('answers a missing map with nothing, so the model keeps its plain material', async () => {
    expect(await loadTexture(loaders([], new Set(['/__ref/dist/v2/tex/x.ktx2'])), '/__ref/dist/v2/tex/x.ktx2')).toBeNull();
  });

  it('finds a named map of the texture table in either format', () => {
    const ktx2 = new THREE.Texture();
    expect(packTexture(new Map([['/__ref/dist/v2/tex/mining-d.ktx2', ktx2]]), 'mining-d')).toBe(ktx2);
    const webp = new THREE.Texture();
    expect(packTexture(new Map([['/__ref/dist/lite/v2/tex/mining-d.webp', webp]]), 'mining-d')).toBe(webp);
    expect(packTexture(new Map([['/__ref/dist/v2/tex/xmining-d.webp', webp]]), 'mining-d')).toBeUndefined();
  });
});

describe('loading the sky', () => {
  it('takes the KTX2 cube when the pack has one', async () => {
    const asked: string[] = [];
    const sky = await loadSky(loaders(asked), faces('sky'), '/__ref/dist/v2/sky/cube.ktx2', 4);
    expect(asked).toEqual(['/__ref/dist/v2/sky/cube.ktx2']);
    expect(sky).toBeInstanceOf(THREE.CompressedCubeTexture);
    expect(sky?.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('falls back to the six faces when the cube does not load, and uses them alone in a webp pack', async () => {
    const asked: string[] = [];
    const sky = await loadSky(loaders(asked, new Set(['/__ref/dist/v2/sky/cube.ktx2'])), faces('sky'), '/__ref/dist/v2/sky/cube.ktx2', 4);
    expect(asked).toEqual(['/__ref/dist/v2/sky/cube.ktx2', faces('sky').join(',')]);
    expect(sky).toBeInstanceOf(THREE.CubeTexture);
    expect(sky?.generateMipmaps).toBe(true);
    const plain: string[] = [];
    await loadSky(loaders(plain), faces('sky'), undefined, 4);
    expect(plain).toEqual([faces('sky').join(',')]);
  });

  it('answers nothing when neither loads', async () => {
    const all = new Set(['/__ref/dist/v2/sky/cube.ktx2', faces('sky').join(',')]);
    expect(await loadSky(loaders([], all), faces('sky'), '/__ref/dist/v2/sky/cube.ktx2', 4)).toBeNull();
  });
});

describe('a compressed cube in the texture budget', () => {
  it('counts every face\'s levels', () => {
    const face = { mipmaps: [{ data: new Uint8Array(64), width: 8, height: 8 }, { data: new Uint8Array(16), width: 4, height: 4 }], width: 8, height: 8 };
    const cube = new THREE.CompressedCubeTexture(Array.from({ length: 6 }, () => face), THREE.RGBA_ASTC_4x4_Format, THREE.UnsignedByteType);
    expect(textureBytes(cube)).toBe(6 * (64 + 16));
  });
});

describe('which models a pack loads', () => {
  const classShip = (key: string) => ({ ...descriptor(`/__ref/dist/v2/yarik/ships/${key}.glb`), unit: true, pbr: true, lods: 3 });
  const keys = (manifest: ReferenceManifest) => modelsToLoad(manifest).map(entry => entry.key);

  it('skips the older hero and rivals when the pack has the three class ships: nothing would draw them', () => {
    const classes = { akinci: classShip('akinci'), muhafiz: classShip('muhafiz'), kilavuz: classShip('kilavuz') };
    const loaded = keys(parsed(pack({ classes })));
    expect(loaded).toEqual(expect.arrayContaining(['class:akinci', 'class:muhafiz', 'class:kilavuz', 'structure:yarik_kalbi', 'cargo']));
    expect(loaded.filter(key => key === 'hero' || key.startsWith('rival:'))).toEqual([]);
  });

  it('does not load the exit ring: the exit is a dock now (owner 2026-10-22)', () => {
    expect(keys(parsed(pack()))).not.toContain('gate');
  });

  it('loads each Rift structure in metres with its levels: the collider it is drawn over is in metres too', () => {
    const loaded = modelsToLoad(parsed(pack()));
    for (const key of STRUCTURE_CATALOG.map(entry => entry.key)) {
      expect(loaded.find(entry => entry.key === `structure:${key}`)?.d).toMatchObject({ model: `/assets/arena/yarik/${key}.glb`, unit: true, pbr: true, lods: 3 });
    }
  });

  it('takes the webp copies of the structures when the renderer cannot start the transcoder (S22 2026-10-26)', () => {
    const loaded = modelsToLoad(parsed(pack()), true);
    for (const key of STRUCTURE_CATALOG.map(entry => entry.key)) {
      expect(loaded.find(entry => entry.key === `structure:${key}`)?.d.model).toBe(`/assets/arena/yarik-webp/${key}.glb`);
    }
  });

  it('does not load the outposts, the generator or the relay: the Rift has none (15-yarik-haritasi §4.1)', () => {
    const loaded = keys(parsed(pack()));
    expect(loaded.filter(key => key === 'generator' || key === 'relay' || key.startsWith('outpost:'))).toEqual([]);
  });

  it('does not load the older heart, wreck or pad models: the closed Yarık Kalbi and Enkaz replace them (owner item 7)', () => {
    const loaded = keys(parsed({ ...pack(), structures: { ...pack().structures, wreck: [descriptor('/__ref/dist/w.glb')] } }));
    expect(loaded.filter(key => key === 'hub' || key === 'pad' || key.startsWith('wreck:'))).toEqual([]);
    expect(loaded).toEqual(expect.arrayContaining(['structure:yarik_kalbi', 'structure:enkaz']));
  });

  it('loads them in a pack without classes', () => {
    expect(keys(parsed(pack()))).toEqual(expect.arrayContaining(['hero', 'rival:0', 'rival:1']));
  });
});
