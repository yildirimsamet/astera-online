import { TRAVEL } from './constants.js';
import { fleetSpeed } from './hulls.js';
import type { Fleet, Vec3 } from './types.js';

export const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * One-way flight time, unrounded.
 *
 * THE ONE MODEL OF HOW LONG A TRIP TAKES. Everything that flies reads it, and
 * anything that needs a whole number rounds it at the edge rather than keeping its
 * own copy of the arithmetic.
 *
 * That split is not tidiness. An interception has to solve "when does a craft
 * leaving now reach a rock that is also moving", and the answer is a continuous
 * moment — it lands mid-minute far more often than not. A solver working in whole
 * minutes and a flight animated to the exact meeting are two different journeys,
 * and the gap between them showed up as a craft reaching the intercept point ahead
 * of the rock it was supposed to be meeting there.
 */
export function travelExact(dist: number, speed: number): number {
  if (speed <= 0) return Infinity;
  return TRAVEL.baseMinutes + (dist / speed) * TRAVEL.distanceFactor;
}

/**
 * One-way flight time in whole minutes, for a leg with a fixed destination.
 *
 * Rounded UP, so a stated ETA is never optimistic. Distance is the real map
 * boundary — there is no artificial range cap, because a cross-galaxy round trip in
 * Bulwarks already costs two hours of being undefended.
 *
 * NOT FOR AN INTERCEPTION. A rock does not wait at a whole minute; see
 * `travelExact` and `interceptAsteroid`.
 */
export function travelMinutes(dist: number, speed: number): number {
  if (speed <= 0) return Infinity;
  return Math.ceil(travelExact(dist, speed));
}

/**
 * A fleet flies at its slowest hull, times whatever its home planet lends it.
 *
 * `boost` is the BEACON's doing (D25) and defaults to 1, so every existing caller
 * reads the same number it always did. It multiplies SPEED rather than dividing
 * time, because that is what a navigation beacon does to a ship — and because
 * dividing the minutes would compound oddly against the launch overhead.
 */
export const fleetTravelMinutes = (dist: number, fleet: Fleet, boost = 1): number =>
  travelMinutes(dist, fleetSpeed(fleet) * boost);

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
