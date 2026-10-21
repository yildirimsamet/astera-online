import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { parseReferenceManifest, type MapSet, type ModelDescriptor, type ReferenceManifest } from './manifest.js';

export interface ModelPart { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; glow: boolean }
/**
 * A model baked into unit space: transform applied, nose on +Z, centred on its bounds.
 * Ships are scaled to length 1 along Z; everything else to bounding radius 1. `mean`
 * is the average vertex distance from the centre: rocks are sized by it so their
 * visible surface sits on the round collider instead of floating off it.
 */
export interface PreparedModel { parts: ModelPart[]; radius: number; mean: number; size: THREE.Vector3; engines: [number, number, number][] }

export interface ArenaAssets {
  references: boolean;
  hero: PreparedModel | null; rivals: PreparedModel[];
  rocks: PreparedModel[]; giants: PreparedModel[]; crystals: PreparedModel[]; shards: PreparedModel[];
  hub: PreparedModel | null; gate: PreparedModel | null; outposts: PreparedModel[]; generator: PreparedModel | null;
  wrecks: PreparedModel[]; relay: PreparedModel | null; pad: PreparedModel | null;
  debris: PreparedModel[]; cargo: PreparedModel | null;
  sky: THREE.CubeTexture | null; env: THREE.CubeTexture | null;
  fx: Map<string, THREE.Texture>; textures: Map<string, THREE.Texture>;
  sounds: Map<string, ArrayBuffer[]>; music: string[];
}

export interface LoadProgress { done: number; total: number; stage: 'manifest' | 'sky' | 'models' | 'textures' | 'sounds' | 'ready' }

const geometryOf = (object: THREE.Object3D): object is THREE.Mesh =>
  object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry;

function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const result: unknown = mergeGeometries(pieces, false);
  return result instanceof THREE.BufferGeometry ? result : null;
}

/** Keeps only the attributes every part shares, so parts can merge into one draw. */
function normaliseAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(plain.attributes)) if (!['position', 'normal', 'uv'].includes(name)) plain.deleteAttribute(name);
  if (!plain.hasAttribute('normal')) plain.computeVertexNormals();
  if (!plain.hasAttribute('uv')) plain.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(plain.getAttribute('position').count * 2), 2));
  return plain;
}

function prepare(scene: THREE.Object3D, descriptor: ModelDescriptor, ship: boolean, textures: Map<string, THREE.Texture>,
  anisotropy: number, twoSided = ship): PreparedModel | null {
  scene.updateMatrixWorld(true);
  const turn = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(descriptor.rotateY));
  const meshes: THREE.Mesh[] = [];
  scene.traverse(object => { if (geometryOf(object)) meshes.push(object); });
  if (meshes.length === 0) return null;
  const groups = new Map<string, { geometries: THREE.BufferGeometry[]; source: THREE.Material; glow: boolean; maps?: MapSet }>();
  meshes.forEach((mesh, index) => {
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(turn);
    const uv = geometry.getAttribute('uv');
    if (descriptor.uvFlip && uv instanceof THREE.BufferAttribute) {
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    }
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    const glow = descriptor.glowMesh === index;
    const meshMaps = descriptor.meshMaps?.[index];
    const key = `${material.uuid}:${String(glow)}:${String(index < (descriptor.meshMaps?.length ?? 0) ? index : -1)}`;
    const group = groups.get(key) ?? { geometries: [], source: material, glow, maps: meshMaps ?? descriptor.maps };
    group.geometries.push(normaliseAttributes(geometry));
    groups.set(key, group);
  });
  const all = Array.from(groups.values()).flatMap(group => group.geometries);
  const box = new THREE.Box3();
  for (const geometry of all) { geometry.computeBoundingBox(); if (geometry.boundingBox) box.union(geometry.boundingBox); }
  const centre = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  let radius = 0;
  for (const geometry of all) {
    geometry.translate(-centre.x, -centre.y, -centre.z);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) radius = Math.max(radius, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
  }
  const scale = ship ? 1 / Math.max(1e-6, extent.z) : 1 / Math.max(1e-6, radius);
  let sum = 0; let count = 0;
  const parts: ModelPart[] = [];
  for (const group of groups.values()) {
    for (const geometry of group.geometries) geometry.scale(scale, scale, scale);
    const geometry = group.geometries.length === 1 ? group.geometries[0] : merged(group.geometries);
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) { sum += Math.hypot(position.getX(i), position.getY(i), position.getZ(i)); count++; }
    const made = material(group.source, group.maps, group.glow, ship, descriptor.uvFlip, textures, anisotropy);
    // Converted hulls carry some faces wound the wrong way; draw both sides rather than holes.
    if (twoSided) made.side = THREE.DoubleSide;
    parts.push({ geometry, material: made, glow: group.glow });
  }
  return { parts, radius: radius * scale, mean: count > 0 ? sum / count : radius * scale,
    size: extent.multiplyScalar(scale), engines: descriptor.engines ?? [] };
}

function material(source: THREE.Material, maps: MapSet | undefined, glow: boolean, ship: boolean, flipped: boolean,
  textures: Map<string, THREE.Texture>, anisotropy: number): THREE.MeshStandardMaterial {
  const original = source instanceof THREE.MeshStandardMaterial ? source : null;
  const map = (maps?.map ? textures.get(maps.map) : undefined) ?? original?.map ?? null;
  const normalMap = (maps?.normalMap ? textures.get(maps.normalMap) : undefined) ?? original?.normalMap ?? null;
  const emissiveMap = maps?.emissiveMap ? textures.get(maps.emissiveMap) ?? null : null;
  for (const texture of [map, normalMap, emissiveMap]) if (texture) { texture.anisotropy = anisotropy; texture.needsUpdate = true; }
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  if (emissiveMap) emissiveMap.colorSpace = THREE.SRGBColorSpace;
  const result = new THREE.MeshStandardMaterial({
    map, normalMap, emissiveMap,
    color: glow ? new THREE.Color('#9ff6ff') : new THREE.Color('#ffffff'),
    metalness: ship ? 0.62 : emissiveMap ? 0.55 : 0.08,
    roughness: ship ? 0.38 : emissiveMap ? 0.48 : 0.86,
    emissive: glow ? new THREE.Color('#36e6ff') : emissiveMap ? new THREE.Color('#ffffff') : new THREE.Color('#000000'),
    emissiveIntensity: glow ? 1.6 : emissiveMap ? 1.1 : 0,
  });
  if (glow) result.emissiveMap = map;
  // Flipping V mirrors the tangent frame, so the normal map's green channel flips with it.
  if (normalMap) result.normalScale.set(1, flipped ? -1 : 1);
  return result;
}

async function texture(loader: THREE.TextureLoader, path: string): Promise<THREE.Texture | null> {
  try {
    const result = await loader.loadAsync(path);
    result.flipY = false; result.wrapS = THREE.RepeatWrapping; result.wrapT = THREE.RepeatWrapping;
    result.generateMipmaps = true; result.minFilter = THREE.LinearMipmapLinearFilter;
    return result;
  } catch { return null; }
}

const empty = (): ArenaAssets => ({
  references: false, hero: null, rivals: [], rocks: [], giants: [], crystals: [], shards: [], hub: null, gate: null,
  outposts: [], generator: null, wrecks: [], relay: null, pad: null, debris: [], cargo: null, sky: null, env: null,
  fx: new Map(), textures: new Map(), sounds: new Map(), music: [],
});

/**
 * Browsers whose tab dies well short of the full pack's ~580 MB of decoded textures
 * (owner 2026-10-21: an iPhone 12 mini, in Safari and Chrome — every iOS browser is
 * WebKit). An iPad asking for the desktop site reports a Mac with touch points.
 */
export function memoryTight(nav: { userAgent: string; maxTouchPoints: number; deviceMemory?: number }): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
    || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
}

const PACKS = { full: '/__ref/dist/v2/manifest.json', lite: '/__ref/dist/v2/manifest-lite.json' } as const;

/**
 * Loads the whole reference pack before the flight begins. A longer loading screen is
 * the deliberate price of a flight that never hitches on a first texture upload.
 */
export async function loadArenaAssets(references: boolean, anisotropy: number, onProgress: (p: LoadProgress) => void,
  fetcher: typeof fetch = fetch, lite = memoryTight(navigator)): Promise<ArenaAssets> {
  const assets = empty();
  let manifest: ReferenceManifest | null = null;
  onProgress({ done: 0, total: 1, stage: 'manifest' });
  // The lite pack halves every image; a server without it still serves the full one.
  for (const path of references ? lite ? [PACKS.lite, PACKS.full] : [PACKS.full] : []) {
    try {
      const response = await fetcher(path);
      if (response.ok) manifest = parseReferenceManifest(await response.json());
    } catch { /* No reference pack is a complete, supported configuration. */ }
    if (manifest) break;
  }
  if (!manifest) { onProgress({ done: 1, total: 1, stage: 'ready' }); return assets; }
  const m = manifest;
  assets.references = true;
  const textureLoader = new THREE.TextureLoader();
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const descriptors: { key: string; d: ModelDescriptor; ship: boolean }[] = [
    { key: 'hero', d: m.ships.hero, ship: true },
    ...m.ships.rivals.map((d, i) => ({ key: `rival:${String(i)}`, d, ship: true })),
    ...m.rocks.map((d, i) => ({ key: `rock:${String(i)}`, d, ship: false })),
    ...m.giants.map((d, i) => ({ key: `giant:${String(i)}`, d, ship: false })),
    ...m.crystals.map((d, i) => ({ key: `crystal:${String(i)}`, d, ship: false })),
    ...m.shards.map((d, i) => ({ key: `shard:${String(i)}`, d, ship: false })),
    { key: 'hub', d: m.structures.hub, ship: false }, { key: 'gate', d: m.structures.gate, ship: false },
    ...m.structures.outpost.map((d, i) => ({ key: `outpost:${String(i)}`, d, ship: false })),
    { key: 'generator', d: m.structures.generator, ship: false },
    ...m.structures.wreck.map((d, i) => ({ key: `wreck:${String(i)}`, d, ship: true })),
    { key: 'relay', d: m.structures.relay, ship: false }, { key: 'pad', d: m.structures.pad, ship: false },
    ...m.props.debris.map((d, i) => ({ key: `debris:${String(i)}`, d, ship: false })),
    { key: 'cargo', d: m.props.cargo, ship: false },
  ];
  const texturePaths = new Set<string>(Object.values(m.textures));
  const soundEntries = Object.entries(m.sounds);
  const total = 2 + descriptors.length + texturePaths.size + Object.keys(m.fx).length
    + soundEntries.reduce((sum, [, files]) => sum + files.length, 0);
  let done = 0;
  const tick = (stage: LoadProgress['stage']): void => { done++; onProgress({ done, total, stage }); };

  const cube = async (faces: readonly string[]): Promise<THREE.CubeTexture | null> => {
    try {
      const result = await new THREE.CubeTextureLoader().loadAsync([...faces]);
      result.colorSpace = THREE.SRGBColorSpace; result.generateMipmaps = true;
      result.minFilter = THREE.LinearMipmapLinearFilter; result.anisotropy = anisotropy;
      return result;
    } catch { return null; }
  };
  [assets.sky, assets.env] = await Promise.all([
    cube(m.sky.faces).finally(() => { tick('sky'); }), cube(m.sky.env).finally(() => { tick('sky'); }),
  ]);
  await Promise.all(Array.from(texturePaths, async path => {
    const result = await texture(textureLoader, path);
    if (result) assets.textures.set(path, result);
    tick('textures');
  }));
  await Promise.all(Object.entries(m.fx).map(async ([key, path]) => {
    const result = await texture(textureLoader, path);
    if (result) { result.colorSpace = THREE.SRGBColorSpace; result.flipY = true; result.wrapS = THREE.ClampToEdgeWrapping; result.wrapT = THREE.ClampToEdgeWrapping; assets.fx.set(key, result); }
    tick('textures');
  }));
  const prepared = new Map<string, PreparedModel>();
  await Promise.all(descriptors.map(async ({ key, d, ship }) => {
    try {
      const scene = (await gltf.loadAsync(d.model)).scene;
      const structure = /^(hub|gate|outpost|generator|wreck|relay|pad|debris)/.test(key);
      const model = prepare(scene, d, ship, assets.textures, anisotropy, ship || structure);
      if (model) prepared.set(key, model);
    } catch { /* A missing reference keeps its procedural stand-in. */ }
    tick('models');
  }));
  const list = (prefix: string): PreparedModel[] => Array.from(prepared).filter(([key]) => key.startsWith(prefix + ':')).map(([, value]) => value);
  assets.hero = prepared.get('hero') ?? null; assets.rivals = list('rival');
  assets.rocks = list('rock'); assets.giants = list('giant'); assets.crystals = list('crystal'); assets.shards = list('shard');
  assets.hub = prepared.get('hub') ?? null; assets.gate = prepared.get('gate') ?? null; assets.outposts = list('outpost');
  assets.generator = prepared.get('generator') ?? null; assets.wrecks = list('wreck'); assets.relay = prepared.get('relay') ?? null;
  assets.pad = prepared.get('pad') ?? null; assets.debris = list('debris'); assets.cargo = prepared.get('cargo') ?? null;
  await Promise.all(soundEntries.map(async ([key, files]) => {
    const buffers: ArrayBuffer[] = [];
    for (const file of files) {
      try { const response = await fetcher(file); if (response.ok) buffers.push(await response.arrayBuffer()); } catch { /* silent */ }
      tick('sounds');
    }
    if (buffers.length > 0) assets.sounds.set(key, buffers);
  }));
  assets.music = m.music;
  onProgress({ done: total, total, stage: 'ready' });
  return assets;
}
