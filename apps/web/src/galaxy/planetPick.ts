import * as THREE from 'three';
import { worldUnitsPerPixel } from './craftPick.js';
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

/** A modest 24 CSS pixel diameter; close worlds retain their body-relative target. */
export function planetPickRadius(radius: number, camera: THREE.Camera, position: THREE.Vector3, height: number): number {
  return Math.max(radius * MODEL_PICK_SCALE, 12 * worldUnitsPerPixel(camera, position, height));
}

/** Refresh Three's cached broad phase whenever members or camera-dependent radii change. */
export function placePickSpheres(mesh: THREE.InstancedMesh, nodes: readonly Pickable[], camera?: THREE.Camera, height = 1): void {
  mesh.count = nodes.length;
  nodes.forEach((node, i) => {
    PLACE.position.set(node.position[0], node.position[1], node.position[2]);
    PLACE.rotation.set(0, 0, 0);
    PLACE.scale.setScalar(camera ? planetPickRadius(node.radius, camera, PLACE.position, height) : node.radius * MODEL_PICK_SCALE);
    PLACE.updateMatrix();
    mesh.setMatrixAt(i, PLACE.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
