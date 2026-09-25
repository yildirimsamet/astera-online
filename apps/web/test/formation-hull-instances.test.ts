import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Marker } from '../src/galaxy/Squadrons.js';
import type { Vec3Tuple } from '../src/galaxy/scene.js';
import {
  bucketFormationHulls,
  formationHullMatrix,
  shipLod,
} from '../src/galaxy/formationHullInstances.js';
import { formationAimDirection, hullVisualScale } from '../src/galaxy/flightVisual.js';

const marker = (hull: Marker['hull'], ordinal: number): Marker => ({
  hull,
  ordinal,
  filled: 5,
});

describe('formation-local hull instancing', () => {
  it('collapses non-adjacent markers of the same hull into one bucket without losing slots', () => {
    const markers = [marker('DART', 0), marker('CITADEL', 0), marker('DART', 1)];
    const slots: Vec3Tuple[] = [[-2, 0, 1], [0, 0, 0], [2, 0, 1]];

    const buckets = bucketFormationHulls(markers, slots);

    expect(buckets.map((bucket) => bucket.hull)).toEqual(['DART', 'CITADEL']);
    expect(buckets[0]?.members.map((member) => member.marker.ordinal)).toEqual([0, 1]);
    expect(buckets[0]?.members.map((member) => member.offset)).toEqual([slots[0], slots[2]]);
    expect(buckets[1]?.members[0]?.offset).toBe(slots[1]);
  });

  it('keeps every marker when a defensive caller supplies fewer slots', () => {
    const buckets = bucketFormationHulls(
      [marker('DART', 0), marker('DART', 1)],
      [[3, 0, 4]],
    );

    expect(buckets[0]?.members.map((member) => member.offset)).toEqual([
      [3, 0, 4],
      [0, 0, 0],
    ]);
  });

  it('writes the same local transform as the former per-craft group', () => {
    const craft = marker('CITADEL', 0);
    const offset: [number, number, number] = [4, 1, -3];
    const baseScale = 0.8;
    const aimDistance = 24;
    const actual = formationHullMatrix(craft, offset, baseScale, aimDistance);

    const direction = new THREE.Vector3(...formationAimDirection(offset, aimDistance));
    const oldGroup = new THREE.Object3D();
    oldGroup.position.set(...offset);
    oldGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    oldGroup.scale.setScalar(hullVisualScale(craft.hull, baseScale));
    oldGroup.updateMatrix();

    expect(actual.elements).toEqual(oldGroup.matrix.elements);
  });

  it('keeps a screen-large hull full-detail and switches a small hull to low-detail', () => {
    expect(shipLod(1, 20)).toBe('full');
    expect(shipLod(1, 28)).toBe('full');
    expect(shipLod(1, 29)).toBe('low');
    expect(shipLod(1, 200)).toBe('low');
  });
});
