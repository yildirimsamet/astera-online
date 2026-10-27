import * as THREE from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '@astera/rules';
import {
  ARENA_CATALOG, ARENA_TUNING as T, obstacleSize, STRUCTURE_CATALOG, STRUCTURE_MESH_BASE, type ArenaLayout, type ArenaWorld, type BoxObstacle,
  type MeshObstacle, type Quaternion, type Vec3,
} from '@astera/rules/arena';
import { FARM_HEX } from '../farmColors.js';
import { packTexture, type ArenaAssets, type PreparedModel } from '../assets/load.js';
import { type BillboardEntry, createBillboards, createHalos } from './halos.js';
import { hullMaterial, setUniform, tickHull } from './materials.js';
import { catalogRock } from './procedural.js';

interface BatchMember { id: number; matrix: THREE.Matrix4; x: number; y: number; z: number; radius: number; slot: number; tint: THREE.Color | null }
const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();
const bounds = new THREE.Sphere();
const eyePoint = new THREE.Vector3();
const glowColor = new THREE.Color();

/**
 * Which level of detail a rock of bounding radius `radius`, `distance` metres from the eye,
 * draws. Full detail — the collider itself — wherever a ship can reach it within seconds;
 * lighter levels only far off, where the fog and the distance hide the difference.
 */
export function rockLevel(distance: number, radius: number): number {
  return distance < 300 + radius * 6 ? 0 : distance < 2400 + radius * 12 ? 1 : 2;
}

/** Shares of the rock's vertices the lighter levels keep. */
const LEVEL_SHARES = [0.35, 0.12] as const;
const simplifier = new SimplifyModifier();
const cornerKey = (p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number): string =>
  `${String(p.getX(i))},${String(p.getY(i))},${String(p.getZ(i))}`;

/**
 * A lighter copy of one rock part. Welded on position alone first: a UV seam splits a corner in
 * two, and the modifier would collapse the halves apart and open the seam into a crack. Edge
 * collapses keep surviving corners where they were, so each output corner takes its UV and
 * normal back from the source corner at the same spot.
 */
function simplified(source: THREE.BufferGeometry, share: number): THREE.BufferGeometry {
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', source.getAttribute('position'));
  shape.setIndex(source.index);
  const welded = mergeVertices(shape);
  const corners = welded.getAttribute('position').count;
  const result = simplifier.modify(welded, Math.floor(corners * (1 - share)));
  const position = source.getAttribute('position'); const uv = source.getAttribute('uv'); const normal = source.getAttribute('normal');
  // The collider stand-in has no UVs; every part has normals.
  const mapped = source.hasAttribute('uv');
  const original = new Map<string, number>();
  const used = source.index ? Array.from(source.index.array) : Array.from({ length: position.count }, (_, i) => i);
  for (const i of used) { const key = cornerKey(position, i); if (!original.has(key)) original.set(key, i); }
  const out = result.getAttribute('position');
  const uvs = new Float32Array(out.count * 2); const normals = new Float32Array(out.count * 3);
  for (let i = 0; i < out.count; i++) {
    const from = original.get(cornerKey(out, i)) ?? 0;
    if (mapped) { uvs[i * 2] = uv.getX(from); uvs[i * 2 + 1] = uv.getY(from); }
    normals[i * 3] = normal.getX(from); normals[i * 3 + 1] = normal.getY(from); normals[i * 3 + 2] = normal.getZ(from);
  }
  if (mapped) result.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  result.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  result.computeBoundingSphere();
  return result;
}

/**
 * The lighter levels of a rock model (Y3): each rock part simplified, its material shared; a
 * crystal's glowing shards stay as they are (few triangles, and their shape is the read).
 */
export function rockLevels(model: PreparedModel): PreparedModel[] {
  return LEVEL_SHARES.map(share => ({
    ...model, lods: [],
    parts: model.parts.map(part => part.glow ? part : { ...part, geometry: simplified(part.geometry, share) }),
  }));
}

/**
 * Every rock of one catalog shape in a draw per level of detail. Each frame only the
 * instances inside the camera's view and reach are written to the front of their level's
 * buffer, so a narrow portrait view pays for the quarter of the field it actually sees.
 */
export class RockBatch {
  /** Per level of detail, full first: one instanced mesh per model part. */
  readonly levels: THREE.InstancedMesh[][];
  readonly meshes: THREE.InstancedMesh[];
  private readonly counts: number[];
  constructor(readonly shape: number, readonly model: PreparedModel, readonly members: readonly BatchMember[]) {
    this.levels = [model, ...(model.lods ?? [])].map(level => level.parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, members.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (part.glow) { mesh.userData.glow = true; mesh.setColorAt(0, glowColor.set('#ffffff')); mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage); }
      else if (members.some(m => m.tint !== null)) {
        // Ore-veined rock: the whole rock leans to its farm's colour; plain rock stays white.
        mesh.userData.tinted = true; mesh.setColorAt(0, glowColor.set('#ffffff')); mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
      }
      mesh.frustumCulled = false; mesh.name = 'arena-rock'; mesh.count = 0;
      return mesh;
    }));
    this.meshes = this.levels.flat();
    this.counts = this.levels.map(() => 0);
  }
  cull(eye: THREE.Vector3, reach: number, world: ArenaWorld): void {
    this.counts.fill(0);
    for (const m of this.members) {
      const dx = m.x - eye.x; const dy = m.y - eye.y; const dz = m.z - eye.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance - m.radius > reach) continue;
      bounds.center.set(m.x, m.y, m.z); bounds.radius = m.radius;
      if (!frustum.intersectsSphere(bounds)) continue;
      const level = Math.min(rockLevel(distance, m.radius), this.levels.length - 1);
      const n = this.counts[level] ?? 0;
      for (const mesh of this.levels[level] ?? []) {
        mesh.setMatrixAt(n, m.matrix);
        if (mesh.userData.glow === true && m.slot >= 0) {
          // A crystal's glow follows its reserve: a dry one is dark and easy to tell apart.
          const reserve = (world.minerals[m.slot] ?? T.crystalReserve) / T.crystalReserve;
          const v = (0.2 + reserve * 0.8) * (world.dry[m.slot] ? 0.25 : 1);
          mesh.setColorAt(n, glowColor.setRGB(v, v, v));
        } else if (mesh.userData.tinted === true) {
          if (m.tint && m.slot >= 0 && !world.dry[m.slot]) mesh.setColorAt(n, m.tint); else mesh.setColorAt(n, glowColor.setRGB(1, 1, 1));
        }
      }
      this.counts[level] = n + 1;
    }
    this.levels.forEach((level, i) => {
      for (const mesh of level) {
        mesh.count = this.counts[i] ?? 0; mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    });
  }
}

export interface Stage {
  scene: THREE.Scene;
  sunDirection: THREE.Vector3;
  /** How deep the camera sits in a belt's haze, and its colour (for the post veil). */
  haze: { color: THREE.Color; amount: number };
  update(time: number, world: ArenaWorld, eye: THREE.Vector3): void;
  /** Keeps only the rock this camera can see within `reach` metres. Call before each render. */
  cull(camera: THREE.Camera, reach: number, world: ArenaWorld): void;
  dispose(): void;
}

// The sky's brightest light is the black hole's accretion glow on the +Z face.
const SUN = new THREE.Vector3(0.12, 0.32, 1).normalize();
const RED_STAR = new THREE.Vector3(1, 0.18, -0.25).normalize();

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Every rock and crystal drawn as its collider (Y2: the rock you see is the rock you hit):
 * the pack's model for its catalog shape, or the collider itself as a stand-in, at the
 * obstacle's exact position, turn and scale.
 */
export function buildRocks(assets: ArenaAssets, layout: ArenaLayout): RockBatch[] {
  const slots = new Map<number, number>();
  layout.deposits.forEach((index, slot) => slots.set(index, slot));
  // Ore-veined rock leans to its farm's colour; a crystal formation glows instead.
  const veinTint = (o: MeshObstacle): THREE.Color | null => {
    const slot = slots.get(o.id);
    if (slot === undefined || o.kind === 'crystal') return null;
    return new THREE.Color('#ffffff').lerp(new THREE.Color(FARM_HEX[layout.depositKinds[slot] ?? 0] ?? FARM_HEX[0]), 0.55);
  };
  const shapes = new Map<number, MeshObstacle[]>();
  for (const o of layout.obstacles) {
    if (o.shape !== 'mesh' || o.kind === 'structure') continue;
    const list = shapes.get(o.mesh) ?? [];
    list.push(o); shapes.set(o.mesh, list);
  }
  const position = new THREE.Vector3(); const turn = new THREE.Quaternion(); const scale = new THREE.Vector3();
  return Array.from(shapes, ([shape, obstacles]) => {
    const key = ARENA_CATALOG[shape]?.key;
    const model = (key === undefined ? undefined : assets.colliders.get(key)) ?? catalogRock(shape);
    // Built once per model: a pack model keeps its levels across flights.
    model.lods ??= rockLevels(model);
    return new RockBatch(shape, model, obstacles.map(o => ({
      id: o.id, x: o.p.x, y: o.p.y, z: o.p.z, radius: o.radius, slot: slots.get(o.id) ?? -1, tint: veinTint(o),
      matrix: new THREE.Matrix4().compose(position.set(o.p.x, o.p.y, o.p.z), turn.set(o.q.x, o.q.y, o.q.z, o.q.w), scale.setScalar(o.scale)),
    })));
  });
}

function instanced(model: PreparedModel, count: number): THREE.InstancedMesh[] {
  return model.parts.map(part => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    if (part.glow) mesh.userData.glow = true;
    return mesh;
  });
}

function placeModel(model: PreparedModel, scale: number): THREE.Group {
  const group = new THREE.Group();
  for (const part of model.parts) group.add(new THREE.Mesh(part.geometry, part.material));
  group.scale.setScalar(scale);
  return group;
}

/** Where each Rift structure is drawn: exactly its collider's pose, in metres (visual = collision). */
export function structurePlacements(layout: ArenaLayout): { id: number; key: string; position: Vec3; turn: Quaternion }[] {
  return layout.obstacles.flatMap(o => {
    if (o.kind !== 'structure' || o.shape !== 'mesh') return [];
    const key = STRUCTURE_CATALOG[o.mesh - STRUCTURE_MESH_BASE]?.key;
    return key ? [{ id: o.id, key, position: o.p, turn: o.q }] : [];
  });
}

/** Metres past which a structure is not drawn: the clear-space fog has already hidden it. */
export const STRUCTURE_FADE = 8000;

/**
 * A structure model with its levels of detail, each swapped in at a multiple of its size, and
 * nothing past `STRUCTURE_FADE` (the Rift has ~90 kit pieces: a draw call each, for fog).
 * The full model holds to ~1 km (owner 2026-10-22: a swap at ~160 m happened in plain sight
 * inside a building, and the coarse kit levels show hairline holes); a 10 % band each way
 * keeps a pilot hovering at the line from flickering between two levels.
 */
export function structureLevels(model: PreparedModel): THREE.LOD {
  const lod = new THREE.LOD();
  const swaps = [Math.max(900, model.radius * 8), Math.min(STRUCTURE_FADE - 1000, Math.max(2000, model.radius * 20))];
  lod.addLevel(placeModel(model, 1), 0, 0.1);
  (model.lods ?? []).forEach((level, i) => lod.addLevel(placeModel(level, 1), swaps[Math.min(i, 1)] ?? STRUCTURE_FADE, 0.1));
  lod.addLevel(new THREE.Object3D(), STRUCTURE_FADE);
  return lod;
}

/**
 * The pilot's lamp (owner 2026-10-22: inside a building you could not tell a wall from a room).
 * How deep the eye is in or at a structure: 1 within three quarters of a piece's reach, easing
 * to 0 at its bounding sphere. Out in open space the sun does the lighting.
 */
export function lampLevel(layout: ArenaLayout, p: Vec3): number {
  let level = 0;
  for (const s of layout.structures) {
    for (const index of s.colliders) {
      const o = layout.obstacles[index];
      if (!o) continue;
      const d = Math.sqrt((p.x - o.p.x) ** 2 + (p.y - o.p.y) ** 2 + (p.z - o.p.z) ** 2);
      if (d < o.radius) level = Math.max(level, smooth(o.radius, o.radius * 0.75, d));
      if (level === 1) return 1;
    }
  }
  return level;
}

// Lamp light on a surface: from the eye (the view-space origin), falling off over ~150 m, on the
// surface's own albedo whatever its metalness (a dark metal hull still shows its shape), a third
// of it even on faces turned away so a room never goes black.
const LAMP_GLSL = `
{
  float lampD = length(vViewPosition);
  float lampFall = lampLevel * 1.6 / (1.0 + lampD * lampD * 4.4e-5);
  float lampFace = 0.3 + 0.7 * max(dot(normal, vViewPosition / max(lampD, 1.0)), 0.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * lampFall * lampFace;
}`;

/** The lamp's uniform and lines, added after the scene's own lights. */
export function addLamp(shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }, level: { value: number }): void {
  shader.uniforms.lampLevel = level;
  shader.fragmentShader = `uniform float lampLevel;\n${shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${LAMP_GLSL}`)}`;
}

/**
 * Puts the lamp into a structure material's own shader: a few instructions on structure pixels
 * only, one shared uniform, no scene light (a three.js light costs every pixel of every material
 * and recompiles them all when it comes or goes). Idempotent: shared materials pass here often.
 */
export function withLamp<M extends THREE.Material>(material: M, level: { value: number }): M {
  if (material.userData.lamp === true) return material;
  material.userData.lamp = true;
  const compile = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    addLamp(shader, level);
  };
  material.customProgramCacheKey = () => `${key()}|lamp`;
  return material;
}

/**
 * For something that never moves once placed: its world matrices computed now, and every later
 * scene update skips it and all below it (perf study 2026-10-22: ~7 % of a frame went on
 * recomputing still rock, structures and glows).
 */
export function freezeStatic(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  object.traverse(o => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
}

/** No model loaded: the collider itself, flat-shaded, so what you see is still what you hit. */
function structureStandIn(layout: ArenaLayout, o: MeshObstacle, material: THREE.Material): THREE.Mesh {
  const mesh = layout.meshes[o.mesh];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh?.positions ?? [], 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh?.indices ?? new Uint32Array(), 1));
  geometry.computeVertexNormals();
  const result = new THREE.Mesh(geometry, material);
  result.scale.setScalar(o.scale);
  return result;
}

function boxMesh(o: BoxObstacle, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, o.hy * 2, o.hz * 2), material);
  mesh.position.set(o.p.x, o.p.y, o.p.z);
  // Local +X is (ux, 0, uz): a turn of atan2(-uz, ux) about +Y.
  mesh.rotation.y = Math.atan2(-o.uz, o.ux);
  return mesh;
}

/** A tall soft column of light that marks a place from across the arena. */
function beacon(texture: THREE.Texture | undefined, color: string, height: number, width: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  geometry.translate(0, height / 2, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, map: { value: texture ?? null }, strength: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vNear; void main(){ vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, position.y, 0.0, 1.0); mv.x += position.x;
      vNear = smoothstep(60.0, 220.0, length((modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz));
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float strength; varying vec2 vUv; varying float vNear;
      void main(){ float edge = pow(clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0), 2.4);
        float fade = smoothstep(0.0, 0.06, vUv.y) * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6);
        float pulse = 0.75 + 0.25 * sin(time * 2.0 - vUv.y * 9.0);
        gl_FragColor = vec4(color * edge * fade * pulse * strength * (0.25 + 0.75 * vNear), 1.0); }`,
  });
  return new THREE.Mesh(geometry, material);
}

const within = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, radius: number): boolean =>
  (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z) <= radius * radius;

/** The exit zone: a fresnel shell, faint face-on and bright at the edge, with slow scan bands. */
function exitDomeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color('#2ee6c8') }, time: { value: 0 }, strength: { value: 0.4 } },
    vertexShader: `varying vec3 vN; varying vec3 vView; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float strength; varying vec3 vN; varying vec3 vView; varying float vY;
      void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
        float band = smoothstep(0.86, 1.0, sin(vY * 0.25 - time * 1.2)) * 0.35;
        gl_FragColor = vec4(color * (rim * 0.55 + band * rim) * strength, 1.0); }`,
  });
}

/** The landing circle's hold arc: dim all round, filling bright as the 3 s hold runs. */
function exitRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color('#2ee6c8') }, progress: { value: 0 }, time: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 color; uniform float progress; uniform float time; varying vec2 vP;
      void main(){ float turn = fract(atan(vP.x, -vP.y) / 6.2831853 + 1.0);
        float segment = step(0.18, fract(turn * 24.0));
        float lit = step(turn, progress);
        float idle = 0.22 + 0.08 * sin(time * 2.2);
        gl_FragColor = vec4(color * segment * mix(idle, 1.6, lit), 1.0); }`,
  });
}

/**
 * Ninety big dark rocks for the far parallax: drawn without colliders, so all of each lies at
 * least a kilometre beyond the boundary (owner item 7: nothing you see is something you fly through).
 */
export function farRing(radius: number, halfHeight: number, random: () => number): { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number }[] {
  return Array.from({ length: 90 }, () => {
    const angle = random() * Math.PI * 2; const distance = radius + 1500 + random() * 6000;
    const y = (random() * 2 - 1) * halfHeight * 1.2;
    return { x: Math.cos(angle) * distance, y, z: Math.sin(angle) * distance,
      rx: random() * 6, ry: random() * 6, rz: random() * 6, scale: 80 + random() * 380 };
  });
}

/**
 * A soft dust puff: round falloff broken by two octaves of value noise, white with alpha, so a
 * sprite tints it. Built in code: the fx smoke is a frame sheet, which draws as hard blotches.
 */
function dustTexture(random: () => number): THREE.DataTexture {
  const size = 128; const grid = 8;
  const lattice = Array.from({ length: (grid + 1) * (grid + 1) }, () => random());
  const noise = (u: number, v: number, scale: number): number => {
    const x = (u * scale) % grid; const y = (v * scale) % grid;
    const ix = Math.floor(x); const iy = Math.floor(y); const fx = x - ix; const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number): number => lattice[(j % grid) * (grid + 1) + (i % grid)] ?? 0;
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size; const v = j / size;
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const fall = Math.max(0, 1 - r); const soft = fall * fall * (3 - 2 * fall);
      const n = noise(u, v, 4) * 0.65 + noise(u, v, 8) * 0.35;
      const k = (j * size + i) * 4;
      data[k] = 255; data[k + 1] = 255; data[k + 2] = 255;
      data[k + 3] = Math.round(255 * soft * (0.35 + 0.65 * n));
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Clear space (v6 §5): half gone at 3.5 km, nearly all by 6 km; lights still carry. */
const CLEAR_FOG = 0.00024;
/** Deep in a dust cloud: ~90 % gone at the 350 m dust sight (V6f). */
const DUST_FOG = 0.0043;
/** Scene fog density for how deep the eye is in a dense belt and in a dust cloud (each 0..1). */
export function fogDensity(belt: number, dust: number): number {
  return Math.max(CLEAR_FOG + belt * 0.0013, CLEAR_FOG + dust * (DUST_FOG - CLEAR_FOG));
}

export function buildStage(assets: ArenaAssets, layout: ArenaLayout, renderer: THREE.WebGLRenderer): Stage {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const hulls: THREE.Material[] = [];
  const random = mulberry32(7331);

  // Sky and image-based light. The background is the 2048² cube; lighting uses a small one.
  if (assets.sky) {
    scene.background = assets.sky; scene.backgroundIntensity = 0.95; scene.backgroundBlurriness = 0;
  } else scene.background = new THREE.Color('#03070d');
  const pmrem = new THREE.PMREMGenerator(renderer);
  // PMREM reads an image cube; a KTX2 sky lights the scene only through the pack's own env cube.
  const envSource = assets.env ?? (assets.sky instanceof THREE.CubeTexture ? assets.sky : null);
  if (envSource) {
    const env = pmrem.fromCubemap(envSource).texture;
    scene.environment = env; scene.environmentIntensity = 0.75; disposables.push(env);
  }
  pmrem.dispose();
  scene.fog = new THREE.FogExp2('#06111c', fogDensity(0, 0));

  const sun = new THREE.DirectionalLight('#e2ecff', 2.7);
  sun.position.copy(SUN).multiplyScalar(4000);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffb08a', 0.75);
  rim.position.copy(RED_STAR).multiplyScalar(4000);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#7fa6d6', '#4a4038', 0.85));

  // The sky's light source gets a soft halo far out; the bloom does the rest.
  const flare = assets.fx.get('flare');
  if (flare) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flare, color: '#cfeaff', transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    halo.position.copy(SUN).multiplyScalar(18000); halo.scale.setScalar(5200); scene.add(halo);
  }

  // --- Rock and crystal: one instanced draw per model part, culled per instance on the CPU.
  const batches = buildRocks(assets, layout);
  for (const batch of batches) for (const mesh of batch.meshes) scene.add(mesh);
  const pose = new THREE.Object3D();

  // Deposit halos in their farm's colour: what a miner is looking for from far away.
  // Veined rock gets a tighter halo than a crystal so the rock still reads as rock.
  const halo = assets.fx.get('glowDot') ?? assets.fx.get('flare');
  const haloEntries = layout.deposits.map((index, slot) => {
    const o = layout.obstacles[index];
    return { p: o?.p ?? { x: 0, y: 0, z: 0 }, color: FARM_HEX[layout.depositKinds[slot] ?? 1] ?? FARM_HEX[1],
      size: o ? obstacleSize(layout, o) * (o.kind === 'crystal' ? 5.5 : 3.4) : 0 };
  });
  const crystalHalos = createHalos(halo ?? null, haloEntries);
  scene.add(crystalHalos.mesh);

  // --- Structures: the colliders are the hull; models dress them.
  const detail = packTexture(assets.textures, 'mining-d');
  const wall = hullMaterial({ detail: detail ?? null, color: '#5f6b78', strip: '#2ee6c8' });
  const deckMaterial = hullMaterial({ detail: detail ?? null, color: '#66727e', strip: '#2ee6c8', deck: true });
  hulls.push(wall, deckMaterial);
  const beacons: THREE.Mesh[] = [];
  // Exits (owner 2026-10-22, item 5): no ring — a ring says "fly through", the rule is "stop
  // and wait". The zone is a faint dome you can see the edge of; the deck carries a landing
  // circle whose arc fills while the 3 s hold runs.
  const exitDomes: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; centre: THREE.Vector3 }[] = [];
  const exitRings: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>; centre: THREE.Vector3 }[] = [];
  const domeGeometry = new THREE.SphereGeometry(T.exitRadius, 48, 24);
  const ringGeometry = new THREE.RingGeometry(29, 33, 96, 1);
  ringGeometry.rotateX(-Math.PI / 2);
  disposables.push(domeGeometry, ringGeometry);
  for (const exit of layout.exits) {
    const dome = new THREE.Mesh(domeGeometry, exitDomeMaterial());
    dome.position.set(exit.x, exit.y, exit.z); dome.renderOrder = 2; scene.add(dome);
    exitDomes.push({ mesh: dome, centre: dome.position });
    const ring = new THREE.Mesh(ringGeometry, exitRingMaterial());
    ring.position.set(exit.x, exit.y - T.shipHitRadius + 0.4, exit.z); scene.add(ring);
    exitRings.push({ mesh: ring, centre: new THREE.Vector3(exit.x, exit.y, exit.z) });
    // A teal column over the deck: the exit read from kilometres away.
    const column = beacon(undefined, '#2ee6c8', 600, 46);
    column.position.set(exit.x, exit.y - T.shipHitRadius, exit.z); scene.add(column); beacons.push(column);
    disposables.push(dome.material, ring.material);
  }
  // The heart, the cave, the station, the wreck and the docks: one model each, at its collider's exact pose.
  const lamp = { value: 0 };
  let lampTime = 0;
  const standIn = withLamp(new THREE.MeshStandardMaterial({ color: '#59616b', roughness: 0.9, metalness: 0.1, flatShading: true }), lamp);
  disposables.push(standIn);
  for (const model of assets.structures.values()) {
    for (const level of [model, ...(model.lods ?? [])]) for (const part of level.parts) withLamp(part.material, lamp);
  }
  for (const { id, key, position, turn } of structurePlacements(layout)) {
    const o = layout.obstacles[id];
    if (o?.shape !== 'mesh') continue;
    const model = assets.structures.get(key);
    const object = model ? structureLevels(model) : structureStandIn(layout, o, standIn);
    if (object instanceof THREE.Mesh) disposables.push(object.geometry);
    object.position.set(position.x, position.y, position.z); object.quaternion.set(turn.x, turn.y, turn.z, turn.w);
    scene.add(object);
  }
  // A box collider is never invisible: drawn as the hull it is.
  for (const s of layout.structures) {
    for (const index of s.colliders) {
      const o = layout.obstacles[index];
      if (o?.shape === 'box') scene.add(boxMesh(o, s.decks.includes(index) ? deckMaterial : wall));
    }
  }

  // --- Dense belts carry their own haze. From outside it reads as coloured cloud; each
  // cloud fades out before the camera enters it, because a sprite wrapped around the lens
  // is a full screen of blended fill for nothing. Inside, the post veil and the scene fog
  // take over (one pass, no overdraw).
  const nebula = [assets.fx.get('nebulaBlue'), assets.fx.get('nebulaPink')];
  const palettes = [['#3d78c9', '#5a6fe0'], ['#8a5ac9', '#4f6ad8'], ['#3a8fc4', '#7a5cd0']] as const;
  // One instanced draw per texture (perf 2026-10-22): each entry was a Sprite and a draw call.
  type Cloud = BillboardEntry & { base: number; reach: number };
  const hazes: { cloud: ReturnType<typeof createBillboards>; entries: Cloud[] }[] = [];
  const nebulaEntries: Cloud[][] = [[], []];
  const belts: { field: (typeof layout.fields)[number]; tint: THREE.Color }[] = [];
  let beltIndex = 0;
  for (const field of layout.fields) {
    if (!field.dense) continue;
    const palette = palettes[beltIndex++ % palettes.length] ?? palettes[0];
    belts.push({ field, tint: new THREE.Color(palette[0]).lerp(new THREE.Color(palette[1]), 0.4) });
    for (let i = 0; i < 6; i++) {
      const base = 0.2 + random() * 0.06;
      const p = { x: field.p.x + (random() * 2 - 1) * field.radius * 0.85, y: field.p.y + (random() * 2 - 1) * field.height * 0.7,
        z: field.p.z + (random() * 2 - 1) * field.radius * 0.85 };
      const size = field.radius * (1.5 + random() * 1.0);
      nebulaEntries[i % 2]?.push({ p, color: palette[i % 2] ?? palette[0], size, turn: random() * 6.28, base, reach: size / 2 });
    }
  }
  nebulaEntries.forEach((entries, i) => {
    if (entries.length) hazes.push({ cloud: createBillboards(nebula[i] ?? null, entries, { blending: THREE.AdditiveBlending, fog: 'none' }), entries });
  });
  // --- Dust clouds (V6f): soft dun sprites all through the volume, not additive, so a ship a
  // little way in shows through few of them and one deep in it through many: the drawn cloud
  // agrees with the sight rule. They fade out before the lens like the belt haze; inside, the
  // fog closes to the dust sight instead.
  const dustMap = dustTexture(random);
  disposables.push(dustMap);
  for (const cloud of layout.dust) {
    const entries: Cloud[] = [];
    for (let placed = 0; placed < 46;) {
      const x = random() * 2 - 1; const y = random() * 2 - 1; const z = random() * 2 - 1;
      if (x * x + y * y + z * z > 1) continue;
      placed++;
      const base = 0.16 + random() * 0.08;
      const color = new THREE.Color('#a88d68').offsetHSL(0, 0, (random() - 0.5) * 0.1);
      const p = { x: cloud.p.x + x * cloud.radius * 0.8, y: cloud.p.y + y * cloud.radius * 0.8, z: cloud.p.z + z * cloud.radius * 0.8 };
      const size = 280 + random() * 240;
      entries.push({ p, color, size, turn: random() * 6.28, base, reach: size / 2 });
    }
    hazes.push({ cloud: createBillboards(dustMap, entries, { blending: THREE.NormalBlending, fog: 'mix', centre: cloud.p }), entries });
  }
  for (const { cloud } of hazes) scene.add(cloud.mesh);
  let hazeSpin = 0;
  const dustTint = new THREE.Color('#8a6f4c');
  const dustFog = new THREE.Color('#1c160f');

  const haze = { color: new THREE.Color('#2a4f86'), amount: 0 };
  const clearFog = new THREE.Color('#06111c');
  const fogTint = new THREE.Color();
  // Inside a belt: one nebula shell around the lens stands in for the clouds that faded
  // out. A single layer of fill, and rock nearer than its radius stays crisp in front of it.
  const shellMap = nebula[0]?.clone();
  if (shellMap) { shellMap.wrapS = THREE.MirroredRepeatWrapping; shellMap.wrapT = THREE.MirroredRepeatWrapping; shellMap.needsUpdate = true; }
  const shellMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
    uniforms: { map: { value: shellMap ?? null }, color: { value: new THREE.Color('#3d78c9') }, strength: { value: 0 }, drift: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float strength; uniform float drift; varying vec2 vUv; varying vec3 vDir;
      void main(){ vec2 uv = vUv * vec2(3.0, 1.6) + vec2(drift, 0.0);
        float a = texture2D(map, uv).r; float b = texture2D(map, uv * 1.7 + vec2(0.31, 0.57)).r;
        float cloud = clamp(a * 0.65 + b * 0.5, 0.0, 1.0);
        float band = 0.55 + 0.45 * (1.0 - abs(vDir.y));
        gl_FragColor = vec4(color * (0.25 + cloud * 1.1) * band * strength, 1.0); }`,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), shellMaterial);
  shell.frustumCulled = false; shell.renderOrder = 4; shell.visible = false;
  scene.add(shell);

  // --- Far parallax: big dark rock beyond the boundary gives the void a scale. Ninety of
  // them are always drawn, so they are the field rock with the fewest triangles.
  const lightest = ARENA_CATALOG.map((entry, shape) => ({ entry, shape })).filter(({ entry }) => entry.family === 'rock')
    .sort((a, b) => a.entry.glowFrom - b.entry.glowFrom)[0]?.shape ?? 0;
  // Always 4 km or more away: the lightest level of detail.
  const lightModel = batches.find(batch => batch.shape === lightest)?.model;
  const far = lightModel?.lods?.at(-1) ?? lightModel ?? catalogRock(lightest);
  {
    const ring = farRing(layout.radius, layout.halfHeight, random);
    const ringMeshes = instanced(far, ring.length);
    ring.forEach((rock, i) => {
      pose.position.set(rock.x, rock.y, rock.z); pose.rotation.set(rock.rx, rock.ry, rock.rz); pose.scale.setScalar(rock.scale); pose.updateMatrix();
      for (const mesh of ringMeshes) mesh.setMatrixAt(i, pose.matrix);
    });
    for (const mesh of ringMeshes) { mesh.computeBoundingSphere(); scene.add(mesh); }
  }

  // --- The boundary: a faint grid that only shows when you are close to it.
  const boundary = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { eye: { value: new THREE.Vector3() }, color: { value: new THREE.Color('#2ee6c8') } },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 eye; uniform vec3 color; varying vec3 vP;
      void main(){ float d = distance(vP, eye); float near = 1.0 - smoothstep(60.0, ${String(T.boundaryWarn + 160)}.0, d);
        vec2 g = abs(fract(vec2(atan(vP.z, vP.x) * ${layout.radius.toFixed(1)}, vP.y) / 40.0) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));
        gl_FragColor = vec4(color * (line * 0.9 + 0.08) * near, 1.0); }`,
  });
  const wallMesh = new THREE.Mesh(new THREE.CylinderGeometry(layout.radius, layout.radius, layout.halfHeight * 2, 128, 1, true), boundary);
  scene.add(wallMesh);

  // Everything placed above stays put; only the haze shell follows the eye.
  for (const child of scene.children) if (child !== shell) freezeStatic(child);
  return {
    scene, sunDirection: SUN.clone(), haze,
    update(time, world, eye) {
      for (const material of hulls) tickHull(material, time);
      // The lamp eases in and out over about a third of a second.
      lamp.value += (lampLevel(layout, eye) - lamp.value) * Math.min(1, Math.max(0, time - lampTime) * 3);
      lampTime = time;
      setUniform(boundary, 'eye', eye);
      for (const column of beacons) {
        const material = column.material;
        if (material instanceof THREE.ShaderMaterial) setUniform(material, 'time', time);
      }
      const pilot = world.pilot;
      const hold = pilot.extraction / (T.exitHold * T.tickRate);
      for (const { mesh, centre } of exitDomes) {
        const inside = within(centre, pilot.p, T.exitRadius);
        setUniform(mesh.material, 'time', time);
        // Brighter edge while you are in it: the border you must not leave.
        setUniform(mesh.material, 'strength', inside ? 0.8 : 0.3);
      }
      for (const { mesh, centre } of exitRings) {
        const inside = within(centre, pilot.p, T.exitRadius);
        setUniform(mesh.material, 'progress', inside ? hold : 0);
        setUniform(mesh.material, 'time', time);
      }
      hazeSpin += 0.00025;
      for (const { cloud, entries } of hazes) {
        let shown = false;
        entries.forEach(({ p, base, reach }, i) => {
          const near = smooth(reach * 0.55, reach * 1.1, Math.sqrt((p.x - eye.x) ** 2 + (p.y - eye.y) ** 2 + (p.z - eye.z) ** 2));
          cloud.setOpacity(i, near > 0.01 ? base * near : 0);
          shown ||= near > 0.01;
        });
        cloud.mesh.visible = shown;
        cloud.setSpin(hazeSpin);
      }
      haloEntries.forEach(({ p, size }, slot) => {
        const reserve = (world.minerals[slot] ?? T.crystalReserve) / T.crystalReserve;
        const near = smooth(size * 0.12, size * 0.4, Math.sqrt((p.x - eye.x) ** 2 + (p.y - eye.y) ** 2 + (p.z - eye.z) ** 2));
        crystalHalos.setOpacity(slot, (world.dry[slot] ? 0.05 : 0.18 + reserve * 0.42 + 0.06 * Math.sin(time * 2 + slot)) * near);
      });
      // Inside a dense belt (and a little before its edge) the haze thickens; in the open, space is clear.
      let inside = 0;
      for (const { field, tint } of belts) {
        const dx = (eye.x - field.p.x) / (field.radius * 1.2); const dy = (eye.y - field.p.y) / (field.height * 1.3);
        const dz = (eye.z - field.p.z) / (field.radius * 1.2);
        const depth = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
        if (depth > inside) { inside = depth; haze.color.copy(tint); }
      }
      const thick = Math.min(1, inside * 1.8);
      // In a dust cloud the murk closes in over its outer 150 m and the sky goes nearly out.
      let dust = 0;
      for (const cloud of layout.dust) dust = Math.max(dust, Math.min(1, (cloud.radius - eye.distanceTo(cloud.p)) / 150));
      if (dust > thick) haze.color.copy(dustTint);
      const murk = Math.max(thick, dust);
      haze.amount = thick * 0.06 + dust * 0.03;
      scene.backgroundIntensity = 0.95 - Math.max(thick * 0.25, dust * 0.92);
      shell.visible = murk > 0.01;
      if (shell.visible) {
        shell.position.copy(eye);
        setUniform(shellMaterial, 'strength', Math.max(thick * 0.34, dust * 0.12)); setUniform(shellMaterial, 'drift', time * 0.004);
        setUniform(shellMaterial, 'color', haze.color);
      }
      // Fogged rock fades towards the dark of space: a bright fog colour turned distant
      // rock into flat pale cut-outs against the darker sky.
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = fogDensity(thick, dust);
        crystalHalos.setFog(scene.fog.density);
        scene.fog.color.copy(clearFog).lerp(fogTint.copy(haze.color).multiplyScalar(0.08), thick).lerp(dustFog, dust);
        for (const { cloud } of hazes) cloud.setFog(scene.fog.density, scene.fog.color);
      }
    },
    cull(camera, reach, world) {
      // Rock past the point where the fog is ~99 % opaque cannot be seen: do not draw it.
      if (scene.fog instanceof THREE.FogExp2) reach = Math.min(reach, 2.15 / scene.fog.density);
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      const eye = camera.getWorldPosition(eyePoint);
      for (const batch of batches) batch.cull(eye, reach, world);
    },
    dispose() {
      const released = new Set<unknown>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          const geometry: unknown = object.geometry;
          if (geometry instanceof THREE.BufferGeometry && !released.has(geometry)) { released.add(geometry); geometry.dispose(); }
          const materials: unknown[] = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) if (material instanceof THREE.Material && !released.has(material)) { released.add(material); material.dispose(); }
        }
      });
      for (const item of disposables) item.dispose();
    },
  };
}
