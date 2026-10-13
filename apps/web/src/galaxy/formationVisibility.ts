import * as THREE from 'three';
import type { EngineUnit } from './EngineJets.js';

export const createLocalVisibility = () => ({
  matrix: new THREE.Matrix4(), frustum: new THREE.Frustum(), sphere: new THREE.Sphere(),
});

/** Test in local space to include all parent transforms without per-frame allocation. */
export function localSphereVisible(
  scratch: ReturnType<typeof createLocalVisibility>, camera: THREE.Camera,
  object: THREE.Object3D, radius: number,
): boolean {
  object.updateWorldMatrix(true, false);
  // Unbounded/custom effects retain their existing drawing behaviour.
  if (!Number.isFinite(radius)) return true;
  camera.updateWorldMatrix(true, false);
  scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(object.matrixWorld);
  scratch.frustum.setFromProjectionMatrix(scratch.matrix);
  scratch.sphere.radius = radius;
  return scratch.frustum.intersectsSphere(scratch.sphere);
}

/** Radius about the formation origin, including authored part offsets and rim shader. */
export function hullPartRadius(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): number {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (!sphere) return Infinity;
  return sphere.center.clone().applyMatrix4(matrix).length()
    + (sphere.radius + 0.004) * matrix.getMaxScaleOnAxis();
}

/** Analytic maximum of rocketJet's centre displacement and billboard half diagonal.
 * Rotation toward the destination and camera-facing rotation preserve these lengths. */
export function engineUnitsRadius(units: readonly EngineUnit[]): number {
  let radius = 0;
  for (const unit of units) {
    const width = Math.abs(unit.widthFactor), length = Math.abs(unit.lengthFactor);
    const drift = Math.hypot(.022 * .6 * width, .014 * .6 * width, (.025 + .7 * length) * .55);
    const quad = .5 * Math.hypot(.083 * .75 * width, .083 * 3.55 * .65 * length);
    for (const nozzle of unit.nozzles) {
      radius = Math.max(radius, Math.hypot(...unit.at)
        + Math.abs(unit.size) * (Math.hypot(...nozzle) + drift + quad));
    }
  }
  return radius;
}
