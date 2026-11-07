import { Frustum, Matrix4, Vector3, type PerspectiveCamera } from 'three';
import { VIEW, toWorld } from '@astera/rules';
import type { ReachRing } from './SensorRings.js';
import { sightCameraDistance } from './follow.js';

interface SensorVisibility { telescope: boolean; radar: boolean }

/** Frame a newly revealed sphere once; refreshes, closing and an adequate view do nothing. */
export function sensorToggleFrame({ previous, current, posts, activePlanetId, camera, target }: {
  previous: SensorVisibility;
  current: SensorVisibility;
  posts: readonly ReachRing[];
  activePlanetId: string | null;
  camera: PerspectiveCamera;
  target: Vector3;
}): { centre: Vector3; distance: number } | null {
  const telescope = current.telescope && !previous.telescope;
  const radar = current.radar && !previous.radar;
  if (!telescope && !radar) return null;
  const volumes = posts.map(post => ({
    planetId: post.planetId,
    centre: new Vector3(...toWorld(post.at)),
    radius: Math.max(telescope ? post.identify : 0, radar ? post.detect : 0) / VIEW.scale,
  })).filter(volume => volume.radius > 0);
  const volume = volumes.find(item => item.planetId === activePlanetId)
    ?? volumes.sort((a, b) => a.centre.distanceToSquared(target) - b.centre.distanceToSquared(target))[0];
  if (!volume) return null;
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  if (frustum.planes.every(plane => plane.distanceToPoint(volume.centre) >= volume.radius)) return null;
  // Use the narrower side of the actual projection, including a panel's view offset.
  const projection = camera.projectionMatrix.elements;
  const halfFov = Math.min(
    Math.atan((1 - Math.abs(projection[8])) / projection[0]),
    Math.atan((1 - Math.abs(projection[9])) / projection[5]),
  );
  return {
    centre: volume.centre,
    distance: Math.max(camera.position.distanceTo(target), sightCameraDistance(volume.radius, halfFov * 360 / Math.PI, 1)),
  };
}
