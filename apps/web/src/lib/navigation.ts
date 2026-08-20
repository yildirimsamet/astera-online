import {
  HULLS,
  MOBILE_HULLS,
  distance,
  exposureMinutes,
  fleetCargo,
  fleetCount,
  fleetSpeed,
  fleetTravelMinutes,
  travelMinutes,
  type Fleet,
  type MobileHullId,
  type Vec3,
} from '@blindspace/rules';

/**
 * The launch preview.
 *
 * Prediction only — the server recomputes all of it inside the transaction — but
 * it has to be exact, because it is the number the decision is made on. It uses
 * the same rule functions the server does, so "exposed for 28 minutes" means the
 * same thing on both sides of the wire.
 */
export interface Route {
  distance: number;
  oneWayMinutes: number;
  exposureMinutes: number;
  cargo: number;
  /** Units still standing at home the moment this fleet leaves. */
  homeDefenceAfter: number;
}

export function planRoute(
  origin: Vec3,
  target: Vec3,
  sending: Fleet,
  homeFleet: Fleet,
  ground: Fleet,
): Route {
  const dist = distance(origin, target);
  const oneWay = fleetSpeed(sending) > 0 ? fleetTravelMinutes(dist, sending) : 0;
  const remaining = fleetCount(homeFleet) - fleetCount(sending);

  return {
    distance: dist,
    oneWayMinutes: oneWay,
    exposureMinutes: exposureMinutes(oneWay),
    cargo: fleetCargo(sending),
    homeDefenceAfter: Math.max(0, remaining) + fleetCount(ground),
  };
}

/**
 * How far away a planet is *for this player right now* — at the speed of the
 * slowest ship they currently have at home. Distance in map units is not a
 * decision; "you would be gone 41 minutes" is.
 */
export function reachMinutes(origin: Vec3, target: Vec3, homeFleet: Fleet): number | null {
  const speed = fleetSpeed(homeFleet);
  if (speed <= 0) return null;
  return travelMinutes(distance(origin, target), speed);
}

/** Reference time for a player with no ships: what a Wasp would take. */
export const waspMinutes = (origin: Vec3, target: Vec3): number =>
  travelMinutes(distance(origin, target), HULLS.WASP.speed);

/**
 * What the launch sheet offers.
 *
 * Re-exported from the rules package rather than written out again: a second copy
 * of this list is a hull that gets added to the game and silently never appears in
 * the sheet. D27 added one ground hull and proved how easy that is to miss.
 */
export const MOBILE: readonly MobileHullId[] = MOBILE_HULLS;
