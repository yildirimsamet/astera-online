import type * as THREE from 'three';

/** Allocation-free sphere/frustum test for per-instance compaction loops. */
export function sphereInFrustum(
  frustum: THREE.Frustum,
  position: readonly [number, number, number],
  radius: number,
): boolean {
  for (const plane of frustum.planes) {
    const distance = plane.normal.x * position[0]
      + plane.normal.y * position[1]
      + plane.normal.z * position[2]
      + plane.constant;
    if (distance < -radius) return false;
  }
  return true;
}
