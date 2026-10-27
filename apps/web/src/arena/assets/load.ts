import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STRUCTURE_CATALOG } from '@astera/rules/arena';
import { parseReferenceManifest, SHIP_CLASSES, type MapSet, type ModelDescriptor, type ReferenceManifest, type ShipClass } from './manifest.js';
import { ktx2Ready } from './memory.js';

export interface ModelPart { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; glow: boolean }
/**
 * A model baked into unit space: transform applied, nose on +Z, centred on its bounds.
 * Ships are scaled to length 1 along Z; everything else to bounding radius 1. A collider
 * model is in that space already and is kept exactly as written. `mean` is the average
 * vertex distance from the centre. `lods` are the lighter levels of detail, coarsest last.
 */
export interface PreparedModel {
  parts: ModelPart[]; radius: number; mean: number; size: THREE.Vector3; engines: [number, number, number][];
  /** Measured nozzle exit radius in the same space as `engines`; absent for ships nobody measured. */
  nozzle?: number;
  lods?: PreparedModel[];
}

export interface ArenaAssets {
  references: boolean;
  hero: PreparedModel | null; rivals: PreparedModel[];
  /** Y3: the class ships, each with its levels of detail. */
  classes: Map<ShipClass, PreparedModel>;
  /** Rock and crystal, one model per collider catalog shape, by catalog key. */
  colliders: Map<string, PreparedModel>;
  /** The Rift's enterable structures (tools/yarik-structures.mjs), in metres, by catalog key. */
  structures: Map<string, PreparedModel>;
  debris: PreparedModel[]; cargo: PreparedModel | null;
  sky: THREE.CubeTexture | THREE.CompressedCubeTexture | null; env: THREE.CubeTexture | null;
  fx: Map<string, THREE.Texture>; textures: Map<string, THREE.Texture>;
  sounds: Map<string, ArrayBuffer[]>; music: string[];
}

export interface LoadProgress { done: number; total: number; stage: 'manifest' | 'sky' | 'models' | 'textures' | 'sounds' | 'ready' }

const geometryOf = (object: THREE.Object3D): object is THREE.Mesh =>
  object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry;

function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  // Parts merge only when all are indexed or none is.
  const mixed = pieces.some(piece => piece.index) && pieces.some(piece => !piece.index);
  const result: unknown = mergeGeometries(mixed ? pieces.map(piece => (piece.index ? piece.toNonIndexed() : piece)) : pieces, false);
  return result instanceof THREE.BufferGeometry ? result : null;
}

/**
 * Plain float attributes. A meshopt-packed file stores positions, normals and UVs quantised
 * (normalised integers, undone by the node's scale): transforming those in place would clamp them.
 */
function floatAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    const source = geometry.getAttribute(name);
    if (source instanceof THREE.BufferAttribute && source.array instanceof Float32Array && !source.normalized) continue;
    const values = new Float32Array(source.count * source.itemSize);
    for (let i = 0; i < source.count; i++) for (let k = 0; k < source.itemSize; k++) values[i * source.itemSize + k] = source.getComponent(i, k);
    geometry.setAttribute(name, new THREE.BufferAttribute(values, source.itemSize));
  }
  return geometry;
}

/**
 * Keeps only the attributes every part shares, so parts can merge into one draw. An indexed
 * mesh stays indexed; one without normals is split per face first, so its normals come out flat.
 * An authored (pbr) material may read a map on the second UV set, so that one keeps `uv1`.
 */
function normaliseAttributes(geometry: THREE.BufferGeometry, pbr: boolean): THREE.BufferGeometry {
  const plain = geometry.index && !geometry.hasAttribute('normal') ? geometry.toNonIndexed() : geometry;
  const kept = pbr ? ['position', 'normal', 'uv', 'uv1'] : ['position', 'normal', 'uv'];
  for (const name of Object.keys(plain.attributes)) if (!kept.includes(name)) plain.deleteAttribute(name);
  if (!plain.hasAttribute('normal')) plain.computeVertexNormals();
  if (!plain.hasAttribute('uv')) plain.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(plain.getAttribute('position').count * 2), 2));
  return plain;
}

export function prepare(scene: THREE.Object3D, descriptor: ModelDescriptor, ship: boolean, textures: Map<string, THREE.Texture>,
  anisotropy: number, twoSided = ship): PreparedModel | null {
  scene.updateMatrixWorld(true);
  const turn = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(descriptor.rotateY));
  const meshes: THREE.Mesh[] = [];
  scene.traverse(object => { if (geometryOf(object)) meshes.push(object); });
  if (meshes.length === 0) return null;
  const groups = new Map<string, { geometries: THREE.BufferGeometry[]; source: THREE.Material; glow: boolean; maps?: MapSet }>();
  meshes.forEach((mesh, index) => {
    const geometry = floatAttributes(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld).applyMatrix4(turn);
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
    group.geometries.push(normaliseAttributes(geometry, descriptor.pbr === true));
    groups.set(key, group);
  });
  const all = Array.from(groups.values()).flatMap(group => group.geometries);
  const box = new THREE.Box3();
  for (const geometry of all) { geometry.computeBoundingBox(); if (geometry.boundingBox) box.union(geometry.boundingBox); }
  const unit = descriptor.unit === true;
  const centre = unit ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  let radius = 0;
  for (const geometry of all) {
    geometry.translate(-centre.x, -centre.y, -centre.z);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) radius = Math.max(radius, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
  }
  const scale = unit ? 1 : ship ? 1 / Math.max(1e-6, extent.z) : 1 / Math.max(1e-6, radius);
  let sum = 0; let count = 0;
  const parts: ModelPart[] = [];
  for (const group of groups.values()) {
    if (scale !== 1) for (const geometry of group.geometries) geometry.scale(scale, scale, scale);
    // Parts merge only with the same attributes: one without the second UV set gets a blank one.
    if (group.geometries.some(geometry => geometry.hasAttribute('uv1'))) {
      for (const geometry of group.geometries) {
        if (!geometry.hasAttribute('uv1')) geometry.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      }
    }
    const geometry = group.geometries.length === 1 ? group.geometries[0] : merged(group.geometries);
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) { sum += Math.hypot(position.getX(i), position.getY(i), position.getZ(i)); count++; }
    const made = descriptor.pbr ? authored(group.source, anisotropy) : material(group.source, group.maps, group.glow, ship, textures, anisotropy);
    // Converted hulls carry some faces wound the wrong way; draw both sides rather than holes.
    if (twoSided) made.side = THREE.DoubleSide;
    parts.push({ geometry, material: made, glow: group.glow });
  }
  return { parts, radius: radius * scale, mean: count > 0 ? sum / count : radius * scale,
    size: extent.multiplyScalar(scale), engines: descriptor.engines ?? [], ...(descriptor.nozzle ? { nozzle: descriptor.nozzle } : {}) };
}

/**
 * Levels of detail: nodes `lod0`, `lod1`… prepared alike (a tool-normalised file keeps them in
 * register), the first as the model and the rest as its `lods`. A file without levels is one model.
 */
export function prepareLevels(scene: THREE.Object3D, descriptor: ModelDescriptor, ship: boolean, textures: Map<string, THREE.Texture>,
  anisotropy: number, twoSided = ship): PreparedModel | null {
  const count = descriptor.lods ?? 0;
  if (count === 0) return prepare(scene, descriptor, ship, textures, anisotropy, twoSided);
  scene.updateMatrixWorld(true);
  const levels: PreparedModel[] = [];
  for (let level = 0; level < count; level++) {
    const node = scene.getObjectByName(`lod${String(level)}`);
    const model = node ? prepare(node, descriptor, ship, textures, anisotropy, twoSided) : null;
    if (model) levels.push(model);
  }
  const [first, ...rest] = levels;
  if (!first) return null;
  first.lods = rest;
  return first;
}

/** The file's own material as authored (a class ship's PBR set), with the arena's map settings. */
function authored(source: THREE.Material, anisotropy: number): THREE.MeshStandardMaterial {
  const result = source instanceof THREE.MeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial();
  for (const texture of [result.map, result.normalMap, result.roughnessMap, result.metalnessMap, result.aoMap, result.emissiveMap]) {
    if (texture) texture.anisotropy = anisotropy;
  }
  if (result.map) result.map.colorSpace = THREE.SRGBColorSpace;
  if (result.emissiveMap) result.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  // The colour attribute is dropped with the rest (`normaliseAttributes`): read it, and WebGL
  // gives 0, a black surface (Enkaz).
  result.vertexColors = false;
  // The ship tool writes no tangents: the same convention as `material` below.
  if (result.normalMap) result.normalScale.set(1, -1);
  return result;
}

/**
 * One material per name across models: the station kit's pieces each carry the same material
 * and their own copy of its textures, and a building is dozens of pieces. A copy left unused
 * is never uploaded to the GPU. Unnamed materials stay apart.
 */
export function shareMaterials(models: readonly PreparedModel[]): void {
  const shared = new Map<string, THREE.MeshStandardMaterial>();
  const visit = (model: PreparedModel): void => {
    for (const part of model.parts) {
      const name = part.material.name;
      if (!name) continue;
      const first = shared.get(name);
      if (first) part.material = first; else shared.set(name, part.material);
    }
    for (const level of model.lods ?? []) visit(level);
  };
  for (const model of models) visit(model);
}

function material(source: THREE.Material, maps: MapSet | undefined, glow: boolean, ship: boolean,
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
  // GLTFLoader's convention for a mesh without tangents: three derives the tangent frame from
  // UV derivatives with V running against glTF's, so green is inverted. A V-flipped mesh was
  // turned back to glTF's orientation in `prepare`, so the same holds for it.
  if (normalMap) result.normalScale.set(1, -1);
  return result;
}

/** The loaders the pack's images go through; a test hands in fakes. */
export interface TextureLoaders {
  image(path: string): Promise<THREE.Texture>;
  /** A flat map or a cube, by what the file holds. */
  ktx2(path: string): Promise<THREE.Texture>;
  cube(faces: readonly string[]): Promise<THREE.CubeTexture>;
}

/**
 * A map of the pack. A KTX2 one arrives block-compressed with the mip chain its file carries:
 * the GPU cannot build mips for it. A webp one decodes to RGBA and gets its mips on upload.
 */
export async function loadTexture(loaders: TextureLoaders, path: string): Promise<THREE.Texture | null> {
  try {
    const compressed = path.endsWith('.ktx2');
    const result = compressed ? await loaders.ktx2(path) : await loaders.image(path);
    result.wrapS = THREE.RepeatWrapping; result.wrapT = THREE.RepeatWrapping;
    if (!compressed) { result.flipY = false; result.generateMipmaps = true; result.minFilter = THREE.LinearMipmapLinearFilter; }
    return result;
  } catch { return null; }
}

/** A map of the pack's texture table by its name (`mining-d`), in whichever format the pack has it. */
export function packTexture(textures: ReadonlyMap<string, THREE.Texture>, name: string): THREE.Texture | undefined {
  for (const [path, texture] of textures) if (path.endsWith(`/tex/${name}.webp`) || path.endsWith(`/tex/${name}.ktx2`)) return texture;
  return undefined;
}

async function cubeFaces(loaders: TextureLoaders, faces: readonly string[], anisotropy: number): Promise<THREE.CubeTexture | null> {
  try {
    const result = await loaders.cube(faces);
    result.colorSpace = THREE.SRGBColorSpace; result.generateMipmaps = true;
    result.minFilter = THREE.LinearMipmapLinearFilter; result.anisotropy = anisotropy;
    return result;
  } catch { return null; }
}

/** The sky: the pack's KTX2 cube when it has one (a quarter of the memory), else its six faces. */
export async function loadSky(loaders: TextureLoaders, faces: readonly string[], cube: string | undefined, anisotropy: number)
  : Promise<THREE.CubeTexture | THREE.CompressedCubeTexture | null> {
  if (cube) {
    try {
      const result = await loaders.ktx2(cube);
      if (result instanceof THREE.CompressedCubeTexture) { result.colorSpace = THREE.SRGBColorSpace; result.anisotropy = anisotropy; return result; }
    } catch { /* The six faces below. */ }
  }
  return cubeFaces(loaders, faces, anisotropy);
}

export const emptyArenaAssets = (): ArenaAssets => ({
  references: false, hero: null, rivals: [], classes: new Map(), colliders: new Map(), structures: new Map(),
  debris: [], cargo: null, sky: null, env: null,
  fx: new Map(), textures: new Map(), sounds: new Map(), music: [],
});

/**
 * Browsers whose tab dies well short of the full pack's ~580 MB of decoded textures
 * (owner 2026-10-21: an iPhone 12 mini, in Safari and Chrome — every iOS browser is
 * WebKit). An iPad asking for the desktop site reports a Mac with touch points.
 */
export function memoryTight(nav: { userAgent: string; maxTouchPoints: number; deviceMemory?: number }): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.userAgent.includes('Macintosh') && nav.maxTouchPoints > 1)
    || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
}

/** The KTX2 manifests (tools/arena-ktx2.mjs) first; the webp ones serve a pack not converted yet. */
export const PACKS = {
  full: ['/__ref/dist/v2/manifest-ktx2.json', '/__ref/dist/v2/manifest.json'],
  lite: ['/__ref/dist/v2/manifest-lite-ktx2.json', '/__ref/dist/v2/manifest-lite.json'],
} as const;
/**
 * The pack for a renderer that cannot start the transcoder (`ktx2Ready`, S22 2026-10-26): every
 * map webp at 512, class ships included (tools/arena-webp.mjs). Webp decodes to full RGBA on the
 * GPU, so it is the lite one whatever the device's memory.
 */
export const WEBP_PACK = '/__ref/dist/v2/manifest-lite.json';
export const packsFor = (lite: boolean, ktx2: boolean): readonly string[] => ktx2 ? lite ? PACKS.lite : PACKS.full : [WEBP_PACK];

/** The models the arena draws from a pack. With the class ships in it, the older hero and rivals are never drawn, so not loaded. */
/**
 * The effect textures the arena draws; the pack ships more (41 on 2026-10-22, 14 used) and the
 * rest would only hold GPU memory. A test keeps this in step with every `fx.get` in the code.
 */
export const ARENA_FX: readonly string[] = ['laserBlue', 'muzzleBlue', 'impactBlue', 'flare', 'glowDot', 'fire', 'explosionAtlas', 'shockwave',
  'smoke', 'steam', 'asteroidDebris', 'dust', 'nebulaBlue', 'nebulaPink'];

export const fxToLoad = (fx: Readonly<Record<string, string>>): [string, string][] => Object.entries(fx).filter(([key]) => ARENA_FX.includes(key));

/** The Rift's structures: KTX2, or their webp copies at 512 for a renderer without the transcoder. */
const structureModel = (key: string, webp: boolean): ModelDescriptor =>
  ({ model: `/assets/arena/${webp ? 'yarik-webp' : 'yarik'}/${key}.glb`, uvFlip: false, rotateY: 0, unit: true, pbr: true, lods: 3 });

export function modelsToLoad(m: ReferenceManifest, webp = false): { key: string; d: ModelDescriptor; ship: boolean }[] {
  return [
    ...(m.ships.classes ? [] : [{ key: 'hero', d: m.ships.hero, ship: true }, ...m.ships.rivals.map((d, i) => ({ key: `rival:${String(i)}`, d, ship: true }))]),
    ...SHIP_CLASSES.flatMap(name => { const d = m.ships.classes?.[name]; return d ? [{ key: `class:${name}`, d, ship: true }] : []; }),
    // Rock is drawn only from the collider models: the pack's older rock sets are not loaded.
    ...Object.entries(m.colliders ?? {}).map(([key, d]) => ({ key: `collider:${key}`, d, ship: false })),
    // The pack's exit ring, outposts, generator, relays, heart, wrecks and pad are not loaded:
    // the Rift draws only its own closed structures (owner 2026-10-22, items 4 and 7;
    // 15-yarik-haritasi §4.1), in metres like the colliders they are drawn over.
    ...STRUCTURE_CATALOG.map(({ key }) => ({ key: `structure:${key}`, d: structureModel(key, webp), ship: false })),
    ...m.props.debris.map((d, i) => ({ key: `debris:${String(i)}`, d, ship: false })),
    { key: 'cargo', d: m.props.cargo, ship: false },
  ];
}

/**
 * Loads the whole reference pack before the flight begins. A longer loading screen is
 * the deliberate price of a flight that never hitches on a first texture upload.
 */
export async function loadArenaAssets(references: boolean, anisotropy: number, onProgress: (p: LoadProgress) => void,
  fetcher: typeof fetch = fetch, lite = memoryTight(navigator), transcoder: Promise<KTX2Loader | null> = ktx2Ready()): Promise<ArenaAssets> {
  const assets = emptyArenaAssets();
  let manifest: ReferenceManifest | null = null;
  onProgress({ done: 0, total: 1, stage: 'manifest' });
  // KTX2 maps stay block-compressed on the GPU: a quarter of RGBA or less (plan §14.1, step 4).
  // The page's one transcoder, or none: then the webp pack, which needs no WebAssembly heap.
  const ktx2 = references ? await transcoder : null;
  // The lite pack halves every image; a server without it still serves the full one.
  for (const path of !references ? [] : !ktx2 ? [WEBP_PACK] : lite ? [...PACKS.lite, ...PACKS.full] : PACKS.full) {
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
  const loaders: TextureLoaders = {
    image: path => textureLoader.loadAsync(path),
    ktx2: path => ktx2 ? ktx2.loadAsync(path) : Promise.reject(new Error(`no transcoder for ${path}`)),
    cube: faces => new THREE.CubeTextureLoader().loadAsync([...faces]),
  };
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (ktx2) gltf.setKTX2Loader(ktx2);
  const descriptors = modelsToLoad(m, !ktx2);
  const texturePaths = new Set<string>(Object.values(m.textures));
  const soundEntries = Object.entries(m.sounds);
  const total = 2 + descriptors.length + texturePaths.size + fxToLoad(m.fx).length
    + soundEntries.reduce((sum, [, files]) => sum + files.length, 0);
  let done = 0;
  const tick = (stage: LoadProgress['stage']): void => { done++; onProgress({ done, total, stage }); };

  const prepared = new Map<string, PreparedModel>();
  [assets.sky, assets.env] = await Promise.all([
    loadSky(loaders, m.sky.faces, m.sky.cube, anisotropy).finally(() => { tick('sky'); }),
    cubeFaces(loaders, m.sky.env, anisotropy).finally(() => { tick('sky'); }),
  ]);
  await Promise.all(Array.from(texturePaths, async path => {
    const result = await loadTexture(loaders, path);
    if (result) assets.textures.set(path, result);
    tick('textures');
  }));
  await Promise.all(fxToLoad(m.fx).map(async ([key, path]) => {
    const result = await loadTexture(loaders, path);
    if (result) { result.colorSpace = THREE.SRGBColorSpace; result.flipY = true; result.wrapS = THREE.ClampToEdgeWrapping; result.wrapT = THREE.ClampToEdgeWrapping; assets.fx.set(key, result); }
    tick('textures');
  }));
  await Promise.all(descriptors.map(async ({ key, d, ship }) => {
    try {
      const scene = (await gltf.loadAsync(d.model)).scene;
      const structure = /^(structure|debris)/.test(key);
      const model = prepareLevels(scene, d, ship, assets.textures, anisotropy, ship || structure);
      if (model) prepared.set(key, model);
    } catch { /* A missing reference keeps its procedural stand-in. */ }
    tick('models');
  }));
  const list = (prefix: string): PreparedModel[] => Array.from(prepared).filter(([key]) => key.startsWith(prefix + ':')).map(([, value]) => value);
  assets.hero = prepared.get('hero') ?? null; assets.rivals = list('rival');
  for (const name of SHIP_CLASSES) { const model = prepared.get(`class:${name}`); if (model) assets.classes.set(name, model); }
  for (const [key, model] of prepared) {
    if (key.startsWith('collider:')) assets.colliders.set(key.slice('collider:'.length), model);
    if (key.startsWith('structure:')) assets.structures.set(key.slice('structure:'.length), model);
  }
  shareMaterials([...assets.structures.values()]);
  assets.debris = list('debris'); assets.cargo = prepared.get('cargo') ?? null;
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
