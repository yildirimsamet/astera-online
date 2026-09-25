import * as THREE from 'three';
import { MODEL_PICK_SCALE } from './planetLod.js';
import { PLANET_SKIN_BODY_SCALE, PLANET_SKIN_SPIN_RATE, planetSkinPhase } from './planetSkinAttachments.js';

interface Pickable {
  position: readonly [number, number, number];
  radius: number;
}

interface Body extends Pickable {
  id: string;
}

/** One scratch transform for every placement: nothing is allocated per world or per frame. */
const PLACE = new THREE.Object3D();

/**
 * PLACE A GROUP'S BODIES: on their worlds, at 0.96 of their radius, turned by their own
 * phase and the clock (`seconds`) — the size, phase and spin a skinned world has too
 * (`planetSkinAttachments`), so a world does not jump when it changes look. The turning
 * tiers call it every drawn frame; the far tier once per change of members — a speck
 * under twelve pixels shows no turn, and a thousand of them rewritten and uploaded every
 * frame of a pan was the cost of one.
 */
export function placeBodies(mesh: THREE.InstancedMesh, nodes: readonly Body[], seconds: number): void {
  nodes.forEach((node, i) => {
    PLACE.position.set(node.position[0], node.position[1], node.position[2]);
    PLACE.rotation.set(0, planetSkinPhase(node.id) + seconds * PLANET_SKIN_SPIN_RATE, 0);
    PLACE.scale.setScalar(node.radius * PLANET_SKIN_BODY_SCALE);
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
/** Seats `member` at `index` of a compacting pass, and says whether that seat held someone else. */
export function seat<T>(members: T[], index: number, member: T): boolean {
  const changed = members[index] !== member;
  members[index] = member;
  return changed;
}

/**
 * SETTLE A COMPACTING PASS (the master merge, 2026-09-25). A group that draws only some of
 * its worlds each pass — a skin's far billboards, its near models and their pick spheres —
 * writes its instances in the frame loop, so the bounding sphere the raycaster measured
 * once goes stale as members come and go (the same fault as above). After a pass that
 * seated `drawn` members, this drops the rest, draws that many, and measures the sphere
 * again when anyone moved (`seat`, or the count).
 */
export function settleMembers(mesh: THREE.InstancedMesh, members: unknown[], drawn: number, changed: boolean): void {
  const moved = changed || members.length !== drawn;
  members.length = drawn;
  mesh.count = drawn;
  mesh.instanceMatrix.needsUpdate = true;
  if (moved) mesh.computeBoundingSphere();
}

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
