import { MULTI_WORLD } from './constants.js';
import type { PlanetKind, Vec3 } from './types.js';

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
 * THREE WEIGHTS — and the public tier is what picks one.
 *
 * This is what a surface says OUT LOUD about a world's development: one of three
 * words, off the coarse tier, because a sentence cannot be more precise than the
 * reading it describes. The DRAWN size is a separate question and reads the exact
 * level — see `worldRadius`.
 */
export const worldWeight = (coreTier: number): 1 | 2 | 3 =>
  coreTier >= 4 ? 3 : coreTier >= 2 ? 2 : 1;

/**
 * THE THREE AUTHORED SIZES. Owner-tuned, and the anchors the ramp below runs
 * through rather than the whole table.
 *
 * THE THREE ARE HELD APART DELIBERATELY. The middle is the anchor and does not
 * move; the outer two are placed relative to it, because the GAP is the whole
 * signal. 0.5 against 1.24 was a 2.5× spread, which reads as "somewhat bigger" at
 * the distances this map is actually flown at; a 3.18× spread makes a heavyweight
 * look like one from across the disc without a label.
 *
 * SHRUNK BY ×0.659 AT D166, AND UNIFORMLY. Owner call: worlds were reading too
 * large on the disc. The first pass moved the three by three different factors
 * (×0.64 / ×0.66 / ×0.57), which shrank the SIGNAL along with the marker — the
 * floor-to-cap ratio fell to 2.86 and the ramp's shape moved with it. So the
 * anchors are re-derived here rather than typed: the middle holds at 0.54, and the
 * outer two keep the tuned table's own two sub-ratios (×1.8636 below the middle,
 * ×1.7073 above it). One factor for all three, and the spread survives the shrink.
 *
 * ANY FUTURE RESIZE GOES THROUGH `WEIGHT_SCALE`, not through three hand-typed
 * numbers — that is what stopped this being noticed for a whole session.
 */
const WEIGHT_MIDDLE = 0.54;
/** The tuned table's own shape: how far the floor sits below the middle, and the cap above it. */
const WEIGHT_STEP = { down: 1.8636, up: 1.7073 } as const;
const WEIGHT_RADIUS: Record<1 | 2 | 3, number> = {
  1: WEIGHT_MIDDLE / WEIGHT_STEP.down,
  2: WEIGHT_MIDDLE,
  3: WEIGHT_MIDDLE * WEIGHT_STEP.up,
};

/**
 * THE TOP OF THE LADDER, IN CORE LEVELS.
 *
 * The last rung anything visual anchors on: the size ramp's cap here, and the dyson
 * ladder's last colour in `DysonShells`. It is exported so those two cannot drift
 * — a world drawn at full size while its structure had a rung left, or the other
 * way round, is the disc contradicting itself about the same fact.
 *
 * IT IS THE TOP OF THE GAME, NOT AN ARBITRARY CAP. Nothing in `build.ts` caps the
 * Command Core — only non-CORE buildings are held under it — the ECONOMY does.
 * `upgradeCost(L).alloy` grows faster than `storageCap(alloyRate(L), L)`, and on
 * the current tempo the two cross between 21 and 22: 20 → 21 costs 307,331 against
 * a full store of 382,919, while 21 → 22 wants 473,290 against 454,907. So 21 is
 * the last rung a world reaches on its own production, and past it a Core rises
 * only on resources shipped in from colonies. Anchoring the last size and the last
 * colour there means the top of both ladders is the top of what anyone plays to.
 *
 * Re-derive it whenever `ECON` moves. The figures in the sentence above are the
 * check, and the old ones (591,044 against 590,789) no longer reproduce — the same
 * conclusion, at a tempo that has since changed underneath it.
 */
export const CORE_TOP_LEVEL = 21;

/**
 * WHERE EACH AUTHORED SIZE SITS ON THE CORE LADDER. D153.
 *
 * The floor, the exact middle, and the cap. The middle at 11 is what keeps 0.82
 * meaning what it has always meant — it is the level halfway to the top of the game,
 * which is the world the number was chosen to describe.
 */
const RADIUS_LEVEL: Record<1 | 2 | 3, number> = { 1: 1, 2: 11, 3: CORE_TOP_LEVEL };

/**
 * HOW BIG A WORLD IS DRAWN, IN WORLD UNITS — one step per Core level. D153.
 *
 * Map markers, not scale models. A planet at true scale in a disc 2,000 units
 * across would be invisible, so these are sized to be READ.
 *
 * IT USED TO BE THREE FLAT SIZES OFF THE COARSE TIER, and the owner's report is what
 * that looked like from the map: the whole public development signal arrived in two
 * hard steps — Core 3 → 4 at +86% and Core 9 → 10 at +71% — so a neighbour who was
 * one thing yesterday was suddenly another, and the eight levels between those two
 * moments said nothing at all. A silhouette that changes only twice in a season is
 * not a gradient, it is two announcements.
 *
 * SO THE THREE SIZES BECAME THE ANCHORS OF A RAMP, and nothing about the tuned
 * SHAPE moved: the same two sub-ratios, and the same 3.18× between the ends that is
 * the only reason a glance at the galaxy tells you anything. What changed is that
 * the distance between them is now paid one level at a time. D166 then shrank all
 * three by one factor — see `WEIGHT_RADIUS` — which moves the markers without
 * touching any of that.
 *
 * GEOMETRIC, NOT LINEAR, because the eye reads size as a ratio. Linear steps would
 * grow a small world by a tenth and a large one by a thirtieth for the same level —
 * the ramp would feel like it stalled exactly where the game gets interesting.
 * Constant ratio per rung is a constant amount of "it grew", and the largest single
 * step in the whole ladder is under 7%: growth you notice over a session, never a
 * jump you notice between two refreshes.
 *
 * READING THE EXACT LEVEL COSTS NOTHING NEW. `publicGalaxy` has published
 * `coreLevel` since the dyson rings — a ring count stepping every three levels and a
 * colour stepping every one cannot be drawn from a tier — so this is the same public
 * fact drawn at the resolution it was already published at. The tier stays where it
 * was and is still what D49's ±2 attack band is defined on.
 *
 * CLAMPED AT BOTH ENDS. Below the floor because D127 omits `coreLevel` for an
 * UNKNOWN world and the schema parses the gap to zero — a point with nothing behind
 * it is drawn at the smallest size, which is exactly what it was before. Above the
 * cap because a Core fed by colonies must not keep inflating its own marker.
 *
 * AND TOTAL ON A LEVEL THAT IS NOT A NUMBER, because this feeds position buffers
 * and one NaN takes the whole scene down. A missing level is the same answer as a
 * level of zero: the smallest size, which is what an unread world is drawn at.
 */
export function worldRadius(coreLevel: number): number {
  if (!Number.isFinite(coreLevel)) return WEIGHT_RADIUS[1];
  const level = Math.min(Math.max(coreLevel, RADIUS_LEVEL[1]), RADIUS_LEVEL[3]);
  const [from, to] = level <= RADIUS_LEVEL[2] ? ([1, 2] as const) : ([2, 3] as const);
  const share = (level - RADIUS_LEVEL[from]) / (RADIUS_LEVEL[to] - RADIUS_LEVEL[from]);
  return WEIGHT_RADIUS[from] * (WEIGHT_RADIUS[to] / WEIGHT_RADIUS[from]) ** share;
}

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
 * Scaled by the world rather than fixed, because worlds are drawn over a 3.2×
 * range of sizes and one number would either bury a squadron inside a heavyweight
 * or park it a long way off a small one.
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
 * HOW FAR APART TWO FLEETS HOLD WHILE THEY SHOOT AT EACH OTHER. D150.
 *
 * A raid on a WORLD has somewhere to stop: the planet has a radius and the
 * squadron holds off its surface, which is also the gap the bombardment crosses.
 * A pirate fight happens at a rendezvous in open space — a point, with no size —
 * so both sides arrived at the SAME coordinates and there was no distance for a
 * round to travel. `Bombardment` refuses a zero gap outright, which is why the
 * fight drew nothing at all.
 *
 * A WORLD-SPACE DISTANCE, LIKE `surfaceStandoff`, and deliberately small: this is
 * two formations at knife range, not a siege. The attacker holds short of the
 * meeting point along its own approach and the pirate holds ON it, so the two face
 * each other down the line the attacker actually flew in on.
 *
 * AND IT IS THE ONLY STATEMENT OF THAT GAP. The attacker's own client used to
 * carry a second one — `PIRATE_STANDOFF`, six world units against this one's 1.6 —
 * so the owner watched their squadron hold nearly four times further out than
 * every other commander in the galaxy saw it hold. That is the exact fault D106
 * was written about, on the one lane D106 had not been applied to. There is now
 * one constant and both sides read it; a second copy of this number is a bug by
 * construction, not a tuning choice.
 *
 * WHY 2.2. The owner reported the fight reading as two fleets shouting across a
 * canyon, and asked for half the gap they were seeing. What they were seeing was
 * the disagreement above — their own hold at 6 against a pirate drawn at 1.6, so
 * 4.4 world units — and half of that is this. It also lands inside the band a
 * siege already occupies (`orbitStandoff` spans 0.88 to 2.8 across the world-size
 * ramp), which is what keeps a pirate engagement reading as the same KIND of
 * event as a raid on a world rather than as a different one.
 */
export const ENGAGEMENT_STANDOFF = 2.2;

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

/**
 * HOW LONG THIS WORLD STAYS DARK AFTER A STRIKE. D167.
 *
 * The one place a world's KIND becomes a recovery window, so the server, the
 * client's warning copy and the simulator cannot disagree about a clock the player
 * is being asked to race.
 *
 * A NEUTRAL WORLD TAKES THE CAPITAL'S SHORT WINDOW, and that is not an oversight.
 * The long one exists to give a commander time to answer a threat to something they
 * hold; a world nobody holds has nobody to answer and nothing to lose, so the long
 * clock would only be a longer wait for whoever is trying to take it.
 */
export const recoveryMinutesFor = (kind: PlanetKind): number =>
  (kind === 'COLONY' ? MULTI_WORLD.recoveryMinutes.colony : MULTI_WORLD.recoveryMinutes.capital);
