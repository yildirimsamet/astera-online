import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { moonWarpPose } from '../src/galaxy/moonWarpShot.js';

/*
  Owner, 2026-11-24: when a Moon Gate jump is confirmed the camera sits a little behind and a little above
  the departing moon, and the destination moon is in the same frame — both stay in view for the whole warp.
  The camera is not locked (the shot is orbitable); this file guards the framing only.
*/
type V = [number, number, number];

function project(pose: ReturnType<typeof moonWarpPose>, aspect: number, point: V): THREE.Vector3 {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10_000);
  const at = new THREE.Vector3(...pose.at);
  camera.position.copy(at).addScaledVector(new THREE.Vector3(...pose.towards), pose.range);
  camera.lookAt(at);
  camera.updateMatrixWorld();
  return new THREE.Vector3(...point).project(camera);
}

const cases: { name: string; origin: V; dest: V }[] = [
  { name: 'a neighbour', origin: [0, 0, 0], dest: [6, 0.4, -3] },
  { name: 'across the galaxy', origin: [10, 0, 5], dest: [-140, -2, 90] },
  { name: 'almost overhead', origin: [0, 0, 0], dest: [0.5, 30, 0.2] },
];

describe('the Moon Gate warp shot', () => {
  for (const { name, origin, dest } of cases) {
    for (const aspect of [350 / 812, 16 / 9]) {
      it(`keeps both moons in frame — ${name}, aspect ${aspect.toFixed(2)}`, () => {
        const pose = moonWarpPose(origin, dest, 2.5);
        const a = project(pose, aspect, origin);
        const b = project(pose, aspect, dest);
        for (const p of [a, b]) {
          expect(Math.abs(p.x)).toBeLessThan(0.8);
          expect(Math.abs(p.y)).toBeLessThan(0.8);
          expect(p.z).toBeLessThan(1); // in front of the camera
        }
        // The departing moon is the foreground, low; the destination lies ahead, above it.
        expect(a.y).toBeLessThan(b.y);
      });
    }

    it(`sits a little behind and a little above the departing moon — ${name}`, () => {
      const back = 2.5;
      const pose = moonWarpPose(origin, dest, back);
      const camera = pose.at.map((c, i) => c + pose.towards[i]! * pose.range) as V;
      const axis = new THREE.Vector3(...dest).sub(new THREE.Vector3(...origin)).normalize();
      const fromOrigin = new THREE.Vector3(...camera).sub(new THREE.Vector3(...origin));
      expect(fromOrigin.dot(axis)).toBeLessThan(0); // behind: on the far side from the destination
      expect(fromOrigin.length()).toBeLessThan(back * 1.5); // a little, not a galaxy away
      const up = new THREE.Vector3(0, 1, 0);
      const lift = fromOrigin.clone().sub(axis.clone().multiplyScalar(fromOrigin.dot(axis)));
      expect(lift.length()).toBeGreaterThan(0.2 * back); // above the jump line
      if (Math.abs(axis.y) < 0.9) expect(lift.dot(up)).toBeGreaterThan(0);
    });
  }

  it('looks past the departing moon’s own world, never through it, to the destination', () => {
    // The moon orbits its world; the jump line runs right past that world.
    const planet: V = [0, 1.6, 2.4]; // above the line: an inclined orbit puts the world over the jump
    const planetRadius = 1;
    const origin: V = [0, 0, 0];
    const dest: V = [0.3, -1, 60];
    const pose = moonWarpPose(origin, dest, 6, { centre: planet, radius: planetRadius });
    const camera = new THREE.Vector3(...pose.at).addScaledVector(new THREE.Vector3(...pose.towards), pose.range);
    const ray = new THREE.Ray(camera, new THREE.Vector3(...dest).sub(camera).normalize());
    expect(ray.distanceToPoint(new THREE.Vector3(...planet))).toBeGreaterThan(planetRadius * 1.1);
    // Still a shot from above: the screen's up is the galaxy's up, so the camera stays over the jump.
    expect(camera.y).toBeGreaterThan(origin[1]);
    for (const aspect of [350 / 812, 16 / 9]) {
      for (const p of [project(pose, aspect, origin), project(pose, aspect, dest)]) {
        expect(Math.abs(p.x)).toBeLessThan(0.8);
        expect(Math.abs(p.y)).toBeLessThan(0.8);
      }
    }
  });

  it('keeps the plain shot from straight above when the moon’s world is out of the way', () => {
    const plain = moonWarpPose([0, 0, 0], [0, 0, 60], 6);
    const beside = moonWarpPose([0, 0, 0], [0, 0, 60], 6, { centre: [-2.6, 0, 0.3], radius: 1 });
    expect(beside.towards.map((v) => v.toFixed(4))).toEqual(plain.towards.map((v) => v.toFixed(4)));
  });
});
