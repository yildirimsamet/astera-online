import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlanetSkinStatus } from '@astera/rules';
import { planetModel } from '../ui/assets.js';
import { planetSkinVisual } from '../ui/planetSkins.js';
import { createCountryRecoveryMaterial, createPlanetSkinMaterial } from './planetSkinMaterial.js';
import { planetSurface } from './planetSurface.js';
import type { PlanetLod } from './planetLod.js';
import { placeBodies, placePickSpheres, seat, settleMembers } from './planetPick.js';
import { bodyLight } from './PlanetField.jsx';
import type { PlanetNode, Vec3Tuple } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { HitboxMaterial } from './hitboxDebug.jsx';
import { sphereInFrustum } from './frustum.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.jsx';
import { PlanetSkinAttachments } from './PlanetSkinAttachments.jsx';
import {
  PLANET_SKIN_BODY_SCALE,
  PLANET_SKIN_FULL_ANGULAR_RADIUS,
  PLANET_SKIN_MODEL_ANGULAR_RADIUS,
  PLANET_SKIN_SPIN_RATE,
  planetSkinPhase,
} from './planetSkinAttachments.js';

type SkinNode = Pick<PlanetNode, 'id' | 'position' | 'radius' | 'stance' | 'intel'>;

export type PlanetSkinLod = 'full' | 'low' | 'billboard';
export type PlanetSkinBillboardMode = 'all' | 'near' | 'far';

/** Palette/status buckets share the same meshes returned by the GLTF cache. */
const UNIT_PLANET_GEOMETRY_CACHE = new WeakMap<THREE.Mesh, THREE.BufferGeometry>();

export function planetSkinLod(radius: number, distance: number): PlanetSkinLod {
  if (radius >= distance * PLANET_SKIN_FULL_ANGULAR_RADIUS) return 'full';
  if (radius >= distance * PLANET_SKIN_MODEL_ANGULAR_RADIUS) return 'low';
  return 'billboard';
}

export function planetSkinBillboardVisible(
  lod: PlanetSkinLod,
  mode: PlanetSkinBillboardMode,
): boolean {
  if (mode === 'all') return true;
  return mode === 'far' ? lod === 'billboard' : lod !== 'billboard';
}

/** gltfpack positions are often quantised integers; bake transforms only in floats. */
export function unitPlanetGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const cached = UNIT_PLANET_GEOMETRY_CACHE.get(mesh);
  if (cached) return cached;
  mesh.updateWorldMatrix(true, false);
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    const source = attribute;
    const values = new Float32Array(source.count * source.itemSize);
    for (let i = 0; i < source.count; i++) {
      const at = i * source.itemSize;
      values[at] = source.getX(i);
      if (source.itemSize > 1) values[at + 1] = source.getY(i);
      if (source.itemSize > 2) values[at + 2] = source.getZ(i);
      if (source.itemSize > 3) values[at + 3] = source.getW(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, source.itemSize));
  }
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere && sphere.radius > 0) {
    geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
    geometry.scale(1 / sphere.radius, 1 / sphere.radius, 1 / sphere.radius);
    geometry.computeBoundingSphere();
  }
  UNIT_PLANET_GEOMETRY_CACHE.set(mesh, geometry);
  return geometry;
}

const firstMesh = (scene: THREE.Object3D): THREE.Mesh | null => {
  let found: THREE.Mesh | null = null;
  scene.traverse((node) => {
    if (!found && node instanceof THREE.Mesh) found = node;
  });
  return found;
};

/*
  A LOOK'S TIER IS BUILT ONCE A SESSION (code review, 2026-09-25). A fast zoom empties a
  tier's group and fills it again, and each refill remounted it from scratch: the unit
  geometry copied attribute by attribute, the material cloned. Kept per model file (and per
  dress), a remount is a count and a few matrices. Bounded by the files there are — sixteen
  looks at three tiers, and the skins — so nothing here is ever disposed.
*/
const GEOMETRY = new Map<string, THREE.BufferGeometry>();
const DRESSED = new Map<string, Dressed>();

/** A model file's unit geometry, built the first time it is asked for. */
export function cachedGeometry(url: string, mesh: THREE.Mesh): THREE.BufferGeometry {
  let geometry = GEOMETRY.get(url);
  if (!geometry) {
    geometry = unitPlanetGeometry(mesh);
    GEOMETRY.set(url, geometry);
  }
  return geometry;
}

/** A model file's material in one dress, dressed the first time it is asked for. */
export function cachedDress(url: string, key: string, source: THREE.Material, dress: Dress): Dressed {
  const id = `${url}|${key}`;
  let dressed = DRESSED.get(id);
  if (!dressed) {
    dressed = dress(source);
    DRESSED.set(id, dressed);
  }
  return dressed;
}

/** What a model's own material becomes on the disc, and the clock a shader finish reads. */
interface Dressed {
  material: THREE.Material;
  uniforms: { time: { value: number } } | null;
}
type Dress = (source: THREE.Material) => Dressed;

/** A default world at full detail: matte, every detail map, a night floor (`planetSurface`). */
const dressFull: Dress = (source) => ({ material: planetSurface(source, true), uniforms: null });

/** A default world seen small: the colour map alone, matte, a night floor (`planetSurface`). */
const dressLite: Dress = (source) => ({ material: planetSurface(source, false), uniforms: null });

/**
 * THE FIRST CLOSE LOOK COSTS NO FRAME (code review, 2026-09-25). The first world drawn
 * on its light or full model compiled that dress's shader, and the first full model of a
 * look uploaded three 1024 maps — both inside one frame, a stall of up to a few hundred
 * milliseconds on a phone while hopping from world to world.
 *
 * So both dresses are compiled up front on one world's own model, with the scene's lights,
 * off the frame where the browser can (`compileAsync`). A shader is shared by every look
 * dressed alike, so one world warms them all — and it is the cached material the worlds
 * will draw with (`cachedDress`). That world's full maps are then uploaded while the page
 * is idle: the commander's own, where the camera starts.
 */
export function PlanetWarmup({ id }: { id: string }) {
  const liteUrl = planetModel(id, 'lite');
  const fullUrl = planetModel(id, 'full');
  const lite = useGLTF(liteUrl, false);
  const full = useGLTF(fullUrl, false);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const probes = new THREE.Group();
    const maps: THREE.Texture[] = [];
    for (const [url, key, dress, model] of [
      [liteUrl, 'lite', dressLite, lite.scene],
      [fullUrl, 'full', dressFull, full.scene],
    ] as const) {
      const mesh = firstMesh(model);
      const source = mesh && (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
      if (!mesh || !source) continue;
      const { material } = cachedDress(url, key, source, dress);
      // Instanced and coloured as the worlds are, so the program compiled is the one they use.
      const probe = new THREE.InstancedMesh(cachedGeometry(url, mesh), material, 1);
      probe.setColorAt(0, new THREE.Color(1, 1, 1));
      probes.add(probe);
      if (key === 'full' && material instanceof THREE.MeshStandardMaterial) {
        for (const map of [material.map, material.normalMap, material.roughnessMap]) if (map) maps.push(map);
      }
    }
    let live = true;
    let idle = 0;
    // Safari still has no idle callback; a short timeout is the next best quiet moment.
    const supportsIdle = 'requestIdleCallback' in window;
    void gl.compileAsync(probes, camera, scene).then(() => {
      if (!live) return;
      const upload = () => { for (const map of maps) gl.initTexture(map); };
      idle = supportsIdle ? window.requestIdleCallback(upload, { timeout: 2000 }) : window.setTimeout(upload, 200);
    });
    return () => {
      live = false;
      if (supportsIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [gl, camera, scene, lite.scene, full.scene, liteUrl, fullUrl]);

  return null;
}

/** Used by the galaxy and the interactive shop preview. One draw call per look. */
export function PlanetSkinModel({
  skinId,
  status,
  nodes,
  onSelect,
  galaxyLod = false,
  previewPhaseOffset = 0,
}: {
  skinId: string;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  /** The shop preview has no billboard peer, so only the galaxy enables switching. */
  galaxyLod?: boolean;
  previewPhaseOffset?: number;
}) {
  const visual = useMemo(() => planetSkinVisual(skinId, status), [skinId, status]);
  if (!visual) return null;
  return (
    <LoadedPlanetSkinModel
      visual={visual}
      status={status}
      nodes={nodes}
      onSelect={onSelect}
      galaxyLod={galaxyLod}
      previewPhaseOffset={previewPhaseOffset}
    />
  );
}

function LoadedPlanetSkinModel({
  visual,
  status,
  nodes,
  onSelect,
  galaxyLod,
  previewPhaseOffset,
}: {
  visual: NonNullable<ReturnType<typeof planetSkinVisual>>;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  galaxyLod: boolean;
  previewPhaseOffset: number;
}) {
  const loaded = useGLTF(
    [visual.modelUrl, visual.lowModelUrl],
    false,
  );
  const scene = loaded[0]!.scene;
  const lowScene = loaded[1]!.scene;
  const model = useMemo(() => firstMesh(scene), [scene]);
  const lowModel = useMemo(() => firstMesh(lowScene), [lowScene]);
  const geometry = useMemo(() => model ? unitPlanetGeometry(model) : null, [model]);
  const lowGeometry = useMemo(
    () => lowModel ? unitPlanetGeometry(lowModel) : null,
    [lowModel],
  );
  const dressed = useMemo(() => {
    if (!model) return null;
    const source = Array.isArray(model.material) ? model.material[0] : model.material;
    if (!source) return null;
    if (visual.finish.kind === 'PALETTE') return createPlanetSkinMaterial(source, visual.finish);
    return { material: visual.finish.damaged ? createCountryRecoveryMaterial(source) : source.clone(), uniforms: null };
  }, [model, visual]);
  const lowDressed = useMemo(() => {
    if (!lowModel) return null;
    const source = Array.isArray(lowModel.material) ? lowModel.material[0] : lowModel.material;
    if (!source) return null;
    if (visual.finish.kind === 'PALETTE') return createPlanetSkinMaterial(source, visual.finish);
    return { material: visual.finish.damaged ? createCountryRecoveryMaterial(source) : source.clone(), uniforms: null };
  }, [lowModel, visual]);
  const fullBody = useRef<THREE.InstancedMesh>(null);
  const lowBody = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const hitNodes = useRef<SkinNode[]>([]);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const projection = useMemo(() => new THREE.Matrix4(), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);

  useEffect(() => () => {
    // Geometry is owned by the weak GLTF mesh cache and shared by every look.
    dressed?.material.dispose();
    lowDressed?.material.dispose();
  }, [dressed, lowDressed]);

  useLayoutEffect(() => {
    for (const mesh of [fullBody.current, lowBody.current, hits.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (mesh === hits.current) continue;
      mesh.setColorAt(0, tint.setRGB(1, 1, 1));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
    }
  }, [tint]);

  useFrame(({ camera, clock }) => {
    if (dressed?.uniforms) dressed.uniforms.time.value = clock.elapsedTime;
    if (lowDressed?.uniforms) lowDressed.uniforms.time.value = clock.elapsedTime;
    const full = fullBody.current;
    const low = lowBody.current;
    if (!full || !low) return;
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    let fullCount = 0;
    let lowCount = 0;
    let hitCount = 0;
    let seated = false;
    nodes.forEach((node) => {
      const distance = camera.position.distanceTo(helper.position.set(...node.position));
      const lod = galaxyLod ? planetSkinLod(node.radius, distance) : 'full';
      if (lod === 'billboard') return;
      if (!sphereInFrustum(frustum, node.position, node.radius)) return;
      helper.position.set(...node.position);
      helper.rotation.set(
        0,
        planetSkinPhase(node.id) + previewPhaseOffset + clock.elapsedTime * PLANET_SKIN_SPIN_RATE,
        0,
      );
      helper.scale.setScalar(node.radius * PLANET_SKIN_BODY_SCALE);
      helper.updateMatrix();
      const mesh = lod === 'full' ? full : low;
      const index = lod === 'full' ? fullCount++ : lowCount++;
      mesh.setMatrixAt(index, helper.matrix);
      const light = bodyLight(node.stance, node.intel);
      const cool = node.intel === 'RESOLVED' ? [1, 1, 1] : [0.72, 0.84, 1];
      mesh.setColorAt(index, tint.setRGB(light * cool[0]!, light * cool[1]!, light * cool[2]!));
      hits.current?.setMatrixAt(hitCount, helper.matrix);
      if (seat(hitNodes.current, hitCount, node)) seated = true;
      hitCount += 1;
    });
    for (const [mesh, count] of [[full, fullCount], [low, lowCount]] as const) {
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    /*
      MEASURED AGAIN WHEN THE MEMBERS MOVE. The spheres are compacted with the bodies, so the
      bounding sphere three measured at the first raycast went stale as worlds came into range
      or view — a skinned world could not be tapped (F9's phone fault, on this path).
    */
    if (hits.current) {
      settleMembers(hits.current, hitNodes.current, hitCount, seated);
      hits.current.visible = hitCount > 0;
    }
  });

  if (!geometry || !lowGeometry || !dressed || !lowDressed || nodes.length === 0) return null;
  const select = (event: ThreeEvent<PointerEvent>) => {
    if (!wasTap()) return;
    const node = hitNodes.current[event.instanceId ?? -1];
    if (!node || !onSelect) return;
    markHit();
    event.stopPropagation();
    onSelect(node.id);
  };

  return (
    <>
      <instancedMesh
        ref={fullBody}
        name="planet-skin-models-full"
        args={[geometry, dressed.material, nodes.length]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={lowBody}
        name="planet-skin-models-low"
        args={[lowGeometry, lowDressed.material, nodes.length]}
        frustumCulled={false}
        raycast={() => null}
      />
      <SkinAssetBoundary fallback={null}>
        <Suspense fallback={null}>
          <PlanetSkinAttachments
            attachments={visual.includedAttachments}
            finish={visual.finish}
            planetGeometry={geometry}
            nodes={nodes}
            galaxyLod={galaxyLod}
            avoidFractures={status === 'RECOVERY_SHIELD'}
          />
        </Suspense>
      </SkinAssetBoundary>
      {onSelect && (
        <instancedMesh
          ref={hits}
          name="planet-skin-hits"
          args={[undefined, undefined, nodes.length]}
          frustumCulled={false}
          onPointerUp={select}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <HitboxMaterial kind="planet" />
        </instancedMesh>
      )}
    </>
  );
}

/**
 * ONE OF THE SIXTEEN DEFAULT WORLDS IN 3D (F9 · K7): the look's light or full model,
 * instanced — one draw per look and tier. `capacity` is every world of the look, so a
 * world moving between tiers as the camera zooms changes a count, not a mesh.
 */
export function DefaultPlanetModel({
  url,
  lod,
  nodes,
  capacity,
  onSelect,
}: {
  url: string;
  lod: PlanetLod;
  nodes: readonly SkinNode[];
  capacity: number;
  onSelect?: (id: string) => void;
}) {
  return (
    <ModelInstances
      name={`planet-models-${lod}`}
      modelUrl={url}
      // Only a world the camera is close to binds its detail maps; a speck and a planet do not.
      dress={lod === 'full' ? dressFull : dressLite}
      dressKey={lod === 'full' ? 'full' : 'lite'}
      turning={lod !== 'far'}
      nodes={nodes}
      capacity={Math.max(capacity, nodes.length)}
      onSelect={onSelect}
    />
  );
}

function ModelInstances({
  name,
  modelUrl,
  dress,
  dressKey,
  nodes,
  capacity,
  onSelect,
  turning = true,
}: {
  name: string;
  modelUrl: string;
  dress: Dress;
  /** Which dress this is, for the session's material cache (`cachedDress`). */
  dressKey: string;
  /** Whether its worlds turn on their axis every frame; a speck does not. */
  turning?: boolean;
  nodes: readonly SkinNode[];
  capacity: number;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const { scene } = useGLTF(modelUrl, false);
  const model = useMemo(() => firstMesh(scene), [scene]);
  const geometry = useMemo(() => model ? cachedGeometry(modelUrl, model) : null, [model, modelUrl]);
  const dressed = useMemo(() => {
    if (!model) return null;
    const source = Array.isArray(model.material) ? model.material[0] : model.material;
    if (!source) return null;
    return cachedDress(modelUrl, dressKey, source, dress);
  }, [model, modelUrl, dressKey, dress]);
  const body = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const tint = useMemo(() => new THREE.Color(), []);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const mesh = body.current;
    if (!mesh) return;
    // Drawn as many as are in this tier now; the mesh holds room for the whole look.
    mesh.count = nodes.length;
    // Placed here, with the members, and measured for the raycaster (`planetPick.ts`).
    if (hits.current) placePickSpheres(hits.current, nodes);
    // A tier that does not turn is placed here once; a turning one each frame below.
    if (!turning) placeBodies(mesh, nodes, 0);
    nodes.forEach((node, i) => {
      const light = bodyLight(node.stance, node.intel);
      const cool = node.intel === 'RESOLVED' ? [1, 1, 1] : [0.72, 0.84, 1];
      mesh.setColorAt(i, tint.setRGB(light * cool[0]!, light * cool[1]!, light * cool[2]!));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
    // The disc draws on demand: worlds that joined this tier as the camera came to rest
    // are placed by the next frame, so ask for one rather than wait for the next move.
    invalidate();
    // A new capacity or geometry is a new mesh, and a new mesh has to be placed again.
  }, [nodes, tint, dressed, invalidate, capacity, geometry, turning]);

  useFrame(({ clock }) => {
    if (dressed?.uniforms) dressed.uniforms.time.value = clock.elapsedTime;
    // A speck is placed with its members and never turns (`placeBodies`).
    if (!turning) return;
    const mesh = body.current;
    if (!mesh) return;
    placeBodies(mesh, nodes, clock.elapsedTime);
  });

  if (!geometry || !dressed || nodes.length === 0 || capacity === 0) return null;
  const select = (event: ThreeEvent<PointerEvent>) => {
    if (!wasTap()) return;
    const node = nodes[event.instanceId ?? -1];
    if (!node || !onSelect) return;
    markHit();
    event.stopPropagation();
    onSelect(node.id);
  };

  return (
    <>
      <instancedMesh
        ref={body}
        name={name}
        args={[geometry, dressed.material, capacity]}
        frustumCulled={false}
        raycast={() => null}
        // The geometry and material are the session's (`cachedGeometry`), not the mesh's.
        dispose={null}
      />
      {onSelect && (
        <instancedMesh
          ref={hits}
          name={`${name}-hits`}
          args={[undefined, undefined, capacity]}
          frustumCulled={false}
          onPointerUp={select}
        >
          <sphereGeometry args={[1, 12, 8]} />
          {/* Unpainted, its material is not drawn and it is still raycast (`hitboxMaterialProps`). */}
          <HitboxMaterial kind="planet" />
        </instancedMesh>
      )}
    </>
  );
}

/** Convenience shape for the shop's single world, without a galaxy payload. */
export const previewSkinNode = (id: string): SkinNode => ({
  id,
  position: [0, 0, 0] as Vec3Tuple,
  radius: 1.45,
  stance: 'self',
  intel: 'RESOLVED',
});
