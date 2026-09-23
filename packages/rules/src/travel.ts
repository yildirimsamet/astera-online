import { TRAVEL } from './constants.js';
import { fleetSpeed } from './hulls.js';
import type { TechLevels } from './tech.js';
import type { Fleet, Vec3 } from './types.js';

export const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * One-way flight time, unrounded. Distance and speed, and nothing else.
 *
 * THE ONE MODEL OF HOW LONG A TRIP TAKES, and since D121 that is literally true:
 * a warship, a drill and a probe all read THIS. There used to be three functions
 * and three launch-overhead constants, and the only rule holding them together was
 * "do not let a craft read the wrong one" (D48) — a hazard that existed solely to
 * serve a flat charge nobody could feel. `TRAVEL` explains what it was for and why
 * neither reason survived.
 *
 * ANYTHING NEEDING A WHOLE NUMBER ROUNDS AT THE EDGE rather than keeping its own
 * copy of the arithmetic. That split is not tidiness. An interception has to solve
 * "when does a craft leaving now reach a rock that is also moving", and the answer
 * is a continuous moment — it lands mid-minute far more often than not. A solver
 * working in whole minutes and a flight animated to the exact meeting are two
 * different journeys, and the gap showed up as a craft reaching the intercept
 * point ahead of the rock it was supposed to be meeting there.
 */
export function travelExact(dist: number, speed: number): number {
  if (speed <= 0) return Infinity;
  return (dist / speed) * TRAVEL.distanceFactor;
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
 * EVERYTHING ABOUT A FLIGHT THAT IS NOT THE SHIP. D180.
 *
 * A wing moves at its slowest hull's catalogue speed times two things that hull
 * knows nothing about: the commander's `SHIP_PROPULSION` ladder, and the BEACON
 * standing over the world it launched from (D25). Both are real, both are large —
 * propulsion alone is four rungs of +25% to a DOUBLING — and neither is visible
 * from the fleet you are holding.
 *
 * THEY ARE ONE REQUIRED ARGUMENT BECAUSE THEY WERE TWO OPTIONAL ONES.
 * `fleetTravelExact(dist, fleet, boost = 1, tech = {})` read beautifully and
 * failed silently: a caller that forgot the last two arguments got a plausible
 * number that was up to twice too long, with no error anywhere. Four client
 * surfaces did exactly that for as long as propulsion has existed — and one of
 * them, `settlementCanArrive`, turned the wrong minutes into a REFUSAL, telling
 * commanders they could not reach a claim window they could comfortably reach.
 *
 * SO THE DEFAULTS ARE GONE. A new caller cannot compile without saying which
 * flight this is, and `UNAIDED` is how one that belongs to no commander says so in
 * a word. A silent wrong answer is replaced by a type error, which is the only
 * kind of guard that survives the next feature.
 */
export interface FlightModifiers {
  /** The Beacon over the world this wing left. `1` when there is none. */
  readonly boost: number;
  /** The commander's own ladders — frozen at launch for an attacker (D137). */
  readonly tech: TechLevels;
  /**
   * THE ONE MODIFIER THAT IS A DECISION RATHER THAN A POSSESSION. Owner decision, 2026-09-21.
   *
   * A Beacon and a doctrine are things a commander HAS; the pace is something they CHOOSE, once,
   * for this flight. Omitted means full speed, and that is the only default in this interface
   * with a right answer: every caller that predates the choice flew at full speed, so `?? 1`
   * restates their flight rather than guessing at it.
   */
  readonly pace?: MissionPace;
}

/**
 * THE RUNGS, AND WHY THEY ARE RUNGS.
 *
 * A free ETA field would be more expressive and much worse to use: on a 350-wide screen the
 * commander is picking between "lands while I sleep" and "lands before I leave", not tuning a
 * number. Five rungs put the whole ladder on one row, and the slowest turns a two-hour hop into
 * a twenty-hour one — far past the cap, which is what makes the cap the binding rule rather
 * than the ladder.
 */
export const MISSION_PACES = [1, 0.75, 0.5, 0.25, 0.1] as const;

export type MissionPace = typeof MISSION_PACES[number];

export const isMissionPace = (value: number): value is MissionPace =>
  (MISSION_PACES as readonly number[]).includes(value);

/**
 * A FLIGHT NOBODY IS FLYING. Named rather than written out as `{ boost: 1, tech:
 * {} }`, so the handful of legitimate uses are greppable and everything else has
 * to justify itself.
 *
 * Legitimate means the question genuinely has no commander behind it: a
 * galaxy-wide constant derived from the map (`SETTLEMENT_CLAIM_MINUTES`), or a
 * catalogue comparison between two hulls. It is NEVER the right answer for a
 * number a specific player is about to act on.
 */
export const UNAIDED: FlightModifiers = { boost: 1, tech: {} };

/**
 * HOW FAST THIS WING ACTUALLY MOVES, and the only place the two modifiers meet.
 *
 * Speed is multiplied rather than time divided, because that is what a beacon and
 * an engine do to a ship. With D121's launch overhead gone the two are
 * arithmetically identical, and it stays this way round because it is the honest
 * description of what is happening.
 */
export const fleetPace = (fleet: Fleet, mods: FlightModifiers): number =>
  fleetSpeed(fleet, mods.tech) * mods.boost * (mods.pace ?? 1);

/** One-way flight time for a wing, unrounded. */
export const fleetTravelExact = (
  dist: number,
  fleet: Fleet,
  mods: FlightModifiers,
): number => travelExact(dist, fleetPace(fleet, mods));

/** The same fleet trip rounded up for a human-facing whole-minute quote. */
export const fleetTravelMinutes = (
  dist: number,
  fleet: Fleet,
  mods: FlightModifiers,
): number => Math.ceil(fleetTravelExact(dist, fleet, mods));

/**
 * WHICH PACES THIS PARTICULAR FLIGHT MAY BE TOLD TO TAKE.
 *
 * Full speed is always among them when the wing can move at all — see `pacedFlightCapMinutes`. The
 * rest are offered only while they land inside the cap, so the answer depends on the distance and
 * on what is flying, which is the honest shape: the same choice is not available for a hop across
 * the neighbourhood and a crossing of the galaxy.
 *
 * AN IMMOBILE WING GETS NOTHING, not a full-speed rung it could not fly.
 */
export const allowedPaces = (
  dist: number,
  fleet: Fleet,
  mods: FlightModifiers,
): readonly MissionPace[] => {
  if (!Number.isFinite(fleetTravelExact(dist, fleet, { ...mods, pace: 1 }))) return [];
  return MISSION_PACES.filter(
    (pace) => pace === 1
      || fleetTravelExact(dist, fleet, { ...mods, pace }) <= TRAVEL.pacedFlightCapMinutes,
  );
};

/**
 * THE SAME RUNGS, FOR A LEG ALREADY TIMED AT FULL SPEED. Review 2026-09-22, #2.
 *
 * A joint clan strike has no single fleet to hand `allowedPaces` — it flies at its slowest wave,
 * each on its own owner's propulsion — so the server times the leg and this states the rule on the
 * minutes. Flight time is inversely proportional to speed, so a rung's leg is `full / pace`.
 */
export const pacesForMinutes = (fullSpeedMinutes: number): readonly MissionPace[] => {
  if (!Number.isFinite(fullSpeedMinutes)) return [];
  return MISSION_PACES.filter(
    (pace) => pace === 1 || fullSpeedMinutes / pace <= TRAVEL.pacedFlightCapMinutes,
  );
};

/**
 * MINUTES THE ORIGIN PLANET IS LEFT WEAKENED: out, plus back.
 *
 * `homeward` defaults to the outbound leg, which is what every flight was before a commander could
 * choose a pace: one speed, two identical legs. It is a separate argument because a paced launch
 * is NOT symmetric — the commander buys when the raid arrives, and the survivors come home at full
 * speed — and doubling the slow leg would overstate by hours the one figure the raid sheet is
 * built around.
 */
export const exposureMinutes = (oneWay: number, homeward: number = oneWay): number =>
  oneWay + homeward;

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
