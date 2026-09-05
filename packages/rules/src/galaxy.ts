import { DEBRIS, GALAXY, PROSPECTOR, SEASON } from './constants.js';
import { prospectorHoldMult, type TechLevels } from './tech.js';
import { mulberry32, seededFrom } from './rng.js';
import { drillHoldMult, drillSpeedMult } from './economy.js';
import { isotopeProfile } from './research.js';
import { distance, travelExact } from './travel.js';
import type { SatelliteSet, Vec3 } from './types.js';
import type { PlannedGalaxyEvent } from './galaxyEvents.js';

export interface PlanetSlot extends Vec3 {
  index: number;
}

/**
 * A rock orbiting inside the galaxy sphere. D19.
 *
 * Circular orbit, constant speed, finite life. Everything about it is a pure
 * function of a server-held season key and its internal index. The server stores
 * only non-derivable ore claims and durable sensor epochs; clients receive only
 * trajectories they have earned, under opaque ids.
 *
 * WHY AN ORBIT AND NOT A STRAIGHT PASS. A one-way path can only ever be met by a
 * craft that is FASTER than the rock, which forced the speed band down until the
 * disc looked frozen. A closed orbit has no such constraint: the rock returns, so
 * a slower craft simply aims at a point on a later revolution. That frees the
 * speed to be whatever reads as movement, which is the whole point of drawing them.
 */
/**
 * ONE CLOSED CIRCLE INSIDE THE DISC, and the reason two unrelated lanes share it.
 *
 * A rock rides one of these (D19) and so does a pirate (D150), and the two must
 * describe the SAME shape — not two hand-copied blocks of trigonometry that
 * agree today. The whole reason either of them orbits rather than passing
 * through is written above `AsteroidSpec`: a straight pass can only be met by a
 * craft faster than the target, and a circle returns.
 *
 * NOTHING HERE IS EVER PUBLISHED. These five numbers ARE the route, and both the
 * asteroid fog (D143) and the pirate fog (D150) forbid a route. What reaches a
 * client is a point and a short bearing, never the elements that generate them.
 */
export interface OrbitElements {
  /** Orbital radius in game units. */
  radius: number;
  /** Minutes for one revolution. Derived from radius and speed. */
  period: number;
  /** Angle at time zero, in radians. */
  phase: number;
  /** Tilt from the horizontal plane, in radians. */
  inclination: number;
  /** Rotation of the tilted plane around the vertical axis, in radians. */
  ascendingNode: number;
  /** Game units per minute along the orbit. */
  speed: number;
}

export interface AsteroidSpec extends OrbitElements {
  index: number;
  /** 1-5. Sets how much ore it carries and nothing else. */
  level: number;
  /** Total ore at entry, in resource units. */
  ore: number;
  /** Share of `ore` that comes home as crystal; the remainder is alloy. */
  crystalShare: number;
  /** Share of total ore replaced by Deuterium. Zero on an ordinary rock. D93. */
  deuteriumShare: number;
  /** Public anomaly classification; exact composition remains research-gated. */
  isotopeRich: boolean;
  /** Minutes since season start. */
  appearsAt: number;
  /** Minutes since season start. It is gone after this. */
  expiresAt: number;
}

/** One uninterrupted version of a commander's spherical sensor post. */
export interface SensorEpoch {
  at: Vec3;
  reach: number;
  /** Minutes since season start, inclusive. */
  startsAt: number;
  /** Minutes since season start, exclusive. Null while this post is current. */
  endsAt: number | null;
}

export interface GalaxySpec {
  seed: number;
  slots: PlanetSlot[];
  asteroids: AsteroidSpec[];
}

/**
 * Deterministic galaxy generation. The same seed produces the same galaxy in the
 * server, simulator and deterministic tooling. Player APIs still send the
 * authoritative, fog-projected world coordinates rather than asking a client to
 * reconstruct private state.
 *
 * Slots fill a radius-bounded sphere with uniform-volume candidates. Randomised
 * placement still uses Poisson-style rejection to preserve readable separation.
 */
export function generateGalaxy(
  seed: number,
  slotCount: number = GALAXY.defaultSlots,
): GalaxySpec {
  const rng = mulberry32(seed);
  const slots: PlanetSlot[] = [];

  for (let i = 0; i < slotCount; i++) {
    let accepted: Vec3 | null = null;

    // A minimum separation is a contract, not a preference. The old best-of-12
    // fallback silently accepted overlaps once the 750-slot neutral search pool
    // became dense enough. Rejection remains cheap at the shipped density; an
    // impossible future layout fails loudly instead of creating a corrupt map.
    for (let attempt = 0; attempt < 96; attempt++) {
      // Cube-root radius gives equal density throughout the sphere's volume;
      // choosing radius linearly would crowd points around the centre.
      const r = Math.cbrt(rng()) * GALAXY.radius;
      const th = rng() * Math.PI * 2;
      const vertical = rng() * 2 - 1;
      const planar = Math.sqrt(1 - vertical * vertical);
      const candidate: Vec3 = {
        x: r * planar * Math.cos(th),
        y: r * vertical,
        z: r * planar * Math.sin(th),
      };

      let nearest = Infinity;
      for (const s of slots) nearest = Math.min(nearest, distance(candidate, s));
      if (slots.length === 0) nearest = Infinity;

      if (nearest >= GALAXY.minSeparation) {
        accepted = candidate;
        break;
      }
    }

    if (!accepted) {
      throw new RangeError(
        `Unable to place galaxy slot ${String(i)} with separation ${String(GALAXY.minSeparation)}`,
      );
    }
    slots.push({ index: i, x: accepted.x, y: accepted.y, z: accepted.z });
  }

  /**
   * The asteroid field gets its OWN generator, not the tail of the slot stream.
   *
   * Slot placement consumes a variable number of draws — the Poisson-disc loop
   * breaks early whenever a candidate is far enough from its neighbours — so
   * continuing that stream made the entire field depend on `slotCount`. Shards
   * with different capacities would then produce different rocks from the same
   * field input. Seeding separately keeps the deterministic schedule independent
   * from world-placement rejection draws, which is what A5 needs.
   */
  const field = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return { seed, slots, asteroids: generateAsteroidSchedule(field, seasonMinutes, seed) };
}

/** Minutes in a whole season. The asteroid schedule is laid out across it. */
const seasonMinutes = SEASON.days * 24 * 60;

/**
 * Pick a level from the weight table.
 *
 * Walks the cumulative weights rather than building a lookup, because the table is
 * five entries long and the arithmetic is the documentation.
 */
function rollLevel(roll: number): number {
  let acc = 0;
  for (let level = 1; level < GALAXY.asteroidLevelWeights.length; level++) {
    acc += GALAXY.asteroidLevelWeights[level] ?? 0;
    if (roll < acc) return level;
  }
  return 1;
}

/**
 * The season's whole asteroid schedule, in one deterministic pass.
 *
 * Spawns are spread evenly across the season with a jitter of one interval, so the
 * field holds a roughly steady population instead of arriving in clumps — the
 * player should never open the game to an empty sky or to forty rocks at once.
 *
 * Each rock is a CIRCLE: pick a radius inside the sphere, pick a speed, and the
 * revolution time falls out of the two. The phase and an isotropic orbital plane
 * are rolled; the period is never chosen. (This paragraph described chords long
 * after the straight-pass model was retired — see the note on `GALAXY` for why it
 * went, and `interceptAsteroid` for what a closed orbit buys the solver.)
 */
/** The established lane stays fixed so a density increase never moves a live rock. */
const ASTEROID_BASE_SPAWN_PER_HOUR = 9;
/** Independent from both planet placement and the established asteroid lane. */
const ASTEROID_EXTRA_LANE_SEED = 0x243f6a88;

/**
 * Map one uniform draw onto the measured orbit distribution.
 *
 * Measured against 4,000 generated player positions, sampling uniformly over
 * radius made the p90:p10 naked-eye opportunity ratio roughly 7.6x: it crowded
 * rocks near the centre while player worlds fill the sphere's volume. Sampling
 * uniformly over the fourth power of radius keeps that ratio near 2.1x while
 * retaining the full 400–2,000 span. `tools/asteroid-visibility-study.ts` owns
 * the reproducible comparison.
 */
export function orbitRadius(roll: number, inner: number, outer: number): number {
  if (!Number.isFinite(roll) || roll < 0 || roll > 1) {
    throw new RangeError('orbit roll must be between 0 and 1');
  }
  return Math.pow(inner ** 4 + roll * (outer ** 4 - inner ** 4), 1 / 4);
}

/** The rocks' band, through the shared draw. Byte-identical to what it replaced. */
export const asteroidOrbitRadius = (roll: number): number =>
  orbitRadius(roll, GALAXY.asteroidOrbitMin, GALAXY.asteroidOrbitMax);

function appendAsteroidLane(
  asteroids: AsteroidSpec[],
  rng: () => number,
  span: number,
  seed: number,
  count: number,
  indexOffset: number,
  appearsAtOffset = 0,
): void {
  if (count <= 0) return;
  const interval = span / Math.max(1, count);

  for (let laneIndex = 0; laneIndex < count; laneIndex++) {
    const index = indexOffset + laneIndex;
    const radius = asteroidOrbitRadius(rng());
    const speed =
      GALAXY.asteroidSpeedMin + rng() * (GALAXY.asteroidSpeedMax - GALAXY.asteroidSpeedMin);
    const level = rollLevel(rng());
    const appearsAt = appearsAtOffset + laneIndex * interval + rng() * interval;
    const life =
      (GALAXY.asteroidLifeHoursMin +
        rng() * (GALAXY.asteroidLifeHoursMax - GALAXY.asteroidLifeHoursMin)) *
      60;

    const isotope = isotopeProfile(seed, index, appearsAt);
    asteroids.push({
      index,
      level,
      ore: GALAXY.asteroidOreByLevel[level] ?? 0,
      crystalShare:
        GALAXY.asteroidCrystalShareMin +
        rng() * (GALAXY.asteroidCrystalShareMax - GALAXY.asteroidCrystalShareMin),
      deuteriumShare: isotope.deuteriumShare,
      isotopeRich: isotope.rich,
      radius,
      // Period follows from the two: speed is chosen for legibility, radius for
      // where in the disc it runs, and the revolution time is whatever that implies.
      period: (2 * Math.PI * radius) / speed,
      phase: rng() * Math.PI * 2,
      // Uniform cos(inclination) makes the orbit normals isotropic. Choosing the
      // angle itself uniformly would crowd orbital planes around the poles.
      inclination: Math.acos(rng() * 2 - 1),
      ascendingNode: rng() * Math.PI * 2,
      speed,
      appearsAt,
      expiresAt: appearsAt + life,
    });
  }
}

export function generateAsteroidSchedule(
  rng: () => number,
  span = seasonMinutes,
  seed = 0,
): AsteroidSpec[] {
  const totalCount = Math.round((GALAXY.asteroidSpawnPerHour * span) / 60);
  const baseCount = Math.min(
    totalCount,
    Math.round((ASTEROID_BASE_SPAWN_PER_HOUR * span) / 60),
  );
  const asteroids: AsteroidSpec[] = [];

  // Preserve the established 9/hour lane byte-for-byte. Increasing the rate by
  // squeezing one interval would move every live rock and invalidate a player's
  // visual target between two reads. New density is additive instead: the extra
  // lane has its own seed-shifted RNG and receives fresh indices after the stable
  // lane, so later edits to either lane cannot re-roll the other.
  appendAsteroidLane(asteroids, rng, span, seed, baseCount, 0);
  appendAsteroidLane(
    asteroids,
    mulberry32((seed ^ ASTEROID_EXTRA_LANE_SEED) >>> 0),
    span,
    seed,
    totalCount - baseCount,
    baseCount,
  );

  return asteroids;
}

/**
 * Append one isolated bonus lane per persisted Asteroid Shower occurrence.
 *
 * The input field is never mutated. Existing indices, random draws and opaque ids
 * remain stable; only fresh indices after the baseline are allocated. A shower's
 * lane contains no spawn at or after `endsAtMinute`, while each generated rock's
 * ordinary lifetime may extend well beyond that boundary.
 *
 * IT IS HANDED THE WHOLE CALENDAR AND TAKES ONLY WHAT IS ITS OWN. D156.
 *
 * This appended a lane for EVERY occurrence it was given, which was correct while
 * the calendar had exactly one kind in it. The moment a second kind exists, that
 * same code turns every trade-ship window into an asteroid shower — and NOTHING
 * WOULD FAIL: the field would simply be denser than the design says, for a reason
 * no test asks about. The filter therefore lives here rather than at the call
 * site, because a call site is a place a rule can be forgotten, and there will be
 * more call sites than there are today.
 *
 * The filter runs BEFORE the sort and before any draw, so the shower lanes take
 * exactly the number of draws in exactly the order they always did and no
 * existing rock id moves.
 */
export function withAsteroidShowerLanes(
  base: readonly AsteroidSpec[],
  occurrences: readonly PlannedGalaxyEvent[],
  isotopeSeed: number,
  rngForOccurrence: (occurrence: PlannedGalaxyEvent) => () => number =
    (occurrence) => seededFrom('asteroid:shower:v1', isotopeSeed, occurrence.sequence),
): AsteroidSpec[] {
  const asteroids = [...base];
  const showers = occurrences
    .filter((occurrence) => occurrence.kind === 'ASTEROID_SHOWER')
    .sort((left, right) => left.sequence - right.sequence);

  for (const occurrence of showers) {
    const duration = occurrence.endsAtMinute - occurrence.startsAtMinute;
    const multiplier = occurrence.effect.asteroidSpawnMultiplier;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError('Asteroid Shower duration must be positive');
    }
    if (!Number.isFinite(multiplier) || multiplier <= 1) {
      throw new RangeError('Asteroid Shower multiplier must be greater than one');
    }
    const count = Math.round(GALAXY.asteroidSpawnPerHour * (multiplier - 1) * duration / 60);
    appendAsteroidLane(
      asteroids,
      rngForOccurrence(occurrence),
      duration,
      isotopeSeed,
      count,
      asteroids.length,
      occurrence.startsAtMinute,
    );
  }
  return asteroids;
}

/** Is this rock in the disc at this instant? */
export const asteroidActive = (a: AsteroidSpec, minutes: number): boolean =>
  minutes >= a.appearsAt && minutes < a.expiresAt;

/**
 * Asteroid position is a pure function of the clock — never stored, never
 * simulated. This is what makes a living galaxy cost zero server work and zero
 * realtime bandwidth.
 *
 * Deliberately NOT clamped to the rock's lifetime: the solver evaluates it at
 * candidate times and then checks the answer lands inside the rock's life.
 * Callers that need "is it there" ask `asteroidActive`.
 */
export function orbitPosition(o: OrbitElements, minutes: number): Vec3 {
  const theta = o.phase + (2 * Math.PI * minutes) / o.period;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosNode = Math.cos(o.ascendingNode);
  const sinNode = Math.sin(o.ascendingNode);
  const cosInclination = Math.cos(o.inclination);
  const sinInclination = Math.sin(o.inclination);
  return {
    x: o.radius * (cosNode * cosTheta - sinNode * sinTheta * cosInclination),
    y: o.radius * sinTheta * sinInclination,
    z: o.radius * (sinNode * cosTheta + cosNode * sinTheta * cosInclination),
  };
}

/** One rock's point on its own circle. The shared trig, nothing added. */
export const asteroidPosition = (a: AsteroidSpec, minutes: number): Vec3 =>
  orbitPosition(a, minutes);

const TAU = Math.PI * 2;
const CONTACT_EPSILON = 1e-10;

/**
 * A BODY ON A CLOSED ORBIT WITH A LIFE. A rock, and since D158 a pirate.
 *
 * The discovery solve below is pure geometry — a circle, a sphere and a window —
 * and knows nothing about ore or crews. Naming the shape is what lets the pirate
 * lane share the exact maths rather than grow a second copy that drifts: the
 * failure this project has shipped before is two answers to one question, not one
 * answer used twice.
 */
export interface OrbitingBody extends OrbitElements {
  /** Minutes since season start. */
  appearsAt: number;
  /** Minutes since season start. It is gone after this. */
  expiresAt: number;
}

/** Squared distance without allocating the body's current point twice. */
function orbitDistanceSquared(a: OrbitingBody, at: Vec3, minutes: number): number {
  const point = orbitPosition(a, minutes);
  const dx = point.x - at.x;
  const dy = point.y - at.y;
  const dz = point.z - at.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * First exact instant a circular 3B orbit enters one spherical sensor epoch.
 *
 * The orbit is resolved analytically, not sampled. Sampling can miss a tangent or
 * a short pass and makes discovery depend on a server tick; the dot product below
 * reduces sphere contact to one cosine interval per revolution.
 */
export function firstOrbitSensorContact(
  asteroid: OrbitingBody,
  epoch: SensorEpoch,
  fromMinutes: number,
  toMinutes: number,
): number | null {
  if (
    !Number.isFinite(fromMinutes)
    || !Number.isFinite(toMinutes)
    || !Number.isFinite(epoch.startsAt)
    || !Number.isFinite(epoch.reach)
    || epoch.reach <= 0
    || !Number.isFinite(asteroid.period)
    || asteroid.period <= 0
    || !Number.isFinite(asteroid.radius)
    || asteroid.radius <= 0
    || toMinutes <= fromMinutes
  ) return null;

  const start = Math.max(fromMinutes, epoch.startsAt, asteroid.appearsAt);
  const epochEnd = epoch.endsAt ?? Infinity;
  const end = Math.min(toMinutes, epochEnd, asteroid.expiresAt);
  if (!Number.isFinite(start) || end < start) return null;
  if (start >= epochEnd || start >= asteroid.expiresAt) return null;

  const reachSquared = epoch.reach * epoch.reach;
  if (orbitDistanceSquared(asteroid, epoch.at, start) <= reachSquared + CONTACT_EPSILON) {
    return start;
  }

  const cosNode = Math.cos(asteroid.ascendingNode);
  const sinNode = Math.sin(asteroid.ascendingNode);
  const cosInclination = Math.cos(asteroid.inclination);
  const sinInclination = Math.sin(asteroid.inclination);
  // Unit basis of the orbit plane: p(theta) = radius * (u cos + v sin).
  const dotU = epoch.at.x * cosNode + epoch.at.z * sinNode;
  const dotV = epoch.at.x * (-sinNode * cosInclination)
    + epoch.at.y * sinInclination
    + epoch.at.z * (cosNode * cosInclination);
  const amplitude = Math.hypot(dotU, dotV);
  const centreSquared = epoch.at.x ** 2 + epoch.at.y ** 2 + epoch.at.z ** 2;
  const threshold = (
    asteroid.radius ** 2 + centreSquared - reachSquared
  ) / (2 * asteroid.radius);

  if (amplitude <= CONTACT_EPSILON || threshold > amplitude + CONTACT_EPSILON) return null;
  // The entire orbit is enclosed. The start check above would normally catch it;
  // retaining this branch makes the floating-point boundary explicit.
  if (threshold <= -amplitude + CONTACT_EPSILON) return start;

  const halfWidth = Math.acos(Math.max(-1, Math.min(1, threshold / amplitude)));
  const centreAngle = Math.atan2(dotV, dotU);
  const entryAngle = centreAngle - halfWidth;
  const angularSpeed = TAU / asteroid.period;
  const startAngle = asteroid.phase + angularSpeed * start;
  const revolutions = Math.ceil((startAngle - entryAngle) / TAU - CONTACT_EPSILON);
  const candidateAngle = entryAngle + Math.max(0, revolutions) * TAU;
  const candidate = (candidateAngle - asteroid.phase) / angularSpeed;

  if (candidate < start - CONTACT_EPSILON || candidate > end + CONTACT_EPSILON) return null;
  if (candidate >= epochEnd - CONTACT_EPSILON || candidate >= asteroid.expiresAt - CONTACT_EPSILON) {
    return null;
  }
  return Math.max(start, candidate);
}

/**
 * First contact already earned by this commander while the body still exists.
 *
 * PERMANENT BY CONSTRUCTION: it asks whether the orbit has EVER been inside one of
 * this commander's posts, so nothing that happens later — the body flying on, the
 * post being upgraded, the world being lost — can take the discovery back. Both
 * lanes rest on that: a rock stays mineable (D143) and, since D158, a pirate stays
 * on the disc (`pirateDiscoveredAt`).
 */
export function orbitDiscoveredAt(
  asteroid: OrbitingBody,
  epochs: readonly SensorEpoch[],
  nowMinutes: number,
): number | null {
  if (!Number.isFinite(nowMinutes) || nowMinutes < asteroid.appearsAt || nowMinutes >= asteroid.expiresAt) {
    return null;
  }
  let first: number | null = null;
  for (const epoch of epochs) {
    const found = firstOrbitSensorContact(
      asteroid,
      epoch,
      Math.max(asteroid.appearsAt, epoch.startsAt),
      Math.min(nowMinutes, epoch.endsAt ?? nowMinutes) + CONTACT_EPSILON,
    );
    if (found !== null && found <= nowMinutes + CONTACT_EPSILON && (first === null || found < first)) {
      first = found;
    }
  }
  return first;
}

/** Next contact the current/future sensor epochs will earn, excluding known rocks. */
export function nextAsteroidDiscoveryAt(
  asteroids: readonly OrbitingBody[],
  epochs: readonly SensorEpoch[],
  nowMinutes: number,
): number | null {
  if (!Number.isFinite(nowMinutes) || epochs.length === 0) return null;
  let next: number | null = null;
  for (const asteroid of asteroids) {
    if (asteroid.expiresAt <= nowMinutes || orbitDiscoveredAt(asteroid, epochs, nowMinutes) !== null) {
      continue;
    }
    for (const epoch of epochs) {
      const found = firstOrbitSensorContact(
        asteroid,
        epoch,
        Math.max(nowMinutes, epoch.startsAt, asteroid.appearsAt),
        Math.min(epoch.endsAt ?? asteroid.expiresAt, asteroid.expiresAt),
      );
      if (found !== null && found >= nowMinutes && (next === null || found < next)) next = found;
    }
  }
  return next;
}

/** Every rock in the disc right now, in stable index order. */
export const activeAsteroids = (
  asteroids: readonly AsteroidSpec[],
  minutes: number,
): AsteroidSpec[] => asteroids.filter((a) => asteroidActive(a, minutes));

export interface Interception {
  /** Minutes from now until the two meet. Fractional — the meeting is exact. */
  flightMinutes: number;
  /** Minutes since season start at which they meet. */
  meetsAtMinutes: number;
  /** Where. The craft flies a straight line from its planet to this point. */
  at: Vec3;
}

/**
 * Steps the scan takes when hunting for the first meeting, in minutes.
 *
 * FINE ENOUGH TO BE SAFE EVEN WHEN THE GUARANTEE BELOW DOES NOT HOLD. Above
 * `TRAVEL.distanceFactor x asteroidSpeedMax` the intercept function falls
 * monotonically and any step at all finds the one root; below it — a craft slower
 * than the rocks, which the solver still has to serve — `f` can rise and fall
 * within a step and a coarse scan could straddle a whole crossing pair.
 */
const SCAN_STEP = 0.2;
/** Bisection passes once a bracket is found. 40 is far past float precision. */
const REFINE = 40;

/**
 * WHERE TO AIM.
 *
 * A Prospector does not chase an asteroid; it flies to the place the asteroid WILL
 * BE, and the two arrive together. That is the whole of D19's "interception is
 * exact", and getting it right is what stops a mining run looking like a craft
 * sliding along behind a rock it never touches.
 *
 * THE EQUATION. Flight time obeys the game's own travel rule, so a meeting is any
 * delta where the time to fly to the rock's future position equals that delta:
 *
 *     f(d) = base + |A(now + d) - P| * factor / hullSpeed  -  d  =  0
 *
 * WHY THIS IS SOLVED NUMERICALLY AND NOT IN CLOSED FORM. On a straight-line path
 * `A` is linear and this collapses to a quadratic — which is how it was written
 * first, and it is genuinely neater. The cost was that a quadratic only has a
 * usable root when the craft is FASTER than the rock, which forced asteroid speeds
 * down until the field stopped visibly moving. On a circular orbit `A` is
 * trigonometric and there is no closed form, but the rock RETURNS: `f` changes
 * sign once per revolution, so a meeting exists for a craft of any speed. Trading
 * an elegant formula for a few hundred additions bought the motion back.
 *
 * `f(0)` is positive (you cannot arrive before you leave) and `f` falls by one per
 * minute between revolutions, so scanning forward for the first sign change and
 * bisecting inside it finds the EARLIEST meeting — which is the one a player means
 * when they send a squadron.
 *
 * AND ABOVE A CERTAIN SPEED THERE IS ONLY ONE MEETING TO FIND. `f' = factor x
 * (d|A - P|/dt) / speed - 1`, and the rock's contribution is bounded by its own
 * speed, so once `hullSpeed > factor x asteroidSpeedMax` every derivative is
 * negative: `f` is strictly decreasing, the root is unique, and no scan step can
 * straddle it. D74 deliberately puts the base Prospector below that bound (330
 * against 360), so generated-field coverage is asserted by the sweep in
 * `invariants.test.ts`; the solver has always supported slower craft because the
 * orbit comes back around.
 */
export function interceptOrbit(
  from: Vec3,
  hullSpeed: number,
  positionAt: (minutes: number) => Vec3,
  expiresAt: number,
  nowMinutes: number,
): Interception | null {
  if (hullSpeed <= 0) return null;

  /**
   * Time to fly to where the rock is at `now + delta`, minus delta.
   *
   * Reads `travelExact` rather than re-deriving the trip, so the moment this
   * solves for is the moment the craft actually arrives. The two used to be
   * written out separately and drifted by up to a minute — enough for a craft to
   * sit at the meeting point waiting for a rock that had not got there yet.
   *
   * IT USED TO READ A MINING-ONLY COPY OF THAT FUNCTION, because a drill paid a
   * smaller launch overhead than a warship (D48). D121 removed the overhead from
   * every craft, so there is one function again and the hazard that made the copy
   * necessary is gone with it. The LEAD is not: the rock moves for the whole
   * flight, which is what makes this a solve rather than a straight line — the
   * overhead only ever widened the angle, and `invariants.test.ts` still sweeps
   * the generated field to prove every rock stays reachable.
   */
  const f = (delta: number): number =>
    travelExact(distance(from, positionAt(nowMinutes + delta)), hullSpeed) - delta;

  // Never search past the target's own life: a meeting after it has gone is not one.
  const horizon = expiresAt - nowMinutes;
  if (horizon <= 0) return null;

  /**
   * The step index is multiplied, never accumulated.
   *
   * `delta += 0.2` over the eighteen hundred steps a six-hour rock needs drifts by
   * a measurable fraction of a step, and the last sample would land short of the
   * horizon by an amount that depends on how long the rock has left. Multiplying
   * makes every sample exact and the final one land ON the horizon rather than up
   * to a step inside it — which is what used to make a meeting in that last sliver
   * report as "it will leave before your craft could reach it".
   */
  const steps = Math.ceil(horizon / SCAN_STEP);
  let previous = f(0);
  let last = 0;

  for (let i = 1; i <= steps; i++) {
    const delta = Math.min(i * SCAN_STEP, horizon);
    const current = f(delta);
    if (previous > 0 && current <= 0) {
      // Bracketed. Bisect for the crossing.
      let lo = last;
      let hi = delta;
      for (let j = 0; j < REFINE; j++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0) lo = mid;
        else hi = mid;
      }
      const meets = nowMinutes + hi;
      if (hi <= 0 || meets >= expiresAt) return null;
      return { flightMinutes: hi, meetsAtMinutes: meets, at: positionAt(meets) };
    }
    previous = current;
    last = delta;
  }

  return null;
}

/**
 * WHERE TO AIM AT ONE ROCK. The shared solver, handed this rock's own orbit.
 *
 * This used to BE the solver. D150 needed the identical answer for a moving
 * pirate, and a second copy of a scan-and-bisect is precisely the failure this
 * project has already shipped and named — a rule honoured in one place and
 * forgotten in the other. `interception.test.ts` and the generated-field sweep in
 * `invariants.test.ts` were run unchanged either side of the extraction, which is
 * the only proof that mattered.
 */
export const interceptAsteroid = (
  from: Vec3,
  hullSpeed: number,
  asteroid: AsteroidSpec,
  nowMinutes: number,
): Interception | null =>
  interceptOrbit(
    from,
    hullSpeed,
    (minutes) => asteroidPosition(asteroid, minutes),
    asteroid.expiresAt,
    nowMinutes,
  );

export interface OreClaim {
  /** Ore units taken out of the rock. */
  taken: number;
  alloy: number;
  crystal: number;
  deuterium: number;
  /** What is left in the rock afterwards. Zero means it is mined out. */
  remaining: number;
}

/**
 * Take what the hold can carry, and no more.
 *
 * First craft to arrive gets first call on the ore; a later one takes whatever is
 * left; one that finds nothing takes nothing and goes home empty. That is the
 * whole race, and it is decided by arrival time alone — there is no dwell time at
 * the rock, so nobody can be beaten by a craft that arrived after them.
 */
export function claimOre(
  remaining: number,
  hold: number,
  crystalShare: number,
  deuteriumShare: number,
): OreClaim {
  const taken = Math.max(0, Math.min(remaining, hold));
  // A rock's independently seeded Crystal seam stays the same when it is isotope
  // rich. Deuterium replaces the ordinary Alloy body, never the Crystal that
  // makes the research path reachable. The generated maxima (65% + 25%) leave
  // at least 10% Alloy. The clamps also keep this shared primitive conservative
  // if a malformed caller ever supplies shares outside the generated range.
  const crystal = Math.max(0, Math.min(taken, Math.floor(taken * crystalShare)));
  const deuterium = Math.max(
    0,
    Math.min(taken - crystal, Math.floor(taken * deuteriumShare)),
  );
  return {
    taken,
    alloy: taken - crystal - deuterium,
    crystal,
    deuterium,
    remaining: Math.max(0, remaining - taken),
  };
}

/**
 * What a mining craft can do, given what is in orbit. D25.
 *
 * One satellite lifts the whole squadron at once — that is the Derrick's entire
 * job, and it is why it is worth a slot against production or fleet speed.
 */
export const prospectorSpeed = (orbit: SatelliteSet): number =>
  PROSPECTOR.speed * drillSpeedMult(orbit);

/**
 * The speed of the trip HOME, which is not the speed of the trip out.
 *
 * One definition, because three processes have to agree on it: the server writes
 * `homeAt` from it, every consumer — the owner's craft, the public contact, the
 * scheduled return — reads that stored instant rather than recomputing, and the
 * simulator has to price the same trip or it models a game we do not ship.
 *
 * A Derrick still lifts it: the multiplier is applied to the lifted speed rather
 * than to the base, so upgrading orbit shortens both legs in the same proportion.
 */
export const prospectorReturnSpeed = (orbit: SatelliteSet): number =>
  prospectorSpeed(orbit) * PROSPECTOR.returnSpeedFactor;

/**
 * What one mining craft carries home. T8.
 *
 * Hardware and technique, multiplied: a Derrick lifts every craft the player owns
 * and the research lifts every craft they will ever own. See `prospectorHoldMult`
 * for why the two compound rather than share.
 */
export const prospectorHold = (orbit: SatelliteSet, tech: TechLevels): number =>
  PROSPECTOR.hold * drillHoldMult(orbit) * prospectorHoldMult(tech);

/**
 * A joining player takes the free slot furthest from everyone already placed, so
 * the galaxy fills outward evenly rather than clustering by join order.
 */
export function pickSpawnSlot(
  slots: readonly PlanetSlot[],
  occupied: ReadonlySet<number>,
): PlanetSlot | null {
  let best: PlanetSlot | null = null;
  let bestScore = -1;

  for (const slot of slots) {
    if (occupied.has(slot.index)) continue;
    if (occupied.size === 0) return slot;

    let nearest = Infinity;
    for (const other of slots) {
      if (!occupied.has(other.index)) continue;
      nearest = Math.min(nearest, distance(slot, other));
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best = slot;
    }
  }
  return best;
}

/** Slots within `minutes` of `from`, at a given fleet speed. Someone's practical world. */
export function neighboursWithin(
  from: PlanetSlot,
  slots: readonly PlanetSlot[],
  maxDistance: number,
): PlanetSlot[] {
  return slots
    .filter((s) => s.index !== from.index && distance(from, s) <= maxDistance)
    .sort((a, b) => distance(from, a) - distance(from, b));
}

/* ── wreckage ───────────────────────────────────────────────── */

/**
 * What is left of a debris field right now. D32.
 *
 * Derived from the initial amount, the clock and what has already been carried
 * off — nothing about a field's current value is stored (A5). Decay is linear and
 * applies to the ORIGINAL pile rather than to the remainder, so a field is worth
 * exactly nothing at `DEBRIS.decayMinutes` however much of it was taken early.
 */
export function debrisRemaining(
  initial: number,
  taken: number,
  ageMinutes: number,
): number {
  if (initial <= 0) return 0;
  const left = 1 - ageMinutes / DEBRIS.decayMinutes;
  if (left <= 0) return 0;
  return Math.max(0, initial * left - taken);
}

/** Whether a field is still worth flying to. */
export const debrisAlive = (
  alloy: number,
  crystal: number,
  deuterium: number,
  takenAlloy: number,
  takenCrystal: number,
  takenDeuterium: number,
  ageMinutes: number,
): boolean =>
  debrisRemaining(alloy, takenAlloy, ageMinutes) +
    debrisRemaining(crystal, takenCrystal, ageMinutes) +
    debrisRemaining(deuterium, takenDeuterium, ageMinutes) >
  1;

/**
 * How much of a wreck field one trip takes.
 *
 * The same first-come-first-served shape as `claimOre`: whoever arrives takes what
 * their hold allows, and a later arrival gets whatever is left. Split across the
 * two piles in proportion to what is actually there, so a crystal-rich wreck
 * comes home crystal-rich.
 */
export function claimDebris(
  alloyLeft: number,
  crystalLeft: number,
  deuteriumLeft: number,
  hold: number,
): { alloy: number; crystal: number; deuterium: number } {
  const total =
    Math.max(0, alloyLeft) + Math.max(0, crystalLeft) + Math.max(0, deuteriumLeft);
  if (total <= 0 || hold <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const factor = Math.min(1, hold / total);
  return {
    alloy: Math.floor(Math.max(0, alloyLeft) * factor),
    crystal: Math.floor(Math.max(0, crystalLeft) * factor),
    deuterium: Math.floor(Math.max(0, deuteriumLeft) * factor),
  };
}
