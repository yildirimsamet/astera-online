import { JUMP_FLIGHT, jumpThrottle, jumpTravel } from '@astera/rules';
import * as THREE from 'three';
import type { JumpingShipState } from './JumpingShip.js';
import type { Point } from './jumpCamera.js';

const ORIGIN = new THREE.Vector3(), LEVEL = new THREE.Vector3(0, 1, 0);
const WAY = new THREE.Vector3(), TURN = new THREE.Matrix4();

const smooth = (from: number, to: number, value: number): number => {
  const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
};

/**
 * THE SHIP ON THE JUMP'S CLOCK: facing its way from the berth, slow, fast, slow to its stop, the long
 * flame over the cruise one while it is fast, and gone in a burst.
 */
export function shipStateAt(from: Point, stop: Point, s: number, into: JumpingShipState): JumpingShipState {
  const k = jumpTravel(s);
  into.at.set(from[0] + (stop[0] - from[0]) * k, from[1] + (stop[1] - from[1]) * k, from[2] + (stop[2] - from[2]) * k);
  // Nose (+Z) along the way, deck kept level, as an object's lookAt keeps it.
  WAY.set(stop[0] - from[0], stop[1] - from[1], stop[2] - from[2]).normalize();
  into.facing.setFromRotationMatrix(TURN.lookAt(WAY, ORIGIN, LEVEL));
  into.lever = jumpThrottle(s);
  // The long flame at seven tenths: at full it hid the hull it was pushing (preview 2026-11-09).
  into.turbo = 0.7 * smooth(JUMP_FLIGHT.depart + 0.2, JUMP_FLIGHT.depart + 2.4, s) * (1 - smooth(JUMP_FLIGHT.arrive - 4.5, JUMP_FLIGHT.arrive - 2.5, s));
  into.vanish = smooth(JUMP_FLIGHT.vanish, JUMP_FLIGHT.gone, s);
  return into;
}
