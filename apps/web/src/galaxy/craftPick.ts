import * as THREE from 'three';
import { shownInScene } from './hullBatches.js';

const VIEW_POINT = new THREE.Vector3();

/** CSS pixels, including camera zoom; lateral distance must not inflate an off-axis target. */
export function worldUnitsPerPixel(camera: THREE.Camera, world: THREE.Vector3, height: number): number {
  VIEW_POINT.copy(world).applyMatrix4(camera.matrixWorldInverse);
  const depth = camera.projectionMatrix.elements[15] === 0 ? Math.max(0, -VIEW_POINT.z) : 1;
  return 2 * depth / (Math.abs(camera.projectionMatrix.elements[5]) * Math.max(1, height));
}

export const createCraftPickScratch = () => ({
  matrix: new THREE.Matrix4(),
  box: new THREE.Matrix4(),
  centre: new THREE.Vector3(),
  size: new THREE.Vector3(),
  world: new THREE.Vector3(),
  rotation: new THREE.Quaternion(),
});

/** A posed hull's bounds plus 2px of forgiveness; a distant craft stays at least 16px wide. */
export function craftPickMatrix(
  bounds: THREE.Box3,
  hull: THREE.Matrix4,
  parent: THREE.Matrix4,
  camera: THREE.Camera,
  height: number,
  scratch: ReturnType<typeof createCraftPickScratch>,
): THREE.Matrix4 {
  bounds.getCenter(scratch.centre);
  bounds.getSize(scratch.size);
  scratch.matrix.multiplyMatrices(parent, hull);
  scratch.world.copy(scratch.centre).applyMatrix4(scratch.matrix);
  const pixel = worldUnitsPerPixel(camera, scratch.world, height) / scratch.matrix.getMaxScaleOnAxis();
  scratch.size.set(
    Math.max(scratch.size.x + 4 * pixel, 16 * pixel),
    Math.max(scratch.size.y + 4 * pixel, 16 * pixel),
    Math.max(scratch.size.z + 4 * pixel, 16 * pixel),
  );
  scratch.box.compose(scratch.centre, scratch.rotation, scratch.size);
  return scratch.matrix.multiplyMatrices(hull, scratch.box);
}


/** Three raycasts hidden objects too; a suspended hull must never intercept another object. */
export function raycastVisibleCraft(this: THREE.InstancedMesh, raycaster: THREE.Raycaster, intersections: THREE.Intersection[]): void {
  if (shownInScene(this)) THREE.InstancedMesh.prototype.raycast.call(this, raycaster, intersections);
}
