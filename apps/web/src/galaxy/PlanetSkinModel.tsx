import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
  if (!visual) return null;
  return <LoadedPlanetSkinModel visual={visual} nodes={nodes} onSelect={onSelect} />;
}

function LoadedPlanetSkinModel({
  visual,
  nodes,
  onSelect,
}: {
  visual: NonNullable<ReturnType<typeof planetSkinVisual>>;
  nodes: readonly SkinNode[];
  onSelect?: (id: string) => void;
}) {
  const { scene } = useGLTF(visual.modelUrl, false);
  const model = useMemo(() => firstMesh(scene), [scene]);
  const geometry = useMemo(() => model ? unitPlanetGeometry(model) : null, [model]);
  const dressed = useMemo(() => {
    if (!model) return null;
    const source = Array.isArray(model.material) ? model.material[0] : model.material;
    if (!source) return null;
    if (visual.finish.kind === 'PALETTE') return createPlanetSkinMaterial(source, visual.finish);
    return { material: source.clone(), uniforms: null };
  }, [model, visual]);
  const body = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);

  useEffect(() => () => {
    geometry?.dispose();
    dressed?.material.dispose();
  }, [geometry, dressed]);

  useLayoutEffect(() => {
    const mesh = body.current;
    if (!mesh) return;
    nodes.forEach((node, i) => {
      const light = bodyLight(node.stance, node.intel);
      const cool = node.intel === 'RESOLVED' ? [1, 1, 1] : [0.72, 0.84, 1];
      mesh.setColorAt(i, tint.setRGB(light * cool[0]!, light * cool[1]!, light * cool[2]!));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
  }, [nodes, tint, dressed]);

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
      hits.current?.setMatrixAt(i, helper.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (hits.current) hits.current.instanceMatrix.needsUpdate = true;
  });

  if (!geometry || !dressed || nodes.length === 0) return null;
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
        name="planet-skin-models"
        args={[geometry, dressed.material, nodes.length]}
        frustumCulled={false}
        raycast={() => null}
      />
      {onSelect && (
        <instancedMesh
          ref={hits}
          name="planet-skin-hits"
          args={[undefined, undefined, nodes.length]}
          frustumCulled={false}
          onPointerUp={select}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
