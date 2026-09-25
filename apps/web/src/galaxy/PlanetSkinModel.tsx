import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlanetSkinStatus } from '@astera/rules';
import { planetSkinVisual } from '../ui/planetSkins.js';
import { createPlanetSkinMaterial } from './planetSkinMaterial.js';
import { planetSurface } from './planetSurface.js';
import type { PlanetLod } from './planetLod.js';
import { placePickSpheres } from './planetPick.js';
import { HitboxMaterial } from './hitboxDebug.jsx';
import { bodyLight } from './PlanetField.jsx';
import type { PlanetNode, Vec3Tuple } from './scene.js';
import { markHit, wasTap } from './tap.js';

type SkinNode = Pick<PlanetNode, 'id' | 'position' | 'radius' | 'stance' | 'intel'>;

/** gltfpack positions are often quantised integers; bake transforms only in floats. */
export function unitPlanetGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
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
  return geometry;
}

const firstMesh = (scene: THREE.Object3D): THREE.Mesh | null => {
  let found: THREE.Mesh | null = null;
  scene.traverse((node) => {
    if (!found && node instanceof THREE.Mesh) found = node;
  });
  return found;
};

const phase = (id: string): number => {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return ((value >>> 0) / 0x1_0000_0000) * Math.PI * 2;
};

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

/** Used by the galaxy and the interactive shop preview. One draw call per look. */
export function PlanetSkinModel({
  skinId,
  status,
  nodes,
  onSelect,
}: {
  skinId: string;
  status: PlanetSkinStatus;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
}) {
  const visual = useMemo(() => planetSkinVisual(skinId, status), [skinId, status]);
  const dress = useMemo<Dress | null>(() => {
    if (!visual) return null;
    const { finish } = visual;
    return (source) => (finish.kind === 'PALETTE'
      ? createPlanetSkinMaterial(source, finish)
      : { material: source.clone(), uniforms: null });
  }, [visual]);
  if (!visual || !dress) return null;
  return (
    <ModelInstances
      name="planet-skin-models"
      modelUrl={visual.modelUrl}
      dress={dress}
      nodes={nodes}
      capacity={nodes.length}
      onSelect={onSelect}
    />
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
  nodes,
  capacity,
  onSelect,
}: {
  name: string;
  modelUrl: string;
  dress: Dress;
  nodes: readonly SkinNode[];
  capacity: number;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const { scene } = useGLTF(modelUrl, false);
  const model = useMemo(() => firstMesh(scene), [scene]);
  const geometry = useMemo(() => model ? unitPlanetGeometry(model) : null, [model]);
  const dressed = useMemo(() => {
    if (!model) return null;
    const source = Array.isArray(model.material) ? model.material[0] : model.material;
    if (!source) return null;
    return dress(source);
  }, [model, dress]);
  const body = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => () => {
    geometry?.dispose();
    dressed?.material.dispose();
  }, [geometry, dressed]);

  useLayoutEffect(() => {
    const mesh = body.current;
    if (!mesh) return;
    // Drawn as many as are in this tier now; the mesh holds room for the whole look.
    mesh.count = nodes.length;
    // Placed here, with the members, and measured for the raycaster (`planetPick.ts`).
    if (hits.current) placePickSpheres(hits.current, nodes);
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
  }, [nodes, tint, dressed, invalidate, capacity, geometry]);

  useFrame(({ clock }) => {
    if (dressed?.uniforms) dressed.uniforms.time.value = clock.elapsedTime;
    const mesh = body.current;
    if (!mesh) return;
    nodes.forEach((node, i) => {
      helper.position.set(...node.position);
      helper.rotation.set(0, phase(node.id) + clock.elapsedTime * 0.08, 0);
      helper.scale.setScalar(node.radius * 0.96);
      helper.updateMatrix();
      mesh.setMatrixAt(i, helper.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
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
        // The geometry and material are this component's (disposed above), not the mesh's.
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
          {/* Raycast and unseen, and painted when the pick volumes are (`?hitboxes=1`). */}
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
