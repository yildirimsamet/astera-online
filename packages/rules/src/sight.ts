import { distance } from './travel.js';
import { radarContactRange, sensorReach } from './intel.js';
import type { Vec3 } from './types.js';

/**
 * SIGHT — the one place that answers "can this commander see that craft, and how
 * well". Owner's model, stated once so nothing else has to restate it.
 *
 * WHY THIS FILE EXISTS AT ALL. The answer used to be assembled from three
 * unrelated pieces in three files: a departure shroud inside the traffic
 * projection, a horizon test beside it, and a client-side boundary solver that
 * re-derived the same radii from a payload. They disagreed, and the disagreement
 * was invisible — a craft that satisfied none of them was simply absent, and an
 * absence looks exactly like a quiet galaxy. See the note on `sensorZone`.
 *
 * THE MODEL, IN THE OWNER'S WORDS. Two circles around every world a commander
 * controls, and a craft is in exactly one of three states relative to all of them:
 *
 *   · `NONE`        — outside every circle. It does not exist for this commander.
 *                     Not a question mark, not a mote: nothing.
 *   · `CONTACT`     — inside a RADAR circle. A question mark that moves exactly as
 *                     the craft moves. What it IS stays unknown; the radar ladder
 *                     decides how much more it will say.
 *   · `IDENTIFIED`  — inside a TELESCOPE circle. You see the thing itself: what
 *                     kind of craft and its coarse silhouette. You still do not
 *                     get its roster or ROUTE — where it came from and where it
 *                     is going are not things an eye can read.
 *
 * TRANSITIONS ARE THE PRODUCT, NOT A SIDE EFFECT. A craft crossing into the radar
 * ring must appear at that instant; crossing into telescope reach must resolve at
 * that instant; leaving must reverse both. That is what makes the ladder something
 * a player watches happen rather than reads about (D124), and it is why this
 * returns a ZONE rather than a boolean — a boolean cannot describe a transition
 * that has three sides.
 *
 * THE RADII COME FROM `sensorSphere` AND NOWHERE ELSE, so an instrument level is
 * turned into a distance exactly once in the codebase. The server builds spheres
 * for the caller and filters with them; the same two numbers are published so the
 * client can draw the boundary and solve for the crossing instant itself. Neither
 * side owns a second opinion.
 */

/** What one commander is entitled to see of one point in space. */
export type SensorZone = 'NONE' | 'CONTACT' | 'IDENTIFIED';

/**
 * One world's eyes: where they are, and the two distances they answer for.
 *
 * `identify` and `detect` are held separately rather than as a level pair because
 * the horizon has to be published to the client, and a level would let a modified
 * client work out hardware the fog does not disclose. Two radii disclose only the
 * caller's own reach, which the caller already paid for.
 */
export interface SensorSphere {
  /** Which of the caller's own worlds these eyes are. */
  planetId?: string;
  at: Vec3;
  /**
   * How far this world IDENTIFIES a craft. The Telescope, floored at the
   * naked-eye neighbourhood so a commander with no instrument still has a live
   * disc around them.
   */
  identify: number;
  /**
   * How far it DETECTS one at all. The Radar, and zero without one — the free
   * floor belongs to the eye, not to hardware nobody bought.
   */
  detect: number;
}

/**
 * Turn one world's instrument levels into the two distances it answers for.
 *
 * THE ONLY PLACE A LEVEL BECOMES A RADIUS. Both `sensorPosts` on the server and
 * every test build their spheres through this, so a table change moves every
 * surface at once and none of them can be left behind.
 */
export function sensorSphere(
  at: Vec3,
  telescopeLevel: number,
  radarLevel: number,
  planetId?: string,
): SensorSphere {
  return {
    ...(planetId === undefined ? {} : { planetId }),
    at,
    identify: sensorReach(telescopeLevel),
    detect: radarContactRange(radarLevel),
  };
}

/**
 * WHAT THIS COMMANDER SEES OF THIS POINT, RIGHT NOW.
 *
 * Evaluated against the craft's CURRENT position and against every world the
 * caller controls, taking the best answer any of them gives. A commander with four
 * worlds sees the union of four pairs of circles, which is what owning four worlds
 * is for.
 *
 * `identify` IS TESTED FIRST AND THAT IS LOAD-BEARING. The tables put the radar
 * outside the telescope at every level, but nothing in the type system enforces
 * it and a commander may hold a Telescope 5 beside a Radar 1. Testing the
 * identifying circle first means a craft inside it is identified whatever the
 * radar says — you cannot fail to detect something you are looking straight at.
 * The alternative, gating identification behind detection, would have produced a
 * world that resolves nothing because its radar is behind its telescope.
 *
 * THERE IS NO DEPARTURE SHROUD ANY MORE. D123 hid every craft for the first 225
 * units of its leg, from everybody, at every instrument level — on the argument
 * that watching a world and reading off what left it was the Telescope's own
 * product. Two things were wrong with it. It contradicted the model above, under
 * which a telescope sees what happens inside its circle and the thing it withholds
 * is the ROUTE, not the event. And it deleted rather than blindfolded, which D125
 * had already rejected for the horizon in as many words: a player who sees nothing
 * cannot tell an empty galaxy from a blind one. What the Telescope still sells is
 * the watch slot — the definitive, Veil-contested answer to "is their combat fleet
 * home" — for every world in the galaxy, including the ones out of reach.
 */
export function sensorZone(
  spheres: readonly SensorSphere[],
  point: Vec3,
): SensorZone {
  let best: SensorZone = 'NONE';
  for (const sphere of spheres) {
    const away = distance(sphere.at, point);
    if (away <= sphere.identify) return 'IDENTIFIED';
    if (away <= sphere.detect) best = 'CONTACT';
  }
  return best;
}

/** Convenience for the callers that only need "is it on my disc at all". */
export const sensorSees = (
  spheres: readonly SensorSphere[],
  point: Vec3,
): boolean => sensorZone(spheres, point) !== 'NONE';

/**
 * The widest circle a commander holds, in game units.
 *
 * Used to decide how far ahead anything has to be considered for them at all —
 * never to widen what they may read, which is `sensorZone`'s job alone.
 */
export const sensorHorizon = (spheres: readonly SensorSphere[]): number =>
  spheres.reduce((widest, sphere) => Math.max(widest, sphere.identify, sphere.detect), 0);

/** A stable linear point shared by server scheduling and client rendering. */
export const pointAlong = (from: Vec3, to: Vec3, progress: number): Vec3 => {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
};

/**
 * First future entry of a straight segment into one sphere.
 *
 * Interception is scheduled against a moving Death Star, not sampled by a worker
 * cadence. Solving the quadratic keeps the server event on the same geometric
 * boundary the client draws and works for a Telescope on any controlled world,
 * not only for a sphere centred on the target.
 */
export function sphereEntryFraction(
  from: Vec3,
  to: Vec3,
  centre: Vec3,
  radius: number,
): number | null {
  if (radius <= 0) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const ex = from.x - centre.x;
  const ey = from.y - centre.y;
  const ez = from.z - centre.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (a <= 0) return null;
  const c = ex * ex + ey * ey + ez * ez - radius * radius;
  // The caller handles the already-inside case immediately.
  if (c <= 0) return 0;
  const b = 2 * (dx * ex + dy * ey + dz * ez);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const entry = (-b - Math.sqrt(discriminant)) / (2 * a);
  return entry >= 0 && entry <= 1 ? entry : null;
}
