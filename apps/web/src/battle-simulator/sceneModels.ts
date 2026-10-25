import * as THREE from 'three';
import { posedCraft, type CraftPose, type Facing } from '../galaxy/model.js';

export const isBattleMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;

/** Quantised attributes stay untouched; dequantisation and authored pose belong in the instance matrix. */
export function battleModelParts(scene: THREE.Object3D, facing: Facing, pose?: CraftPose, paint?: readonly (THREE.Material | THREE.Material[])[]) {
  const model = posedCraft(scene, facing, pose);
  model.updateWorldMatrix(true, true);
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = [];
  model.traverse(node => {
    if (!isBattleMesh(node)) return;
    const material = paint?.[parts.length] ?? node.material;
    parts.push({ geometry: node.geometry, matrix: node.matrixWorld.clone(),
      material: Array.isArray(material) ? material.map(item => item.clone()) : material.clone() });
  });
  return parts;
}
