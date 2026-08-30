import {
  HULLS,
  MOBILE_HULLS,
  distance,
  exposureMinutes,
  fleetCargo,
  fleetCount,
  fleetSpeed,
  fleetTravelExact,
  missionFuel,
  travelMinutes,
  type Fleet,
  type MobileHullId,
  type ResearchProjectId,
  type TechLevels,
  type Vec3,
} from '@astera/rules';

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
  /**
   * Deuterium this launch burns, both legs, charged before it leaves. T6.
   *
   * Off `missionFuel`, the same function the server charges with — the whole point
   * of a pure rule is that the quote and the charge cannot disagree. A screen that
   * offered a launch the server then refused for fuel would be the exact failure
   * D53 forbids: predicting an outcome that is not certain.
   */
  fuel: number;
  /** Units still standing at home the moment this fleet leaves. */
  homeDefenceAfter: number;
}

export function planRoute(
  origin: Vec3,
  target: Vec3,
  sending: Fleet,
  homeFleet: Fleet,
  ground: Fleet,
  /** The commander's own ladders, so the preview quotes what the server will do. T8. */
  tech: TechLevels,
): Route {
  const dist = distance(origin, target);
  const oneWay = fleetSpeed(sending) > 0 ? fleetTravelExact(dist, sending) : 0;
  const remaining = fleetCount(homeFleet) - fleetCount(sending);

  return {
    distance: dist,
    oneWayMinutes: oneWay,
    exposureMinutes: exposureMinutes(oneWay),
    cargo: fleetCargo(sending, tech),
    fuel: missionFuel(sending, dist, 2),
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

/**
 * The commander's research levels, read off a planet payload. T8.
 *
 * `PlanetView.research` is the one place the client learns them, and every effect
 * function takes this shape — so a screen that wants to quote a rule reads it here
 * rather than reaching into the array itself and getting the question subtly wrong.
 */
export function techOf(
  view: {
    research: readonly { id: ResearchProjectId; level?: number; completed?: boolean }[];
  },
): TechLevels {
  const tech: TechLevels = {};
  for (const project of view.research) {
    /*
      A MISSING `level` MEANS "HELD" WHEN THE PROJECT IS COMPLETE, not "zero".

      The field is optional for a rolling deploy against a server that predates
      levelled research (T7), and `predict.ts` already reads a missing one that way.
      Read as zero here, the launch preview quoted a cargo figure with no Cargo
      Holds in it for the length of the deploy — the two readers of one optional
      field disagreeing about what its absence means.
    */
    const level = project.level ?? (project.completed ? 1 : 0);
    if (level > 0) tech[project.id] = level;
  }
  return tech;
}
