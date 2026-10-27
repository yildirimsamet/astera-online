import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { glbRoles, ktx2Manifest, ktxCommand, modelsToConvert, tableRoles } from './arena-ktx2.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { Document } = require('@gltf-transform/core');

const model = (path, extra = {}) => ({ model: path, uvFlip: false, rotateY: 0, ...extra });
const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(face => `/__ref/dist/v2/sky/${face}.webp`);
const manifest = () => ({
  version: 2,
  ships: { hero: model('/__ref/dist/v2/ships/hero.glb'), rivals: [model('/__ref/dist/v2/ships/r.glb')],
    classes: { akinci: model('/__ref/dist/v2/yarik/ships/akinci.glb'), muhafiz: model('/__ref/dist/v2/yarik/ships/muhafiz.glb'), kilavuz: model('/__ref/dist/v2/yarik/ships/kilavuz.glb') } },
  rocks: [model('/__ref/dist/v2/rocks/r.glb')], giants: [], crystals: [], shards: [],
  structures: {
    hub: model('/__ref/dist/v2/st/hub.glb', { maps: { map: '/__ref/dist/v2/tex/hull-d.webp', normalMap: '/__ref/dist/v2/tex/hull-n.webp' } }),
    gate: model('/__ref/dist/v2/st/hub.glb'), outpost: [model('/__ref/dist/v2/st/out.glb', { meshMaps: [{ normalMap: '/__ref/dist/v2/tex/plate.webp' }] })],
    generator: model('/__ref/dist/v2/st/gen.glb'), wreck: [model('/__ref/dist/v2/st/wreck.glb')], relay: model('/__ref/dist/v2/st/relay.glb'), pad: model('/__ref/dist/v2/st/pad.glb'),
  },
  props: { debris: [model('/__ref/dist/v2/props/d.glb')], cargo: model('/__ref/dist/v2/props/cargo.glb') },
  textures: { 'hull-d': '/__ref/dist/v2/tex/hull-d.webp', 'hull-n': '/__ref/dist/v2/tex/hull-n.webp', plate: '/__ref/dist/v2/tex/plate.webp', 'mining-n': '/__ref/dist/v2/tex/mining-n.webp' },
  sky: { faces, env: faces.map(face => face.replace('/sky/', '/sky/env-')) },
  fx: { flare: '/__ref/dist/v2/fx/flare.webp' }, sounds: { hit: ['/__ref/audio/v2/hit.ogg'] }, music: [],
  colliders: { 'flint-01': model('/__ref/dist/v2/yarik/flint-01.glb', { unit: true }) },
});

describe('which pack images are normal maps', () => {
  it('reads the role from how the models use a table map, and from its -n name when no model does', () => {
    const roles = tableRoles(manifest());
    expect(roles.get('/__ref/dist/v2/tex/hull-d.webp')).toBe('color');
    expect(roles.get('/__ref/dist/v2/tex/hull-n.webp')).toBe('normal');
    expect(roles.get('/__ref/dist/v2/tex/plate.webp')).toBe('normal');
    expect(roles.get('/__ref/dist/v2/tex/mining-n.webp')).toBe('normal');
  });

  it('reads the role of a model\'s own maps from the material slot that uses them', () => {
    const doc = new Document();
    const [color, normal, orm, glow] = ['c', 'n', 'o', 'e'].map(name => doc.createTexture(name));
    doc.createMaterial().setBaseColorTexture(color).setNormalTexture(normal).setMetallicRoughnessTexture(orm).setOcclusionTexture(orm).setEmissiveTexture(glow);
    const roles = glbRoles(doc);
    expect([color, normal, orm, glow].map(texture => roles.get(texture))).toEqual(['color', 'normal', 'linear', 'color']);
  });
});

describe('the models converted', () => {
  it('are the ones the arena loads beside the class ships: colliders, structures and props, each once', () => {
    const paths = modelsToConvert(manifest());
    expect(paths).toEqual(expect.arrayContaining(['/__ref/dist/v2/yarik/flint-01.glb', '/__ref/dist/v2/st/hub.glb', '/__ref/dist/v2/st/wreck.glb', '/__ref/dist/v2/props/cargo.glb']));
    expect(paths.filter(path => path === '/__ref/dist/v2/st/hub.glb')).toHaveLength(1);
    expect(paths.some(path => path.includes('/ships/') || path.includes('/rocks/'))).toBe(false);
  });
});

describe('the encode command', () => {
  // Measured 2026-10-22 on a 512² map: ETC1S ~82 KB, UASTC with rate-distortion ~247 KB, the
  // same GPU bytes or less. Colour reads the same in ETC1S; a normal map and the sky do not.
  it('packs colour as sRGB ETC1S, the small download', () => {
    const color = ktxCommand('color', 'a.png', 'a.ktx2');
    expect(color).toContain('--format R8G8B8_SRGB');
    expect(color).toContain('--assign-tf srgb');
    expect(color).toContain('--encode basis-lz');
    expect(color).not.toContain('--zstd');
  });

  it('keeps a normal map linear UASTC without rate-distortion, and data maps linear UASTC', () => {
    const normal = ktxCommand('normal', 'n.png', 'n.ktx2');
    expect(normal).toContain('--format R8G8B8_UNORM');
    expect(normal).toContain('--assign-tf linear');
    expect(normal).not.toContain('--uastc-rdo');
    const data = ktxCommand('linear', 'o.png', 'o.ktx2');
    expect(data).toContain('--format R8G8B8_UNORM');
    expect(data).toContain('--uastc-rdo');
    for (const line of [normal, data]) {
      expect(line).toContain('--encode uastc');
      expect(line).toContain('--zstd 18');
    }
  });

  it('keeps the sky sRGB UASTC: its faint stars and the planet\'s limb break up in ETC1S', () => {
    const sky = ktxCommand('sky', 'px.png nx.png py.png ny.png pz.png nz.png', 'cube.ktx2', { cube: true });
    expect(sky).toContain('--format R8G8B8_SRGB');
    expect(sky).toContain('--encode uastc');
    expect(sky).toContain('--cubemap');
    expect(sky.endsWith('px.png nx.png py.png ny.png pz.png nz.png cube.ktx2')).toBe(true);
  });

  it('builds mips for every map and keeps an alpha channel when the image has one', () => {
    for (const role of ['color', 'normal', 'linear', 'sky']) expect(ktxCommand(role, 'a.png', 'a.ktx2')).toContain('--generate-mipmap');
    expect(ktxCommand('color', 'a.png', 'a.ktx2', { alpha: true })).toContain('--format R8G8B8A8_SRGB');
  });
});

describe('the KTX2 manifest', () => {
  const done = () => ({
    textures: new Set(['/__ref/dist/v2/tex/hull-d.webp', '/__ref/dist/v2/tex/hull-n.webp', '/__ref/dist/v2/tex/plate.webp']),
    models: new Set(['/__ref/dist/v2/st/hub.glb', '/__ref/dist/v2/yarik/flint-01.glb']),
    cube: '/__ref/dist/v2/sky/cube.ktx2',
  });

  it('points every use of a converted map and model at its KTX2 copy, and gives the sky its cube', () => {
    const out = ktx2Manifest(manifest(), done());
    expect(out.textures['hull-d']).toBe('/__ref/dist/v2/tex/hull-d.ktx2');
    expect(out.structures.hub.maps).toEqual({ map: '/__ref/dist/v2/tex/hull-d.ktx2', normalMap: '/__ref/dist/v2/tex/hull-n.ktx2' });
    expect(out.structures.outpost[0].meshMaps).toEqual([{ normalMap: '/__ref/dist/v2/tex/plate.ktx2' }]);
    expect(out.structures.hub.model).toBe('/__ref/dist/v2/st/hub-ktx2.glb');
    expect(out.structures.gate.model).toBe('/__ref/dist/v2/st/hub-ktx2.glb');
    expect(out.colliders['flint-01']).toEqual(model('/__ref/dist/v2/yarik/flint-01-ktx2.glb', { unit: true }));
    expect(out.sky.cube).toBe('/__ref/dist/v2/sky/cube.ktx2');
  });

  it('leaves what was not converted as it was: maps not encoded, faces, effects, sounds, ships', () => {
    const source = manifest();
    const out = ktx2Manifest(source, done());
    expect(out.textures['mining-n']).toBe(source.textures['mining-n']);
    expect(out.sky.faces).toEqual(source.sky.faces);
    expect(out.fx).toEqual(source.fx);
    expect(out.sounds).toEqual(source.sounds);
    expect(out.ships).toEqual(source.ships);
    expect(out.structures.relay.model).toBe(source.structures.relay.model);
  });

  it('does not touch the manifest it was given', () => {
    const source = manifest();
    const before = JSON.stringify(source);
    ktx2Manifest(source, done());
    expect(JSON.stringify(source)).toBe(before);
  });
});
