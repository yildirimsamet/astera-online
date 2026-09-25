import * as THREE from 'three';
import { MODEL_PICK_SCALE } from './planetLod.js';

interface Pickable {
  position: readonly [number, number, number];
  radius: number;
}

interface Body extends Pickable {
  id: string;
}

/** One scratch transform for every placement: nothing is allocated per world or per frame. */
const PLACE = new THREE.Object3D();

/** A world's own starting turn, from its id, so neighbours do not spin in step. */
const phase = (id: string): number => {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return ((value >>> 0) / 0x1_0000_0000) * Math.PI * 2;
};

/** How fast a world turns, in radians a second. */
const TURN = 0.08;

/**
 * PLACE A GROUP'S BODIES: on their worlds, at 0.96 of their radius, turned by their own
 * phase and the clock (`seconds`). The turning tiers call it every drawn frame; the far
 * tier once per change of members — a speck under twelve pixels shows no turn, and a
 * thousand of them rewritten and uploaded every frame of a pan was the cost of one.
 */
export function placeBodies(mesh: THREE.InstancedMesh, nodes: readonly Body[], seconds: number): void {
  nodes.forEach((node, i) => {
    PLACE.position.set(node.position[0], node.position[1], node.position[2]);
    PLACE.rotation.set(0, phase(node.id) + seconds * TURN, 0);
    PLACE.scale.setScalar(node.radius * 0.96);
    PLACE.updateMatrix();
    mesh.setMatrixAt(i, PLACE.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}


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
    PLACE.rotation.set(0, 0, 0);
    PLACE.scale.setScalar(node.radius * MODEL_PICK_SCALE);
    PLACE.updateMatrix();
    mesh.setMatrixAt(i, PLACE.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
