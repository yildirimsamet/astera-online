import type { Vec3 } from './types.js';

/**
 * THE ONE LEG EVERY SCREEN DRAWS. D106.
 *
 * This module exists because of a bug that no test in the project could have
 * caught, and that shape of bug is the reason `packages/rules` exists at all.
 *
 * A craft in flight is drawn twice by two different pieces of code: the OWNER's
 * client interpolates the whole leg out of its own `pending` payload, and every
 * OTHER player interpolates a bearing window out of `/api/galaxy/traffic`. Both
 * were correct against their own inputs and both had tests. They still disagreed,
 * because the owner's renderer stops its leg short of the target world — a craft
 * drawn at a planet's centre is drawn INSIDE it (D44) — and the public window did
 * not know that rule existed. The gap between the two pictures is exactly the
 * standoff, growing along the leg, and at the end of a raid it is more than a
 * planet across: the owner watched their fleet still closing while everybody else
 * watched it sit on the target and wait.
 *
 * THE FIX IS NOT AN ADJUSTMENT, IT IS A SINGLE DEFINITION. The visual leg — where
 * a craft starts, where it stops, and how a world's drawn size decides that — is
 * stated here once, in the package both the server and the client already share,
 * and neither is allowed its own copy. The server publishes windows ON this leg;
 * the client draws its own craft ALONG this leg; the two are the same line by
 * construction rather than by agreement.
 *
 * WHY DRAWING GEOMETRY IS ALLOWED TO LIVE IN THE RULES PACKAGE, when nothing else
 * about presentation does. The test is not "is it visual" but "must two processes
 * agree on it". A colour, a font size and a camera angle are one process's own
 * business. This is not: the server has to publish a position that the client will
 * draw at the same point the client draws the owner's craft, and the moment those
 * two computations live in two files they drift. That makes this the same kind of
 * fact as travel time and combat — one source of truth, no clock, no I/O.
 *
 * IT REVEALS NOTHING NEW. Every figure here is derived from a world's PUBLIC core
 * tier, which is on `/api/galaxy` for every planet in the disc (D49), and the
 * whole correction moves a published point by at most a couple of planet radii
 * along a heading the observer can already see.
 */

/**
 * Game units per world unit, and the height exaggeration applied on the way in.
 *
 * The design's coordinates fill a radius-2,000 sphere; three.js wants a camera in
 * the single digits, so everything is divided on the way in and nothing downstream
 * thinks about game units again. Vertical exaggeration is one today, but the
 * conversion remains shared because server-published and client-drawn paths must
 * still use exactly the same transform.
 *
 * They are here rather than in the client because the conversion is not a scale
 * factor — the height axis is stretched and the other two are not, so a distance
 * in world units is NOT a distance in game units divided by anything. Any code
 * that shifts a point by a world-space distance has to do it on this side of the
 * conversion, which means both processes need the same numbers.
 */
export const VIEW = {
  scale: 50,
  verticalExaggeration: 1,
} as const;

export type Vec3Tuple = [number, number, number];

/** Game coordinates as the 3D surface draws them. */
export const toWorld = (p: Vec3): Vec3Tuple => [
  p.x / VIEW.scale,
  (p.y * VIEW.verticalExaggeration) / VIEW.scale,
  p.z / VIEW.scale,
];

/** And back again, so a world-space correction can be published in game units. */
export const toGame = (p: Vec3Tuple): Vec3 => ({
  x: p[0] * VIEW.scale,
  y: (p[1] * VIEW.scale) / VIEW.verticalExaggeration,
  z: p[2] * VIEW.scale,
});

/**
 * THREE SIZES, NOT A RAMP — and the public tier is what picks one.
 *
 * The server publishes a coarse core TIER rather than the exact level, because the
 * exact level is what a probe is for. The disc turns it into one of three
 * silhouettes: a continuous ramp encoded five sizes no eye could separate, and the
 * three-step version is the only reason a glance at the galaxy tells you anything.
 */
export const worldWeight = (coreTier: number): 1 | 2 | 3 =>
  coreTier >= 4 ? 3 : coreTier >= 2 ? 2 : 1;

const WEIGHT_RADIUS: Record<1 | 2 | 3, number> = { 1: 0.44, 2: 0.82, 3: 1.4 };

/** How big a world is drawn, in world units. Map markers, not scale models. */
export const worldRadius = (coreTier: number): number => WEIGHT_RADIUS[worldWeight(coreTier)];

/**
 * HOW FAR SHORT OF A WORLD A CRAFT STOPS. D44.
 *
 * A leg's endpoint is the target planet's own coordinates, which are its CENTRE,
 * so an arriving squadron used to be drawn inside the thing it had come to attack.
 * That was invisible while an arrival lasted zero seconds; the engagement window
 * makes it a moment people watch, and it is also the distance the bombardment has
 * to cross — missiles need somewhere to come from, and "the point the squadron
 * actually holds" is the only honest answer.
 *
 * Scaled by the world rather than fixed, because worlds are drawn at three sizes
 * and one number would either bury a squadron inside a heavyweight or park it a
 * long way off a small one.
 */
export const orbitStandoff = (radius: number): number => radius * 1.5 + radius * 0.5;

/**
 * HOW FAR FROM ITS OWN WORLD A MOVING CRAFT APPEARS. D120.
 *
 * This is deliberately tighter than `orbitStandoff`: a departing or returning
 * craft is crossing the world's silhouette, not holding position over it. It used
 * to be enforced after every interpolation by projecting the craft back to the
 * surface. That made a whole interval of real positions collapse into one drawn
 * position — the visible pause at the start, end or middle of a leg.
 *
 * Baked into the endpoint once, every elapsed millisecond remains progress along
 * one straight leg. Both server and client need the same figure, so it belongs
 * beside the rest of the shared visual-leg definition.
 */
export const surfaceStandoff = (radius: number): number => radius * 1.15;

/**
 * The visual leg: where a craft is actually drawn setting off from, and where it
 * is actually drawn stopping.
 *
 * Both values are world-space distances, applied along the leg in world space and
 * handed back in GAME coordinates, so the server can publish a point the client
 * will draw in exactly the place it draws its own. A normal outbound mission uses
 * surface clearance at the start and orbital clearance at the end; a return swaps
 * those roles. Mining uses surface clearance only at its home end.
 *
 * NEITHER END MAY PASS THE MIDDLE. A hop between close neighbours would otherwise
 * finish behind where it started, which draws a craft flying backwards out of its
 * own planet.
 */
export function visualLeg(
  from: Vec3,
  to: Vec3,
  startStandoff = 0,
  endStandoff = 0,
): { from: Vec3; to: Vec3 } {
  if (startStandoff <= 0 && endStandoff <= 0) return { from, to };

  const a = toWorld(from);
  const b = toWorld(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len <= 0) return { from, to };

  const push = startStandoff > 0 ? Math.min(startStandoff, len * 0.5) / len : 0;
  const pull = endStandoff > 0 ? Math.min(endStandoff, len * 0.5) / len : 0;

  return {
    from: push > 0 ? toGame([a[0] + dx * push, a[1] + dy * push, a[2] + dz * push]) : from,
    to: pull > 0 ? toGame([b[0] - dx * pull, b[1] - dy * pull, b[2] - dz * pull]) : to,
  };
}

/**
 * Minutes remaining when a craft drawn on `visualLeg` crosses a sensor volume
 * centred on the destination.
 *
 * The stored mission distance reaches from world centre to world centre, while a
 * craft is drawn from the departure surface to the destination's orbit. Treating
 * those as the same leg makes a warning fire before the marker reaches the shell.
 * This function measures the exact shortened leg and its orbital endpoint, so
 * server warnings and the 3D boundary share one definition.
 */
export function sensorLeadOnVisualLeg(
  range: number,
  from: Vec3,
  to: Vec3,
  startStandoff: number,
  endStandoff: number,
  oneWayMinutes: number,
): number {
  if (range <= 0 || oneWayMinutes <= 0) return 0;

  const leg = visualLeg(from, to, startStandoff, endStandoff);
  const legLength = Math.hypot(
    leg.to.x - leg.from.x,
    leg.to.y - leg.from.y,
    leg.to.z - leg.from.z,
  );
  const destinationClearance = Math.hypot(
    to.x - leg.to.x,
    to.y - leg.to.y,
    to.z - leg.to.z,
  );

  // The craft holds outside a smaller shell for the whole leg.
  if (range < destinationClearance) return 0;
  // Extremely close worlds may collapse both adjusted endpoints to one point.
  if (legLength <= 0) return oneWayMinutes;

  return Math.min(1, (range - destinationClearance) / legLength) * oneWayMinutes;
}
