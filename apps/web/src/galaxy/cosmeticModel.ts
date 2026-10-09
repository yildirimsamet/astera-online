import * as THREE from 'three';
import { orientedCraft, type Facing } from './model.js';

/** Keep proportions and authored node transforms while framing a centered inspection model. */
export function normalizedCosmeticModel(scene: THREE.Object3D, facing?: Facing): THREE.Object3D {
  const clone = facing === undefined ? scene.clone(true) : orientedCraft(scene, facing);
  const bounds = new THREE.Box3().setFromObject(clone);
  const centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 1.7 / (Math.max(size.x, size.y, size.z) || 1);
  clone.position.sub(centre).multiplyScalar(scale);
  clone.scale.multiplyScalar(scale);
  return clone;
}
