import { useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { craftPickMatrix, createCraftPickScratch, raycastVisibleCraft } from './craftPick.js';
import { HitboxMaterial, type HitboxKind } from './hitboxDebug.js';
import { useVisualFrame } from './visualFrame.js';
import { shownInScene } from './hullBatches.js';

export interface CraftPicking {
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
  hitboxKind?: HitboxKind;
}

/** One instanced box per visible hull, sharing the renderers' pose and movement transforms. */
export function CraftHitTargets({ bounds, count = 1, place, onPointerUp, hitboxKind = 'fleet' }: CraftPicking & {
  bounds: THREE.Box3;
  count?: number;
  place?: (index: number, matrix: THREE.Matrix4, seconds: number) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(createCraftPickScratch, []);
  const hull = useMemo(() => new THREE.Matrix4(), []);
  useVisualFrame(({ camera, size, clock }) => {
    const node = mesh.current;
    if (!node || !shownInScene(node)) return;
    node.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    for (let index = 0; index < count; index++) {
      hull.identity();
      place?.(index, hull, clock.elapsedTime);
      node.setMatrixAt(index, craftPickMatrix(bounds, hull, node.matrixWorld, camera, size.height, scratch));
    }
    node.instanceMatrix.needsUpdate = true;
    // Camera-dependent padding and moving slots invalidate Three's cached broad phase too.
    node.computeBoundingSphere();
  });
  return <instancedMesh ref={mesh} name={`${hitboxKind}-hull-hit-targets`} args={[undefined, undefined, count]}
    frustumCulled={false} raycast={raycastVisibleCraft} onPointerUp={onPointerUp} renderOrder={-1}>
    <boxGeometry args={[1, 1, 1]} />
    <HitboxMaterial kind={hitboxKind} />
  </instancedMesh>;
}
