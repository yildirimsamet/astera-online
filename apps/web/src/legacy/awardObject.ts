/**
 * ONE AWARD AS A THREE.JS OBJECT, for the 3D showcase, the detail stage and the collection's
 * snapshots alike — one builder, so a piece never looks different in two places.
 *
 * Every object comes back standing on y = 0, centred on x/z, `art.size` tall in plinth units
 * (a plinth is one unit wide). The metal of a tier is a shader trick, not a material swap:
 * the downloaded models carry one atlas material each, so only the texels the model itself
 * marks metallic are recoloured, which keeps a wooden base wooden and a ribbon a ribbon.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MODEL_FACING, MODEL_POSE } from '../ui/assets.js';
import { posedCraft } from '../galaxy/model.js';
import type { LegacyArt, LegacyFinish } from './presentation.js';
import { buildCoin, buildGlobeStand, buildMedal, buildOrrery, buildPin } from './procedural.js';
import { FINISH, RIM_GLSL } from './finish.js';

const RIBBON = { a: '#13203d', b: '#2ab9a5' };

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const sources = new Map<string, Promise<THREE.Object3D>>();
const loadScene = (url: string): Promise<THREE.Object3D> => {
  let pending = sources.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then(gltf => gltf.scene);
    pending.catch(() => sources.delete(url));
    sources.set(url, pending);
  }
  return pending;
};

/** What the non-metal parts become: kept, a ribbon in the game's colours, or polished black stone. */
export type LegacyRest = 'keep' | 'ribbon' | 'obsidian';

/** Recolour metallic texels to the tier's metal; the rest becomes what `rest` says. */
export function tintMaterial(material: THREE.Material, finish: LegacyFinish, rest: LegacyRest): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  const tinted = material.clone();
  const { metal, glow, glowStrength } = FINISH[finish];
  const uniforms = {
    legacyMetal: { value: new THREE.Color(metal) },
    legacyGlow: { value: new THREE.Color(glow).multiplyScalar(glowStrength) },
    legacyRibbonA: { value: new THREE.Color(RIBBON.a) },
    legacyRibbonB: { value: new THREE.Color(RIBBON.b) },
  };
  tinted.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 legacyMetal; uniform vec3 legacyGlow; uniform vec3 legacyRibbonA; uniform vec3 legacyRibbonB;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
float legacyRimMask = 1.0;
{
  float legacyLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (metalnessFactor > 0.45) {
    diffuseColor.rgb = legacyMetal * (0.45 + 0.95 * legacyLuma);
    metalnessFactor = max(metalnessFactor, 0.92);
    roughnessFactor = min(roughnessFactor, 0.42);
  }${rest === 'ribbon' ? ` else {
    diffuseColor.rgb = mix(legacyRibbonA, legacyRibbonB, smoothstep(0.18, 0.62, legacyLuma));
  }` : rest === 'obsidian' ? ` else {
    diffuseColor.rgb = vec3(0.028, 0.032, 0.042) + legacyLuma * 0.05;
    metalnessFactor = 0.3;
    roughnessFactor = 0.22;
    legacyRimMask = 0.0;
  }` : ''}
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${RIM_GLSL.replace('legacyGlow * legacyRim', 'legacyGlow * legacyRim * legacyRimMask')}`);
  };
  tinted.customProgramCacheKey = () => `legacy-${finish}-${rest}`;
  return tinted;
}

/** Stand on y = 0, centre on x/z, scale to `height`. Measured after any turn. */
export function standOnPlinth(object: THREE.Object3D, height: number): THREE.Group {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
  const holder = new THREE.Group();
  holder.add(object);
  // Wide pieces must still fit a plinth: neither taller than asked nor wider than 0.9.
  holder.scale.setScalar(Math.min(height / (size.y || 1), 0.9 / (Math.max(size.x, size.z) || 1)));
  return holder;
}

export interface BuiltAward {
  object: THREE.Group;
  /** A hovering piece floats a hand above its plinth. */
  hovers: boolean;
  /** `spin` turns all the way round (a ship, a world); `sway` keeps a face to the room. */
  motion: 'spin' | 'sway';
  /**
   * Lit engines: the frame the posed craft sits in, and the model whose nozzles to use. The
   * flame itself is React (the game's own `Exhaust`), portalled into `mount` by the live scene.
   */
  engines?: { mount: THREE.Object3D; url: string };
  dispose: () => void;
}

const disposeTree = (root: THREE.Object3D, owned: Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>) => () => {
  for (const item of owned) item.dispose();
  root.removeFromParent();
};

export async function buildAward(art: LegacyArt, finish: LegacyFinish, edition: string | null): Promise<BuiltAward> {
  const owned = new Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>();
  if (art.kind === 'coin' || art.kind === 'pin' || art.kind === 'medal' || art.kind === 'orrery') {
    const piece = art.kind === 'coin' ? buildCoin(finish, edition, owned)
      : art.kind === 'pin' ? buildPin(finish, edition, owned)
      : art.kind === 'medal' ? buildMedal(finish, art.emblem, owned)
      : buildOrrery(finish, owned);
    const object = standOnPlinth(piece, art.kind === 'coin' ? 0.62 : art.kind === 'pin' ? 0.6 : art.kind === 'medal' ? 0.9 : 0.95);
    const hovers = art.kind === 'coin' || art.kind === 'pin';
    return { object, hovers, motion: 'sway', dispose: disposeTree(object, owned) };
  }
  const scene = await loadScene(art.url);
  if (art.kind === 'globe') {
    // The world fills the cradle: a fixed diameter whatever the model's own size.
    const { stand, socket } = buildGlobeStand(finish, owned);
    const world = scene.clone(true);
    const box = new THREE.Box3().setFromObject(world);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    world.position.sub(centre);
    const globe = new THREE.Group();
    globe.add(world);
    globe.scale.setScalar(0.46 / (Math.max(size.x, size.y, size.z) || 1));
    socket.add(globe);
    const object = standOnPlinth(stand, 0.95);
    return { object, hovers: false, motion: 'spin', dispose: disposeTree(object, owned) };
  }
  if (art.kind === 'craft') {
    const poseUrl = art.engines ?? art.url;
    const facing = MODEL_FACING[poseUrl];
    const craft = facing ? posedCraft(scene, facing, MODEL_POSE[poseUrl]) : scene.clone(true);
    // The craft and its engines share one frame, exactly as they do in flight.
    const mount = new THREE.Group();
    mount.add(craft);
    // A weapon stands on its tail like a monument; a ship or a world shows its three-quarter side.
    if (art.upright) mount.rotation.x = -Math.PI / 2;
    else if (poseUrl.includes('death_star')) mount.rotation.set(-0.7, 0.75, 0);
    else mount.rotation.set(-0.14, 0.75, 0);
    // A round body standing on its tail looks the same at every angle, so its turn was
    // invisible. A slight lean makes the turn read as a slow wobble of the nose.
    const lean = new THREE.Group();
    lean.add(mount);
    if (art.upright) lean.rotation.z = 0.26;
    const object = standOnPlinth(lean, art.size);
    // A launching weapon rides a hand above the plinth, so its flame has room under it.
    if (art.upright && art.flame) object.position.y = art.size * 0.2;
    return { object, hovers: !art.upright, motion: 'spin', dispose: disposeTree(object, owned),
      ...(art.flame ? { engines: { mount, url: art.engines ?? art.url } } : {}) };
  }
  const model = scene.clone(true);
  if (art.tint) {
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const tint = (material: THREE.Material) => {
        const next = tintMaterial(material, finish, art.ribbon ? 'ribbon' : art.obsidian ? 'obsidian' : 'keep');
        if (next !== material) owned.add(next);
        return next;
      };
      node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material as THREE.Material);
    });
  }
  if (art.turn) model.rotation.x = art.turn;
  const object = standOnPlinth(model, art.size);
  return { object, hovers: false, motion: 'sway', dispose: disposeTree(object, owned) };
}
