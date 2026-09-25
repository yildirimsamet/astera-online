import * as THREE from 'three';
import type { Marker } from './Squadrons.js';
import { formationAimDirection, hullVisualScale } from './flightVisual.js';
import type { Vec3Tuple } from './scene.js';

export interface FormationHullMember {
  marker: Marker;
  offset: Vec3Tuple;
}

export interface FormationHullBucket {
  hull: Marker['hull'];
  members: FormationHullMember[];
}

const ORIGIN: Vec3Tuple = [0, 0, 0];

/** One local draw bucket per hull type, while every marker keeps its original slot. */
export function bucketFormationHulls(
  markers: readonly Marker[],
  slots: readonly Vec3Tuple[],
): FormationHullBucket[] {
  const byHull = new Map<Marker['hull'], FormationHullBucket>();
  markers.forEach((marker, index) => {
    const member = { marker, offset: slots[index] ?? ORIGIN };
    const bucket = byHull.get(marker.hull);
    if (bucket) bucket.members.push(member);
    else byHull.set(marker.hull, { hull: marker.hull, members: [member] });
  });
  return [...byHull.values()];
}

export interface FormationHullMatrixScratch {
  aim: Vec3Tuple;
  direction: THREE.Vector3;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export const createFormationHullMatrixScratch = (): FormationHullMatrixScratch => ({
  aim: [0, 0, 1],
  direction: new THREE.Vector3(),
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
});

const FORWARD = new THREE.Vector3(0, 0, 1);
const SHIP_FULL_ANGULAR_RADIUS = 1 / 28;

export type ShipLod = 'full' | 'low';

/** Ships remain geometry at every distance; only their screen-large form is full-detail. */
export function shipLod(radius: number, distance: number): ShipLod {
  return radius >= distance * SHIP_FULL_ANGULAR_RADIUS ? 'full' : 'low';
}

/** The exact transform formerly owned by each marker's React group. */
export function formationHullMatrix(
  marker: Marker,
  offset: Vec3Tuple,
  baseScale: number,
  aimDistance: number,
  target = new THREE.Matrix4(),
  scratch = createFormationHullMatrixScratch(),
): THREE.Matrix4 {
  formationAimDirection(offset, aimDistance, scratch.aim);
  scratch.direction.set(...scratch.aim);
  scratch.quaternion.setFromUnitVectors(FORWARD, scratch.direction);
  scratch.position.set(...offset);
  const size = hullVisualScale(marker.hull, baseScale);
  scratch.scale.setScalar(size);
  return target.compose(scratch.position, scratch.quaternion, scratch.scale);
}
