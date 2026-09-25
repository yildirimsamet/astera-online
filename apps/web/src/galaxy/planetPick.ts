import * as THREE from 'three';
import { MODEL_PICK_SCALE } from './planetLod.js';

interface Pickable {
  position: readonly [number, number, number];
  radius: number;
}

const PLACE = new THREE.Object3D();

/**
 * PLACE A GROUP'S PICK SPHERES, ONCE PER CHANGE OF MEMBERS — and measure the bounding
 * sphere from them there (owner, on a phone: "bazı gezegenlere tıklayabiliyorum
 * bazılarına tıklayamıyorum").
 *
 * Three.js tests a ray against an instanced mesh's bounding sphere before any instance
 * and computes that sphere once, at the first raycast, from the matrices of that moment.
 * Placed in the frame loop, a group raycast before its first frame kept a sphere at the
 * origin — nothing in it could ever be tapped — and a group whose worlds changed tier as
 * the camera zoomed kept its old members' sphere, so the newcomers could not be tapped.
 *
 * A pick sphere does not turn with the world, so it never needs the frame loop at all.
 */
export function placePickSpheres(mesh: THREE.InstancedMesh, nodes: readonly Pickable[]): void {
  mesh.count = nodes.length;
  nodes.forEach((node, i) => {
    PLACE.position.set(node.position[0], node.position[1], node.position[2]);
    PLACE.quaternion.identity();
    PLACE.scale.setScalar(node.radius * MODEL_PICK_SCALE);
    PLACE.updateMatrix();
    mesh.setMatrixAt(i, PLACE.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
