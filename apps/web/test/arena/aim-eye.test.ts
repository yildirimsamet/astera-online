import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, circleAim, createFlightState } from '@astera/rules/arena';
import { ChaseCamera } from '../../src/arena/render/camera.js';

/**
 * The aim circle is a cone from the chase camera's eye (owner 2026-10-21: up close the
 * assist let go of a target inside the drawn circle). The rules cannot see the camera, so
 * `aimEyeBack`/`aimEyeUp` mirror where it hangs at cruise; this keeps the two together.
 */
const ASPECT = 0.46;
/** A chase camera settled behind a ship at the origin flying +Z at `speed`. */
const settled = (speed: number): ChaseCamera => {
  // 15 m is the client's SHIP_LENGTH, the arm's unit.
  const chase = new ChaseCamera(15, null);
  const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), speed, speedMax: T.speedMax, accel: 0,
    turbo: false, landed: false, omegaYaw: 0, omegaPitch: 0 };
  for (let i = 0; i < 600; i++) chase.update(pose, 1 / 60, ASPECT);
  return chase;
};

describe('aim eye', () => {
  it('sits where the chase camera hangs behind and above a cruising ship', () => {
    for (const speed of [60, 90, T.speedMax]) {
      const chase = settled(speed);
      expect(chase.camera.position.x).toBeCloseTo(0, 6);
      expect(Math.abs(chase.camera.position.y - T.aimEyeUp)).toBeLessThan(0.1);
      expect(Math.abs(chase.camera.position.z + T.aimEyeBack)).toBeLessThan(1.5);
    }
  });

  it('holds what sits inside the circle as drawn and lets go of what sits outside, near and far', () => {
    const camera = settled(60).camera;
    // Screen units: NDC stretched by the aspect, so a circle stays round.
    const screen = (v: THREE.Vector3): THREE.Vector2 => { const n = v.clone().project(camera); return new THREE.Vector2(n.x * ASPECT, n.y); };
    // The client draws the circle round the nose at convergeDist, its rim convergeDist × tan(circle) off.
    const centre = screen(new THREE.Vector3(0, 0, T.convergeDist));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const reach = T.convergeDist * Math.sqrt(1 - T.aimCircleCos * T.aimCircleCos) / T.aimCircleCos;
    const radius = screen(new THREE.Vector3(0, 0, T.convergeDist).addScaledVector(up, reach)).distanceTo(centre);
    /** The world point `depth` metres ahead of the ship that is drawn at `fraction` of the radius, towards `angle`. */
    const drawnAt = (fraction: number, angle: number, depth: number): THREE.Vector3 => {
      const x = (centre.x + Math.cos(angle) * radius * fraction) / ASPECT; const y = centre.y + Math.sin(angle) * radius * fraction;
      const ray = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
      return camera.position.clone().addScaledVector(ray, (depth - camera.position.z) / ray.z);
    };
    const pilot = createFlightState(); pilot.s = 60;
    const out = { x: 0, y: 0, z: 0 }; const still = { x: 0, y: 0, z: 0 };
    for (const depth of [40, 60, 120, 350, 700]) {
      for (let k = 0; k < 8; k++) {
        const angle = k * Math.PI / 4;
        expect(circleAim(out, pilot, drawnAt(0.9, angle, depth), still), `inside ${String(depth)} m, ${String(k * 45)}°`).toBe(1);
        expect(circleAim(out, pilot, drawnAt(1.1, angle, depth), still), `outside ${String(depth)} m, ${String(k * 45)}°`).toBe(0);
      }
    }
  });
});
