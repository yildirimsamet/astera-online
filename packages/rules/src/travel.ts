import { TRAVEL } from './constants.js';
import { fleetSpeed } from './hulls.js';
import type { Fleet, Vec3 } from './types.js';

export const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * One-way flight time. Distance is the real map boundary — there is no artificial
 * range cap, because a cross-galaxy round trip in Bulwarks already costs two hours
 * of being undefended.
 */
export function travelMinutes(dist: number, speed: number): number {
  if (speed <= 0) return Infinity;
  return Math.ceil(TRAVEL.baseMinutes + (dist / speed) * TRAVEL.distanceFactor);
}

export const fleetTravelMinutes = (dist: number, fleet: Fleet): number =>
  travelMinutes(dist, fleetSpeed(fleet));

/** Minutes the origin planet is left weakened: out, plus back. */
export const exposureMinutes = (oneWay: number): number => oneWay * 2;

/**
 * Where a fleet is right now, interpolated from two timestamps.
 *
 * The client calls this every frame; the server never stores a position. This is
 * what lets the galaxy show dozens of moving objects with zero realtime traffic.
 */
export function interpolatePosition(
  origin: Vec3,
  target: Vec3,
  departAt: number,
  arriveAt: number,
  now: number,
): Vec3 {
  const span = arriveAt - departAt;
  const t = span <= 0 ? 1 : Math.max(0, Math.min(1, (now - departAt) / span));
  return {
    x: origin.x + (target.x - origin.x) * t,
    y: origin.y + (target.y - origin.y) * t,
    z: origin.z + (target.z - origin.z) * t,
  };
}
