import { ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, GALAXY } from './constants.js';
import { asteroidOrbitRadius, type AsteroidSpec } from './galaxy.js';
import { isotopeProfile } from './research.js';

/**
 * THE DYNAMIC ASTEROID FIELD — one hour at a time. Owner instruction, 2026-09-16.
 * See `ASTEROID_DYNAMIC` for the rule and why it replaced the fixed-rate field.
 *
 * TWO PURE STEPS, SO THE STORED FACT IS SMALL. `planAsteroidHour` turns "how many
 * commanders played, and which showers cover this hour" into lanes; the worker
 * stores those lanes with the hour. `generateAsteroidHour` turns a stored hour back
 * into rocks, identically in every process, from a keyed stream the server owns. A
 * rock is therefore never stored and never moves: its hour's lanes cannot change
 * after they are written.
 */

const DAY_MINUTES = 24 * 60;

/** A shower as the planner needs it: season minutes and its multiplier. */
export interface AsteroidHourShower {
  startsAtMinute: number;
  endsAtMinute: number;
  multiplier: number;
}

/**
 * One stretch of an hour with a single spawn rate. Season minutes, half-open.
 *
 * `frontCount` of the `count` rocks arrive inside the stretch's first
 * `ASTEROID_SHOWER_FRONT_LOAD.minutes`; the rest anywhere in it.
 */
export interface AsteroidHourLane {
  fromMinute: number;
  untilMinute: number;
  count: number;
  frontCount: number;
}

/** The top rung a rock appearing on this season day may roll. */
export function asteroidMaxLevelOnDay(day: number): number {
  const ladder = ASTEROID_DYNAMIC.levelUnlockByDay;
  const index = Math.min(Math.max(0, Math.floor(day)), ladder.length - 1);
  return ladder[index] ?? GALAXY.asteroidOreByLevel.length - 1;
}

/** The public index of the `offset`-th rock of hour `hourOrdinal`. */
export function dynamicAsteroidIndex(hourOrdinal: number, offset: number): number {
  if (!Number.isInteger(hourOrdinal) || hourOrdinal < 0) {
    throw new RangeError('hourOrdinal must be a non-negative integer');
  }
  if (!Number.isInteger(offset) || offset < 0 || offset >= ASTEROID_DYNAMIC.indexSpanPerHour) {
    throw new RangeError('offset must fit the hour index span');
  }
  return ASTEROID_DYNAMIC.indexBase + hourOrdinal * ASTEROID_DYNAMIC.indexSpanPerHour + offset;
}

/** The hour a dynamic index belongs to, or null for a rock of the derived field. */
export function dynamicAsteroidHourOf(index: number): number | null {
  if (!Number.isInteger(index) || index < ASTEROID_DYNAMIC.indexBase) return null;
  return Math.floor((index - ASTEROID_DYNAMIC.indexBase) / ASTEROID_DYNAMIC.indexSpanPerHour);
}

export interface PlanAsteroidHourInput {
  /** Non-bot commanders active in the window before the hour opened. */
  activePlayers: number;
  hourStartsAtMinute: number;
  /** When spawning may begin: the hour start, or later if the hour opened late. */
  spawnFromMinute: number;
  seasonEndsAtMinute: number;
  showers: readonly AsteroidHourShower[];
}

/**
 * THE HOUR'S LANES. Split at every shower boundary inside the hour; each stretch
 * spawns `players x perPlayerPerHour x multiplier` per hour of its own length. A
 * stretch that begins exactly where a shower opens front-loads half of the shower's
 * BONUS — the owner's 2026-09-14 rule that a shower must be felt when it starts.
 */
export function planAsteroidHour(input: PlanAsteroidHourInput): AsteroidHourLane[] {
  const players = input.activePlayers;
  if (!Number.isInteger(players) || players < 0) {
    throw new RangeError('activePlayers must be a non-negative integer');
  }
  const hourEnd = input.hourStartsAtMinute + 60;
  const from = Math.max(input.hourStartsAtMinute, input.spawnFromMinute);
  const until = Math.min(hourEnd, input.seasonEndsAtMinute);
  if (players === 0 || !(until > from)) return [];

  const showers = input.showers.filter((shower) =>
    shower.multiplier > 1 && shower.startsAtMinute < until && shower.endsAtMinute > from);
  const cuts = [...new Set([
    from,
    until,
    ...showers.flatMap((shower) => [shower.startsAtMinute, shower.endsAtMinute])
      .filter((minute) => minute > from && minute < until),
  ])].sort((left, right) => left - right);

  const lanes: AsteroidHourLane[] = [];
  for (let index = 0; index + 1 < cuts.length; index += 1) {
    const start = cuts[index]!;
    const end = cuts[index + 1]!;
    const covering = showers.filter((shower) =>
      shower.startsAtMinute <= start && shower.endsAtMinute >= end);
    const multiplier = Math.max(1, ...covering.map((shower) => shower.multiplier));
    const hours = (end - start) / 60;
    const base = players * ASTEROID_DYNAMIC.perPlayerPerHour * hours;
    const count = Math.round(base * multiplier);
    const opens = covering.some((shower) => shower.startsAtMinute === start);
    const bonus = count - Math.round(base);
    const frontCount = opens
      ? Math.min(count, Math.max(0, Math.round(bonus * ASTEROID_SHOWER_FRONT_LOAD.share)))
      : 0;
    if (count > 0) lanes.push({ fromMinute: start, untilMinute: end, count, frontCount });
  }
  if (lanes.reduce((sum, lane) => sum + lane.count, 0) > ASTEROID_DYNAMIC.indexSpanPerHour) {
    throw new RangeError('The hour would spawn more rocks than its index span holds');
  }
  return lanes;
}

/** A level no higher than `maxLevel`, from the table's own weights renormalised. */
function rollLevelUpTo(roll: number, maxLevel: number): number {
  const weights = GALAXY.asteroidLevelWeights;
  const top = Math.min(maxLevel, weights.length - 1);
  let total = 0;
  for (let level = 1; level <= top; level += 1) total += weights[level] ?? 0;
  let acc = 0;
  for (let level = 1; level <= top; level += 1) {
    acc += (weights[level] ?? 0) / total;
    if (roll < acc) return level;
  }
  return top;
}

export interface GenerateAsteroidHourInput {
  hourOrdinal: number;
  lanes: readonly AsteroidHourLane[];
  /** One stream for this hour alone; the server keys it off the season secret. */
  rng: () => number;
  /** The season's isotope seed, so spectroscopy reads a dynamic rock like any other. */
  isotopeSeed: number;
}

/** Every rock of one stored hour, in index order. */
export function generateAsteroidHour(input: GenerateAsteroidHourInput): AsteroidSpec[] {
  const { rng } = input;
  const rocks: AsteroidSpec[] = [];
  for (const lane of input.lanes) {
    const span = lane.untilMinute - lane.fromMinute;
    const front = Math.min(span, ASTEROID_SHOWER_FRONT_LOAD.minutes);
    for (let laneIndex = 0; laneIndex < lane.count; laneIndex += 1) {
      const index = dynamicAsteroidIndex(input.hourOrdinal, rocks.length);
      // Random instants, not an even grid: "rastgele aralıklarla".
      const appearsAt = lane.fromMinute + rng() * (laneIndex < lane.frontCount ? front : span);
      const radius = asteroidOrbitRadius(rng());
      const speed = GALAXY.asteroidSpeedMin
        + rng() * (GALAXY.asteroidSpeedMax - GALAXY.asteroidSpeedMin);
      const level = rollLevelUpTo(rng(), asteroidMaxLevelOnDay(appearsAt / DAY_MINUTES));
      const life = (GALAXY.asteroidLifeHoursMin
        + rng() * (GALAXY.asteroidLifeHoursMax - GALAXY.asteroidLifeHoursMin)) * 60;
      const crystalShare = GALAXY.asteroidCrystalShareMin
        + rng() * (GALAXY.asteroidCrystalShareMax - GALAXY.asteroidCrystalShareMin);
      const isotope = isotopeProfile(input.isotopeSeed, index, appearsAt);
      rocks.push({
        index,
        level,
        ore: GALAXY.asteroidOreByLevel[level] ?? 0,
        crystalShare,
        deuteriumShare: isotope.deuteriumShare,
        isotopeRich: isotope.rich,
        radius,
        period: (2 * Math.PI * radius) / speed,
        phase: rng() * Math.PI * 2,
        inclination: Math.acos(rng() * 2 - 1),
        ascendingNode: rng() * Math.PI * 2,
        speed,
        appearsAt,
        expiresAt: appearsAt + life,
      });
    }
  }
  return rocks;
}
