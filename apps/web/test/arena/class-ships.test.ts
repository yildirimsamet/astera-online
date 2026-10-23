import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emptyArenaAssets, prepare, prepareLevels, type PreparedModel } from '../../src/arena/assets/load.js';
import { parseReferenceManifest } from '../../src/arena/assets/manifest.js';
import { shipModelFor } from '../../src/arena/classes.js';

/**
 * Y3: the three class ships (Akıncı, Muhafız, Kılavuz) come from tools/arena-ships.mjs —
 * normalised, three levels of detail in one file, KTX2 maps, quantised meshopt geometry.
 */
const descriptor = (model: string) => ({ model, uvFlip: false, rotateY: 0 });
const pack = (ships: Record<string, unknown>) => ({
  version: 2,
  ships: { hero: descriptor('/__ref/dist/a.glb'), rivals: [descriptor('/__ref/dist/b.glb')], ...ships },
  rocks: [descriptor('/__ref/dist/r.glb')], giants: [descriptor('/__ref/dist/g.glb')], crystals: [descriptor('/__ref/dist/c.glb')], shards: [],
  structures: {
    hub: descriptor('/__ref/dist/h.glb'), gate: descriptor('/__ref/dist/h.glb'), outpost: [], generator: descriptor('/__ref/dist/h.glb'),
    wreck: [], relay: descriptor('/__ref/dist/h.glb'), pad: descriptor('/__ref/dist/h.glb'),
  },
  props: { debris: [], cargo: descriptor('/__ref/dist/h.glb') },
  textures: {}, sky: { faces: Array(6).fill('/__ref/dist/s.webp'), env: Array(6).fill('/__ref/dist/s.webp') },
  fx: {}, sounds: {}, music: [],
});
const ENGINES: [number, number, number][] = [[0.1, 0, -0.44], [-0.1, 0, -0.44]];
const classShip = (key: string) => ({ ...descriptor(`/__ref/dist/v2/yarik/ships/${key}.glb`), unit: true, pbr: true, lods: 3, engines: ENGINES, nozzle: 0.02 });

describe('class ships in the reference pack', () => {
  it('reads the three class ships with their levels of detail and kept materials', () => {
    const manifest = parseReferenceManifest(pack({ classes: { akinci: classShip('akinci'), muhafiz: classShip('muhafiz'), kilavuz: classShip('kilavuz') } }));
    expect(manifest?.ships.classes?.muhafiz.lods).toBe(3);
    expect(manifest?.ships.classes?.akinci.pbr).toBe(true);
  });

  it('reads the measured nozzle radius and refuses one that is not a positive length', () => {
    const classes = (nozzle: unknown) => ({ akinci: { ...classShip('akinci'), nozzle }, muhafiz: classShip('muhafiz'), kilavuz: classShip('kilavuz') });
    expect(parseReferenceManifest(pack({ classes: classes(0.06) }))?.ships.classes?.akinci.nozzle).toBe(0.06);
    expect(parseReferenceManifest(pack({ classes: classes(0) }))).toBeNull();
    expect(parseReferenceManifest(pack({ classes: classes(-0.02) }))).toBeNull();
  });

  it('still reads a pack without classes, and refuses a class ship outside the served folders or missing one class', () => {
    expect(parseReferenceManifest(pack({}))).not.toBeNull();
    expect(parseReferenceManifest(pack({ classes: { akinci: classShip('akinci'), muhafiz: classShip('muhafiz'), kilavuz: { ...classShip('x'), model: '/__ref/dist/../x.glb' } } }))).toBeNull();
    expect(parseReferenceManifest(pack({ classes: { akinci: classShip('akinci'), muhafiz: classShip('muhafiz') } }))).toBeNull();
  });
});

/** One triangle, quantised the way meshopt packs a mesh: int16 positions, a node scale to undo it. */
const quantised = (): THREE.Group => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, 0, 32767, 16384, 0, -32767, -16384, 8192, 0]), 3, true));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 127, 0, 0, 127, 0, 0, 127, 0]), 3, true));
  geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.scale.setScalar(0.5);
  const group = new THREE.Group(); group.add(mesh);
  return group;
};

describe('preparing a quantised model', () => {
  it('turns quantised attributes into floats before applying the node transform', () => {
    const model = prepare(quantised(), { ...descriptor('/__ref/dist/x.glb'), unit: true }, true, new Map(), 1);
    const position = model?.parts[0]?.geometry.getAttribute('position');
    expect(position?.array).toBeInstanceOf(Float32Array);
    expect(position?.getZ(0)).toBeCloseTo(0.5, 4);
    expect(position?.getX(1)).toBeCloseTo(0.25, 3);
    expect(position?.getZ(1)).toBeCloseTo(-0.5, 4);
    expect(model?.parts[0]?.geometry.getAttribute('normal').getY(0)).toBeCloseTo(1, 2);
  });

  it('keeps an indexed mesh indexed, so a ship is not tripled in vertices', () => {
    const model = prepare(quantised(), { ...descriptor('/__ref/dist/x.glb'), unit: true }, true, new Map(), 1);
    expect(model?.parts[0]?.geometry.index?.count).toBe(3);
  });
});

/** A source material carrying every map the ship tool writes. */
const authored = (): THREE.MeshStandardMaterial => {
  const orm = new THREE.Texture();
  return new THREE.MeshStandardMaterial({
    map: new THREE.Texture(), normalMap: new THREE.Texture(), roughnessMap: orm, metalnessMap: orm, aoMap: orm,
    emissiveMap: new THREE.Texture(), emissive: new THREE.Color(1, 0.5, 0.25), emissiveIntensity: 3, roughness: 0.8, metalness: 0.9,
  });
};
const withMaterial = (material: THREE.Material, name = ''): THREE.Group => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 0.1, 0, -0.5, -0.1, 0.05, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const group = new THREE.Group(); group.name = name;
  group.add(new THREE.Mesh(geometry, material));
  return group;
};

describe('a pbr model', () => {
  it('keeps the authored roughness, metal, occlusion and emission maps and factors', () => {
    const source = authored();
    const material = prepare(withMaterial(source), { ...descriptor('/__ref/dist/x.glb'), unit: true, pbr: true }, true, new Map(), 4)?.parts[0]?.material;
    expect(material?.roughnessMap).toBe(source.roughnessMap);
    expect(material?.metalnessMap).toBe(source.metalnessMap);
    expect(material?.aoMap).toBe(source.aoMap);
    expect(material?.emissiveMap).toBe(source.emissiveMap);
    expect(material?.emissive.getHex()).toBe(source.emissive.getHex());
    expect(material?.emissiveIntensity).toBe(3);
    expect(material?.roughness).toBe(0.8);
    expect(material?.metalness).toBe(0.9);
    expect(material?.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material?.normalScale.toArray()).toEqual([1, -1]);
  });

  // Enkaz in the game: its file carries COLOR_0, its material reads it, and the colour went with
  // the attributes the arena drops. WebGL reads a missing attribute as 0: a black hull, lit by nothing.
  it('stops reading vertex colours it no longer has', () => {
    const source = authored();
    source.vertexColors = true;
    const scene = withMaterial(source);
    const mesh = scene.children[0];
    if (!(mesh instanceof THREE.Mesh) || !(mesh.geometry instanceof THREE.BufferGeometry)) throw new Error('no mesh');
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    const part = prepare(scene, { ...descriptor('/__ref/dist/x.glb'), unit: true, pbr: true }, false, new Map(), 4)?.parts[0];
    expect(part?.material.vertexColors !== true || part.geometry.hasAttribute('color')).toBe(true);
  });

  it('is not what an older ship gets: its look stays the arena\'s fixed metal finish', () => {
    const material = prepare(withMaterial(authored()), descriptor('/__ref/dist/x.glb'), true, new Map(), 4)?.parts[0]?.material;
    expect(material?.roughnessMap).toBeNull();
    expect(material?.metalness).toBe(0.62);
  });

  it('keeps the second UV set its maps may read (a Rift structure tiles its panel normals on it)', () => {
    const source = authored();
    const scene = withMaterial(source);
    const second = withMaterial(source).children[0];
    if (!(second instanceof THREE.Mesh) || !(second.geometry instanceof THREE.BufferGeometry)) throw new Error('no mesh');
    second.geometry.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 8, 0, 0, 8], 2));
    scene.add(second);
    const model = prepare(scene, { ...descriptor('/__ref/dist/x.glb'), unit: true, pbr: true }, false, new Map(), 4);
    expect(model?.parts).toHaveLength(1);
    expect(Array.from(model?.parts[0]?.geometry.getAttribute('uv1').array ?? [])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8]);
    const plain = prepare(scene, { ...descriptor('/__ref/dist/x.glb'), unit: true }, false, new Map(), 4);
    expect(plain?.parts[0]?.geometry.hasAttribute('uv1')).toBe(false);
  });
});

/** A file with `lod0`, `lod1`, `lod2` nodes, each a smaller version of the same hull. */
const levels = (): THREE.Group => {
  const scene = new THREE.Group();
  ['lod0', 'lod1', 'lod2'].forEach((name, i) => {
    const level = withMaterial(authored(), name);
    level.scale.setScalar(1 - i * 0.01);
    scene.add(level);
  });
  return scene;
};

describe('levels of detail', () => {
  it('prepares the first level as the model and the rest, coarsest last, as its lods', () => {
    const model = prepareLevels(levels(), { ...classShip('akinci') }, true, new Map(), 4);
    expect(model?.lods).toHaveLength(2);
    expect(model?.size.z).toBeCloseTo(1, 6);
    expect(model?.lods?.[1]?.size.z).toBeCloseTo(0.98, 6);
    expect(model?.engines).toEqual([[0.1, 0, -0.44], [-0.1, 0, -0.44]]);
    // The flame leaves the nozzle at its measured size, on every level.
    expect(model?.nozzle).toBe(0.02);
    expect(model?.lods?.[1]?.nozzle).toBe(0.02);
  });

  it('leaves the nozzle unknown for a ship whose pack does not measure it', () => {
    expect(prepare(withMaterial(authored()), descriptor('/__ref/dist/x.glb'), true, new Map(), 1)?.nozzle).toBeUndefined();
  });

  it('prepares a file without levels as one model', () => {
    const model = prepareLevels(withMaterial(authored()), descriptor('/__ref/dist/x.glb'), true, new Map(), 4);
    expect(model?.lods ?? []).toHaveLength(0);
    expect(model?.parts).toHaveLength(1);
  });
});

describe('which ship a pilot is drawn as', () => {
  it('draws the class the pilot flies (Y4) when the pack has it, and otherwise the older rival set', () => {
    const assets = emptyArenaAssets();
    const rival = prepare(withMaterial(authored()), descriptor('/__ref/dist/x.glb'), true, new Map(), 1);
    if (!rival) throw new Error('no model');
    assets.rivals = [rival];
    expect(shipModelFor(assets, 'muhafiz', 'hunter', 1)).toBe(rival);
    const akinci: PreparedModel = { ...rival }; const muhafiz: PreparedModel = { ...rival };
    assets.classes.set('akinci', akinci); assets.classes.set('muhafiz', muhafiz);
    // The class decides, not the bot's role.
    expect(shipModelFor(assets, 'muhafiz', 'hunter', 1)).toBe(muhafiz);
    expect(shipModelFor(assets, 'akinci', undefined, 9)).toBe(akinci);
    expect(shipModelFor(emptyArenaAssets(), 'akinci', 'hunter', 1)).toBeNull();
  });
});
