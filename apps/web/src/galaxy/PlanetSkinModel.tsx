import { Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useGltfPair } from './useGltfPair.js';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlanetSkinStatus } from '@astera/rules';
import { planetModel } from '../ui/assets.js';
import { planetSkinVisual } from '../ui/planetSkins.js';
import { createCountryRecoveryMaterial, createPlanetSkinMaterial } from './planetSkinMaterial.js';
import { planetSurface, solidPlanetMaterial } from './planetSurface.js';
import { addPlanetImpact, planetImpactGroups } from './planetImpactMaterial.js';
import { MODEL_PICK_SCALE, type PlanetLod } from './planetLod.js';
import { placeBodies, placePickSpheres, seat, settleMembers } from './planetPick.js';
import { bodyLight } from './PlanetField.jsx';
import type { PlanetNode, Vec3Tuple } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { HitboxMaterial } from './hitboxDebug.jsx';
import { createInstanceVisibility, updateVisibleMembers } from './instanceVisibility.js';
import { useVisualFrame } from './visualFrame.js';
import { sphereInFrustum } from './frustum.js';
import { OpeningWork } from './OpeningViews.js';
import type { PreparationResult } from './openingPreparation.js';
import { queuePlanetTextures } from './planetTextureQueue.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.jsx';
import { PlanetSkinAttachments } from './PlanetSkinAttachments.jsx';
import {
  PLANET_SKIN_BODY_SCALE,
  PLANET_SKIN_FULL_ANGULAR_RADIUS,
  planetSkinRotation,
} from './planetSkinAttachments.js';

type SkinNode = Pick<PlanetNode, 'id' | 'position' | 'radius' | 'stance' | 'intel'> & { state?: PlanetNode['state'] };

export type PlanetSkinLod = 'full' | 'low';

/** Palette/status buckets share the same meshes returned by the GLTF cache. */
const UNIT_PLANET_GEOMETRY_CACHE = new WeakMap<THREE.Mesh, THREE.BufferGeometry>();

/**
 * A SKIN IS 3D AT EVERY DISTANCE (owner, 2026-10-20), like the sixteen default worlds. Its
 * low model is the far tier: the country ones are 192 triangles (Turkey 950), lighter than
 * a default world's 512-triangle far model.
 */
export function planetSkinLod(radius: number, distance: number): PlanetSkinLod {
  return radius >= distance * PLANET_SKIN_FULL_ANGULAR_RADIUS ? 'full' : 'low';
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

function impactDress(dressed: Dressed, level: number): Dressed {
  if (level === 0) return dressed;
  const time = dressed.uniforms?.time ?? { value: 0 };
  addPlanetImpact(dressed.material, level, time);
  return { material: dressed.material, uniforms: { time } };
}

/** A default world at full detail: matte, every detail map, a night floor (`planetSurface`). */
const dressFull: Dress = (source) => ({ material: planetSurface(source, true), uniforms: null });

/** A default world seen small: the colour map alone, matte, a night floor (`planetSurface`). */
const dressLite: Dress = (source) => ({ material: planetSurface(source, false), uniforms: null });

/** Prepare the opening world's two dresses, or one look's next tier before it is drawn. */
export function PlanetWarmup({ id, lod }: { id: string; lod?: PlanetLod }) {
  if (lod) return <WarmPlanetModel id={id} lod={lod} />;
  return <><WarmPlanetModel id={id} lod="lite" /><WarmPlanetModel id={id} lod="full" /></>;
}

function WarmPlanetModel({ id, lod }: { id: string; lod: PlanetLod }) {
  const url = planetModel(id, lod);
  const model = useGLTF(url, false);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  const work = useContext(OpeningWork);
  const openingTask = useRef<(result?: PreparationResult) => void>(() => undefined);
  // Register at commit, before another frame can certify an empty barrier.
  useLayoutEffect(() => {
    const finish = work?.begin() ?? (() => undefined);
    openingTask.current = finish;
    return () => { finish('cancelled'); };
  }, [gl, camera, scene, model.scene, url, lod, work]);

  useEffect(() => {
    let live = true;
    let generation = 0;
    let finish = openingTask.current;
    let cancelTextures: () => void = () => undefined;
    const prepare = () => {
      const current = ++generation;
      const done = finish;
      const mesh = firstMesh(model.scene);
      const source = mesh && (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
      if (!mesh || !source) { done('failed'); return; }
      const { material } = cachedDress(url, lod === 'full' ? 'full' : 'lite', source, lod === 'full' ? dressFull : dressLite);
      const probes = new THREE.Group();
      const maps: THREE.Texture[] = [];
      const probe = new THREE.InstancedMesh(cachedGeometry(url, mesh), material, 1);
      probe.setColorAt(0, new THREE.Color(1, 1, 1));
      probes.add(probe);
      if (material instanceof THREE.MeshStandardMaterial) {
        for (const map of [material.map, material.normalMap, material.roughnessMap]) if (map) maps.push(map);
      }
      let preparation: Promise<THREE.Object3D>;
      try { preparation = gl.compileAsync(probes, camera, scene); }
      catch { probe.dispose(); done('failed'); return; }
      void preparation.then(
        () => {
          probe.dispose();
          if (!live || current !== generation) return;
          if (gl.getContext().isContextLost()) { done('context-lost'); return; }
          const textures = queuePlanetTextures(gl, maps, () => work?.covered ?? false);
          cancelTextures = textures.cancel;
          void textures.ready.then(done);
        },
        () => { probe.dispose(); if (live && current === generation) done('failed'); },
      );
    };
    const lost = () => {
      generation += 1;
      cancelTextures();
      finish('context-lost');
    };
    const restored = () => {
      if (!live) return;
      cancelTextures();
      finish = work?.begin() ?? (() => undefined);
      prepare();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    prepare();
    return () => {
      live = false;
      generation += 1;
      cancelTextures();
      finish('cancelled');
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, camera, scene, model.scene, url, lod, work]);

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
  freezeRotation = false,
  onRendered,
}: {
  skinId: string;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  /** The shop preview shows its one world at full detail; only the galaxy switches tiers. */
  galaxyLod?: boolean;
  previewPhaseOffset?: number;
  freezeRotation?: boolean;
  onRendered?: () => void;
}) {
  const visual = useMemo(() => planetSkinVisual(skinId, status), [skinId, status]);
  const groups = useMemo(() => planetImpactGroups(nodes), [nodes]);
  if (!visual) return null;
  return (
    <>{groups.map(group => <LoadedPlanetSkinModel
      key={group.level}
      impactLevel={group.level}
      visual={visual}
      status={status}
      nodes={group.nodes}
      onSelect={onSelect}
      galaxyLod={galaxyLod}
      previewPhaseOffset={previewPhaseOffset}
      freezeRotation={freezeRotation}
      onRendered={onRendered}
    />)}</>
  );
}

function LoadedPlanetSkinModel({
  impactLevel,
  visual,
  status,
  nodes,
  onSelect,
  galaxyLod,
  previewPhaseOffset,
  freezeRotation,
  onRendered,
}: {
  impactLevel: number;
  visual: NonNullable<ReturnType<typeof planetSkinVisual>>;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  galaxyLod: boolean;
  previewPhaseOffset: number;
  freezeRotation: boolean;
  onRendered?: () => void;
}) {
  const [full, low] = useGltfPair(visual.modelUrl, visual.lowModelUrl);
  const scene = full.scene;
  const lowScene = low.scene;
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
    if (visual.finish.kind === 'PALETTE') return impactDress(createPlanetSkinMaterial(source, visual.finish), impactLevel);
    return impactDress({ material: visual.finish.damaged ? createCountryRecoveryMaterial(source) : solidPlanetMaterial(source.clone()), uniforms: null }, impactLevel);
  }, [model, visual, impactLevel]);
  const lowDressed = useMemo(() => {
    if (!lowModel) return null;
    const source = Array.isArray(lowModel.material) ? lowModel.material[0] : lowModel.material;
    if (!source) return null;
    if (visual.finish.kind === 'PALETTE') return impactDress(createPlanetSkinMaterial(source, visual.finish), impactLevel);
    return impactDress({ material: visual.finish.damaged ? createCountryRecoveryMaterial(source) : solidPlanetMaterial(source.clone()), uniforms: null }, impactLevel);
  }, [lowModel, visual, impactLevel]);
  const fullBody = useRef<THREE.InstancedMesh>(null);
  const lowBody = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const hitNodes = useRef<SkinNode[]>([]);
  const reportedRender = useRef(false);
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
      if (!sphereInFrustum(frustum, node.position, node.radius)) return;
      helper.position.set(...node.position);
      helper.rotation.set(
        0,
        planetSkinRotation(node.id, previewPhaseOffset, clock.elapsedTime, freezeRotation),
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
      // The pick sphere covers the card's area, as a default world's does (`MODEL_PICK_SCALE`).
      helper.scale.setScalar(node.radius * MODEL_PICK_SCALE);
      helper.updateMatrix();
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
    if (onRendered && fullCount > 0 && !reportedRender.current) {
      reportedRender.current = true;
      onRendered();
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
  const groups = useMemo(() => planetImpactGroups(nodes), [nodes]);
  return (
    <>{groups.map(group => <ModelInstances
      key={group.level}
      impactLevel={group.level}
      name={`planet-models-${lod}`}
      modelUrl={url}
      // Only a world the camera is close to binds its detail maps; a speck and a planet do not.
      dress={lod === 'full' ? dressFull : dressLite}
      dressKey={lod === 'full' ? 'full' : 'lite'}
      turning={lod !== 'far'}
      nodes={group.nodes}
      capacity={Math.max(capacity, nodes.length)}
      onSelect={onSelect}
    />)}</>
  );
}

function ModelInstances({
  impactLevel,
  name,
  modelUrl,
  dress,
  dressKey,
  nodes,
  capacity,
  onSelect,
  turning = true,
}: {
  impactLevel: number;
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
    return cachedDress(modelUrl, impactLevel > 0 ? `${dressKey}:impact:${impactLevel}` : dressKey, source,
      material => impactDress(dress(material), impactLevel));
  }, [model, modelUrl, dressKey, dress, impactLevel]);
  const body = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const tint = useMemo(() => new THREE.Color(), []);
  const invalidate = useThree((state) => state.invalidate);
  const visible = useMemo(() => createInstanceVisibility<SkinNode>(), []);

  useLayoutEffect(() => {
    const mesh = body.current;
    if (!mesh) return;
    // Picking keeps the complete, stable node order and its original touch area.
    if (hits.current) placePickSpheres(hits.current, nodes);
    mesh.count = 0;
    visible.view.primed = false;
    visible.members.length = 0;
    // Allocate colour before compilation, including an initially offscreen bucket.
    mesh.setColorAt(0, tint.setRGB(1, 1, 1));
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
    invalidate();
  }, [nodes, tint, dressed, invalidate, capacity, geometry, visible, turning]);

  useVisualFrame(({ camera, clock }) => {
    if (dressed?.uniforms) dressed.uniforms.time.value = clock.elapsedTime;
    const mesh = body.current;
    if (!mesh) return;
    const changed = updateVisibleMembers(visible, camera, mesh, nodes, PLANET_SKIN_BODY_SCALE);
    if (changed) {
      mesh.count = visible.members.length;
      visible.members.forEach((node, i) => {
        const light = bodyLight(node.stance, node.intel);
        const cool = node.intel === 'RESOLVED' ? [1, 1, 1] : [0.72, 0.84, 1];
        mesh.setColorAt(i, tint.setRGB(light * cool[0]!, light * cool[1]!, light * cool[2]!));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (!turning) placeBodies(mesh, visible.members, 0);
    }
    if (!turning) return;
    if (mesh.count > 0) placeBodies(mesh, visible.members, clock.elapsedTime);
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
        // Cached assets arrive through args; Fiber frees only this mesh's instance buffers.
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
