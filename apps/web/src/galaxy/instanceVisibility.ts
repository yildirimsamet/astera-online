import * as THREE from 'three';
import { sphereInFrustum } from './frustum.js';
import { createViewMemo, viewChanged } from './viewMemo.js';

interface SphereMember {
  position: readonly [number, number, number];
  radius: number;
}

export function createInstanceVisibility<T extends SphereMember>(members: T[] = []) {
  return {
    members,
    view: createViewMemo(),
    world: new Float64Array(16),
    matrix: new THREE.Matrix4(),
    frustum: new THREE.Frustum(),
    radiusScale: NaN,
  };
}

/** Reuses the compact list and scratch storage; radius includes shader displacement. */
export function updateVisibleMembers<T extends SphereMember>(
  state: ReturnType<typeof createInstanceVisibility<T>>,
  camera: THREE.Camera,
  object: THREE.Object3D,
  subjects: readonly T[],
  radiusScale: number,
): boolean {
  object.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  let moved = viewChanged(state.view, camera, subjects, 0) || state.radiusScale !== radiusScale;
  const world = object.matrixWorld.elements;
  for (let i = 0; i < 16; i++) if (state.world[i] !== world[i]) moved = true;
  if (!moved) return false;
  state.world.set(world);
  state.radiusScale = radiusScale;
  state.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(object.matrixWorld);
  state.frustum.setFromProjectionMatrix(state.matrix);
  let count = 0;
  let changed = false;
  for (const subject of subjects) {
    if (!sphereInFrustum(state.frustum, subject.position, subject.radius * radiusScale)) continue;
    if (state.members[count] !== subject) changed = true;
    state.members[count++] = subject;
  }
  changed ||= state.members.length !== count;
  state.members.length = count;
  return changed;
}
