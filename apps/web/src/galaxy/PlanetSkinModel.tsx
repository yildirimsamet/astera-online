import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlanetSkinStatus } from '@astera/rules';
import { planetSkinVisual } from '../ui/planetSkins.js';
import { createPlanetSkinMaterial } from './planetSkinMaterial.js';
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

/** Used by the galaxy and the interactive shop preview. One draw call per look. */
export function PlanetSkinModel({
  skinId,
  status,
  nodes,
  onSelect,
  galaxyLod = false,
}: {
  skinId: string;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  /** The shop preview has no billboard peer, so only the galaxy enables switching. */
  galaxyLod?: boolean;
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
    />
  );
}

function LoadedPlanetSkinModel({
  visual,
  status,
  nodes,
  onSelect,
  galaxyLod,
}: {
  visual: NonNullable<ReturnType<typeof planetSkinVisual>>;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
  galaxyLod: boolean;
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
    return { material: source.clone(), uniforms: null };
  }, [model, visual]);
  const lowDressed = useMemo(() => {
    if (!lowModel) return null;
    const source = Array.isArray(lowModel.material) ? lowModel.material[0] : lowModel.material;
    if (!source) return null;
    if (visual.finish.kind === 'PALETTE') return createPlanetSkinMaterial(source, visual.finish);
    return { material: source.clone(), uniforms: null };
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
    nodes.forEach((node) => {
      const distance = camera.position.distanceTo(helper.position.set(...node.position));
      const lod = galaxyLod ? planetSkinLod(node.radius, distance) : 'full';
      if (lod === 'billboard') return;
      if (!sphereInFrustum(frustum, node.position, node.radius)) return;
      helper.position.set(...node.position);
      helper.rotation.set(
        0,
        planetSkinPhase(node.id) + clock.elapsedTime * PLANET_SKIN_SPIN_RATE,
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
      hitNodes.current[hitCount] = node;
      hitCount += 1;
    });
    for (const [mesh, count] of [[full, fullCount], [low, lowCount]] as const) {
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (hits.current) {
      hits.current.count = hitCount;
      hits.current.visible = hitCount > 0;
      hits.current.instanceMatrix.needsUpdate = true;
    }
    hitNodes.current.length = hitCount;
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

/** Convenience shape for the shop's single world, without a galaxy payload. */
export const previewSkinNode = (id: string): SkinNode => ({
  id,
  position: [0, 0, 0] as Vec3Tuple,
  radius: 1.45,
  stance: 'self',
  intel: 'RESOLVED',
});
