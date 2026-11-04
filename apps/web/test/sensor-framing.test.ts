import { describe, expect, it } from 'vitest';
import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { VIEW, toWorld } from '@astera/rules';
import type { ReachRing } from '../src/galaxy/SensorRings.js';
import { sightCameraDistance } from '../src/galaxy/follow.js';
import { sensorToggleFrame } from '../src/galaxy/sensorFraming.js';

const off = { telescope: false, radar: false };
const telescope = { telescope: true, radar: false };
const radar = { telescope: false, radar: true };
const posts: ReachRing[] = [
  { planetId: 'home', at: { x: 500, y: 0, z: 0 }, identify: 250, detect: 400, telescope: true },
  { planetId: 'colony', at: { x: -500, y: 0, z: 0 }, identify: 350, detect: 600, telescope: true },
];
const target = new Vector3(...toWorld(posts[0]!.at));
function cameraAt(distance: number, aspect = 350 / 812) {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.copy(target).add(new Vector3(0, 0, distance));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

describe('opening a sensor volume', () => {
  it.each([telescope, radar])('pulls a close camera back to fit the active sphere with breathing room: %j', current => {
    const camera = cameraAt(3);
    const frame = sensorToggleFrame({ previous: off, current, posts, activePlanetId: 'home', camera, target });
    const radius = (current.telescope ? 250 : 400) / VIEW.scale;
    expect(frame?.centre.toArray()).toEqual(target.toArray());
    expect(frame?.distance).toBeCloseTo(sightCameraDistance(radius, camera.fov, camera.aspect));
    expect(frame!.distance).toBeGreaterThan(radius / Math.sin(Math.atan(Math.tan(Math.PI / 8) * camera.aspect)));
  });

  it.each([350 / 812, 1280 / 812])('leaves a sphere already fully in frame untouched at aspect %s', aspect => {
    expect(sensorToggleFrame({ previous: off, current: radar, posts, activePlanetId: 'home', camera: cameraAt(100, aspect), target })).toBeNull();
  });

  it.each([[telescope, off], [radar, off], [telescope, telescope], [radar, radar], [off, off]])('does not move on closing, a data refresh or an unchanged toggle', (previous, current) => {
    expect(sensorToggleFrame({ previous, current, posts, activePlanetId: 'home', camera: cameraAt(3), target })).toBeNull();
  });

  it('fits the newly opened Radar even while Telescope is already on', () => {
    const camera = cameraAt(sightCameraDistance(250 / VIEW.scale, 45, 350 / 812));
    expect(sensorToggleFrame({ previous: telescope, current: { telescope: true, radar: true }, posts, activePlanetId: 'home', camera, target })?.distance)
      .toBeCloseTo(sightCameraDistance(400 / VIEW.scale, camera.fov, camera.aspect));
  });

  it('uses the colony rather than the capital when the colony is active', () => {
    const frame = sensorToggleFrame({ previous: off, current: radar, posts, activePlanetId: 'colony', camera: cameraAt(3), target });
    expect(frame?.centre.toArray()).toEqual(toWorld(posts[1]!.at));
    expect(frame?.distance).toBeCloseTo(sightCameraDistance(600 / VIEW.scale, 45, 350 / 812));
  });

  it('fits the sphere with a shifted projection while a side panel is open', () => {
    const camera = cameraAt(3);
    camera.setViewOffset(350, 812, 80, 0, 350, 812);
    const frame = sensorToggleFrame({ previous: off, current: radar, posts, activePlanetId: 'home', camera, target });
    expect(frame).not.toBeNull();
    camera.position.copy(frame!.centre).add(new Vector3(0, 0, frame!.distance));
    camera.lookAt(frame!.centre);
    camera.updateMatrixWorld();
    const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    expect(frustum.planes.every(plane => plane.distanceToPoint(frame!.centre) > 400 / VIEW.scale)).toBe(true);
  });

  it('ignores an unavailable sensor and an empty sensor list', () => {
    for (const available of [[], [{ ...posts[0]!, detect: 0 }]]) {
      expect(sensorToggleFrame({ previous: off, current: radar, posts: available, activePlanetId: 'home', camera: cameraAt(3), target })).toBeNull();
    }
  });

  it('falls back to an available Radar without zooming a distant camera inward', () => {
    const camera = cameraAt(100);
    const far = [{ ...posts[1]!, at: { x: -10000, y: 0, z: 0 } }];
    const frame = sensorToggleFrame({ previous: off, current: radar, posts: far, activePlanetId: 'home', camera, target });
    expect(frame?.distance).toBe(100);
    expect(frame?.centre.toArray()).toEqual(toWorld(far[0]!.at));
  });
});
