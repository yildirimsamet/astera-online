import { ANTI_STRATEGIC, INTEL, SENSOR } from './constants.js';
import { fleetValue } from './hulls.js';
import { clamp, seededFrom } from './rng.js';
import type {
  ClarityState,
  Fleet,
  FleetStatus,
  InstrumentId,
  MassClass,
  Rng,
  Vec3,
} from './types.js';

/** Table lookup by level, clamped at both ends. Levels can exceed a table's length. */
const atLevel = (table: readonly number[], level: number): number =>
  table[clamp(Math.floor(level), 0, table.length - 1)] ?? 0;

export const clarity = (telescopeLevel: number, veilLevel: number): number =>
  telescopeLevel - veilLevel;

/**
 * THE TOP OF EACH INSTRUMENT, AND WHY TWO OF THEM HAVE ONE. D36.
 *
 * `atLevel` clamps, so a table with six entries has always meant "level 5 is the
 * last one that buys anything" — but nothing enforced or communicated that. A
 * player could raise a Radar to 8 at an exponential price, and every level past 5
 * changed precisely nothing: the reach table is exhausted, the bearing arrives at
 * L2 and the origin at L5. The interface duly reported "500 -> 500" and
 * charged them anyway.
 *
 * So the cap is not a new design decision — it is the one the tables already
 * describe, finally made honest. It is derived from the table length rather than
 * typed twice, so extending a table raises the ceiling with it.
 *
 * THE AEGIS AND THE VEIL HAVE NO TABLE AND SO HAVE NO CAP. A shield is an
 * exponential curve that keeps growing, and a Veil is measured against whatever
 * telescope and Shipyard the rest of the galaxy has built — both genuinely keep
 * buying something at every level.
 */
export const INSTRUMENT_MAX_LEVEL: Readonly<Record<InstrumentId, number | null>> = {
  TELESCOPE: INTEL.telescopeRange.length - 1,
  RADAR: INTEL.radarRange.length - 1,
  AEGIS: null,
  VEIL: null,
};

/** Whether this instrument has nothing left to sell at `level`. */
export const instrumentMaxed = (id: InstrumentId, level: number): boolean => {
  const max = INSTRUMENT_MAX_LEVEL[id];
  return max !== null && level >= max;
};

/* ── what a telescope is allowed to do at all ───────────────── */

/**
 * How many planets a telescope can hold in view at once. D18.
 *
 * Slower than one-per-level, which is what it used to be: L1 and L2 watch one, L3
 * and L4 watch two, L5 and L6 watch three. Watching a fourth planet is a genuine
 * mid-season project rather than something that arrives with the next upgrade, and
 * that scarcity is what makes the choice of WHO mean anything.
 */
export const telescopeSlots = (level: number): number => {
  /**
   * CLAMPED TO THE INSTRUMENT'S OWN CEILING. D36.
   *
   * This was the one telescope effect with no table behind it, so while range and
   * cooldown quietly stopped at L5 the slot count went on forever: L7 bought a
   * fourth watch slot, L9 a fifth, L11 a sixth. That is the opposite of what D18
   * says the slot economy is for — "watching a fourth planet is a genuine
   * mid-season project" — and it made an unbounded fog advantage purchasable by
   * anyone who simply kept paying.
   */
  const capped = Math.min(level, INSTRUMENT_MAX_LEVEL.TELESCOPE ?? level);
  return capped <= 0 ? 0 : 1 + Math.floor((capped - 1) / 2);
};

/** How far the raw ladder reaches, in game units. D18. */
export const telescopeRange = (level: number): number =>
  atLevel(INTEL.telescopeRange, level);

/**
 * How far a telescope may actually be pointed.
 *
 * Identical to the raw ladder now that the table states its own ceiling, and kept
 * as a separate name because a WATCH and a LIVE DISC are two different products
 * that happened to share a number. A watch outside the horizon could never produce
 * a live world, so the assignment gate and every read-time revalidation use this.
 */
export const telescopeWatchRange = (level: number): number =>
  Math.min(SENSOR.maxRadius, telescopeRange(level));

/**
 * ONE INSTRUMENT, ONE REACH. D127.
 *
 * This used to read the raw `telescopeRange` while that table's top rung was
 * `Infinity`, so at L5 a commander could spend a watch slot on a world five
 * thousand units away and the galaxy payload would then correctly refuse to say
 * anything about it. A slot paid for and a reading that never arrives is the worst
 * kind of bug in an information game — the interface selling something the rules
 * do not deliver.
 *
 * IT IS THE CEILING ONLY, NOT `sensorReach`. The first fix reached for that and
 * raised the FLOOR as well: `sensorReach` is floored at the naked-eye radius so a
 * commander with no Telescope still has a live neighbourhood, and binding the
 * watch to it handed every low Telescope several hundred units of free range.
 * The ladder's own steps are the design (D18); what needed capping was the top
 * rung, and only the top rung.
 */
export const withinTelescopeRange = (level: number, dist: number): boolean =>
  dist <= telescopeWatchRange(level);

/**
 * Hours a slot is locked after being pointed somewhere new. D18.
 *
 * Charged on RE-POINTING only. Filling an empty slot is free — the price is
 * changing your mind, not looking — so a player who has just installed their first
 * telescope is never made to wait before using it.
 */
export const telescopeCooldownHours = (level: number): number =>
  atLevel(INTEL.telescopeCooldownHours, level);

export function clarityState(c: number): ClarityState {
  if (c >= 2) return 'FULL';
  if (c === 1) return 'CLEAR';
  if (c === 0) return 'INTERMITTENT';
  if (c === -1) return 'DEGRADED';
  return 'BLIND';
}

export interface TelescopeReading {
  status: FleetStatus;
  /** Minutes since this was last actually confirmed. Zero means live. */
  staleMinutes: number;
  /** Only at clarity >= +2. */
  etaMinutes: number | null;
  state: ClarityState;
  clarity: number;
}

/**
 * Seed for a telescope read, stable within its refresh window.
 *
 * WHY THIS MATTERS: if the roll were fresh on every request, a player would
 * defeat the entire fog layer by pulling to refresh until INTERMITTENT happened
 * to yield a confirmation. Binding the seed to (watchId, timeWindow) means the
 * answer is the same all window long, however many times you ask.
 */
export function telescopeSeed(watchId: string, nowMinutes: number): Rng {
  const window = Math.floor(nowMinutes / INTEL.intermittentRefreshMin);
  return seededFrom(watchId, window);
}

/**
 * What a telescope shows this instant.
 *
 * The interesting state is INTERMITTENT: real information that may be stale.
 * A binary level check would produce a yes/no; a gradient produces judgement.
 */
export function telescopeReading(
  observerTelescope: number,
  targetVeil: number,
  trueStatus: FleetStatus,
  minutesSinceConfirmed: number,
  etaMinutes: number | null,
  rng: Rng,
): TelescopeReading {
  const c = clarity(observerTelescope, targetVeil);
  const state = clarityState(c);
  const base = { state, clarity: c };

  switch (state) {
    case 'FULL':
      return { ...base, status: trueStatus, staleMinutes: 0, etaMinutes };
    case 'CLEAR':
      return { ...base, status: trueStatus, staleMinutes: 0, etaMinutes: null };
    case 'INTERMITTENT': {
      const dropped = rng() < INTEL.intermittentDropRate;
      const stale = dropped
        ? minutesSinceConfirmed + INTEL.intermittentRefreshMin
        : Math.min(minutesSinceConfirmed, INTEL.intermittentRefreshMin);
      return { ...base, status: trueStatus, staleMinutes: stale, etaMinutes: null };
    }
    case 'DEGRADED':
      return rng() < INTEL.degradedUnknownRate
        ? { ...base, status: 'UNKNOWN', staleMinutes: 0, etaMinutes: null }
        : { ...base, status: trueStatus, staleMinutes: minutesSinceConfirmed, etaMinutes: null };
    default:
      return { ...base, status: 'UNKNOWN', staleMinutes: 0, etaMinutes: null };
  }
}

/** Probing is always loud; watching is always silent. That asymmetry is deliberate. */
export const detectChance = (radarLevel: number, probeStealthLevel: number): number =>
  clamp(
    INTEL.detectBase + INTEL.detectSlope * (radarLevel - probeStealthLevel),
    INTEL.detectMin,
    INTEL.detectMax,
  );

export const probeAccuracy = (probeLevel: number, veilLevel: number): number =>
  clamp(
    INTEL.accuracyBase + INTEL.accuracySlope * (probeLevel - veilLevel),
    INTEL.accuracyMin,
    INTEL.accuracyMax,
  );

export interface Band {
  low: number;
  high: number;
  mid: number;
}

/**
 * A probe report is a band, not a number. A cheap scout tells you "somewhere
 * between 30k and 80k"; an expensive one tells you 61,000. Those are genuinely
 * different decisions, which is what makes probe level worth paying for.
 */
export function fuzzBand(trueValue: number, accuracy: number, rng: Rng): Band {
  const err = (1 - accuracy) * (rng() * 2 - 1);
  const mid = Math.max(0, Math.round(trueValue * (1 + err)));
  const spread = (1 - accuracy) * mid;
  return {
    low: Math.max(0, Math.round(mid - spread)),
    high: Math.round(mid + spread),
    mid,
  };
}

/**
 * HOW FAR A RADAR REACHES, in game units. D49.
 *
 * The radar is now a CIRCLE, like the telescope is a circle — not a countdown.
 * See `INTEL.radarRange` for why the countdown was wrong, and `radarLead` below
 * for how a radius turns back into the minutes of notice a player actually feels.
 */
export const radarRange = (radarLevel: number): number => atLevel(INTEL.radarRange, radarLevel);

export const radarDetectsFleets = (radarLevel: number): boolean => radarRange(radarLevel) > 0;

/**
 * HOW FAR AN INTERCEPTION GRID REACHES. T10.
 *
 * The timed-warning circle, deliberately. D126 currently merges it with contact
 * reach, but the products remain separate functions so a future split keeps the
 * interceptor on the clock-bearing boundary rather than on a public rumour.
 *
 * Zero below `ANTI_STRATEGIC.requiredRadar`, which is exactly why that rung is the
 * build requirement: there is nothing to fire along until the circle exists.
 */
export const interceptionRange = (radarLevel: number): number =>
  radarLevel >= ANTI_STRATEGIC.requiredRadar ? radarRange(radarLevel) : 0;

/**
 * How far a radar knows a fleet is aimed at you, without knowing when. D126.
 *
 * Provisionally equal to `radarRange` under D126 and deliberately carrying no
 * clock in the public traffic payload. See the constant for the cost accepted by
 * that temporary merge and the earlier split it may return to.
 */
export const radarContactRange = (radarLevel: number): number =>
  atLevel(INTEL.radarContactRange, radarLevel);

/**
 * Is this craft close enough for the radar to know it is coming at all? D126.
 *
 * TAKES THE REACH, NOT THE LEVEL, so the one caller that has a precomputed reach
 * does not have to restate the rule inline — which it did, and got wrong: it
 * measured the LENGTH OF THE LEG instead of how far away the craft actually is,
 * flagging a neighbour's raid from the instant it launched and never flagging a
 * distant one at all. A radius is answered by a distance, and there is now exactly
 * one place that says so.
 *
 * `reach` is zero only at Radar L0; every purchased rung has a circle. The zero
 * test is here rather than at the call site because a radius of zero and a craft
 * standing on the world would otherwise both be "distance ≤ reach".
 */
export const radarSensesIntent = (reach: number, dist: number): boolean =>
  reach > 0 && dist <= reach;

/**
 * Minutes of notice a radar of this reach gives against one particular leg.
 *
 * This centre-to-centre form is the conservative scheduling primitive for callers
 * that do not hold rendering endpoints. A rendered fleet starts at a world surface
 * and stops in orbit, so user-visible warnings must use `sensorLeadOnVisualLeg`
 * instead. Keeping the simple form is useful for rules-only comparisons and old
 * data, but it is not the 3D boundary contract.
 *
 * D9 IS PRESERVED BY THIS ARITHMETIC RATHER THAN BY A CLAMP. A long flight cannot
 * hand over its whole duration, because `range` is a fraction of its length. The
 * one case that does is a raid launched from INSIDE the circle, and `Math.min`
 * covers it — a neighbour that close is a few minutes away in any hull.
 *
 * Zero range gives zero notice, which is what makes `radarDetectsFleets` and this
 * function agree without either checking the other.
 */
export const radarLead = (range: number, dist: number, oneWayMinutes: number): number => {
  if (range <= 0 || oneWayMinutes <= 0) return 0;
  if (dist <= 0) return oneWayMinutes;
  return Math.min(1, range / dist) * oneWayMinutes;
};

/**
 * Every reach the ladder sells, widest first. D45's structure, D49's units.
 *
 * DERIVED from the table, so a sixth radar level or a changed figure is picked up
 * rather than duplicated. These are the only distances at which a warning can
 * fire, which is what lets the server re-read the defender's radar level at each
 * one instead of freezing it at launch.
 */
export const RADAR_RANGES: readonly number[] = [...new Set(INTEL.radarRange)]
  .filter((units) => units > 0)
  .sort((a, b) => b - a);

/** The widest any radar can see. Nothing is scheduled before a fleet crosses this. */
export const maxRadarRange = (): number => RADAR_RANGES[0] ?? 0;

/**
 * The next reach worth re-checking a radar at, given how long is left to fly.
 *
 * A warning scheduled at the widest crossing finds most defenders below the top of
 * the ladder, and a defender may buy or raise a radar mid-flight. Rather than
 * poll, the handler hops down the ladder: the next check is the widest reach whose
 * own crossing is still ahead. Returns null when the fleet is already inside the
 * narrowest reach — there is nothing left to buy.
 */
export const nextRadarCheck = (
  minutesRemaining: number,
  dist: number,
  oneWayMinutes: number,
): number | null =>
  RADAR_RANGES.find((range) => radarLead(range, dist, oneWayMinutes) < minutesRemaining) ?? null;

/**
 * Radar L2 reveals a direction; L4 estimates the size; L5 reveals who and what.
 *
 * THESE THREE ARE THE RADAR'S WHOLE PRODUCT AGAIN. D123. The size estimate and the
 * composition are what the ladder in `docs/game-design.md` has always advertised,
 * and both were being handed to every player at every level by the public contact
 * list — so a maxed Radar bought a bearing nobody needed and two facts everybody
 * already had. They are sold here, on the ATTRIBUTED payload, which is the only
 * place either one means anything: a roster is worth paying for when you know it
 * is coming for you, and worth nothing as one more mote on the disc.
 */
export const radarRevealsBearing = (radarLevel: number): boolean => radarLevel >= 2;
export const radarRevealsSize = (radarLevel: number): boolean => radarLevel >= 4;
export const radarRevealsOrigin = (radarLevel: number): boolean => radarLevel >= 5;
export const radarRevealsComposition = (radarLevel: number): boolean => radarLevel >= 5;

/* ── what the disc itself discloses ─────────────────────── */

/**
 * The silhouette a craft presents to anybody who is not its owner. D123.
 *
 * Priced off `fleetValue` rather than off a hull count, because value is what the
 * whole table is balanced on and a count would read six Bulwarks as lighter than
 * six Darts. A probe and an empty return leg both come out LIGHT, which is right:
 * a stranger cannot tell them apart and is not supposed to.
 */
export function massClass(fleet: Fleet): MassClass {
  const value = fleetValue(fleet);
  if (value >= SENSOR.massHeavy) return 'HEAVY';
  return value >= SENSOR.massMedium ? 'MEDIUM' : 'LIGHT';
}

/**
 * How far one world sees craft moving, in game units. D123.
 *
 * The Telescope's own reach, floored at the naked-eye neighbourhood. A commander
 * with no Telescope still has a live disc around them; every level of Telescope
 * lights up more of the galaxy, which is the first time that instrument has sold
 * something a player can watch happen.
 *
 * Deliberately the Telescope's identifying radius, not Radar's wider contact
 * radius. Radar supplies the anonymous outer zone (and marks inbound intent);
 * Telescope is what turns a moving question mark into a craft silhouette.
 *
 * THE CAP AND THE TABLE NOW AGREE. `telescopeRange` used to end at `Infinity`
 * and `SENSOR.maxRadius` existed to cut it back; the table states its own ceiling
 * since the owner's ladder, so this `min` is a guard rather than the rule. The
 * naked-eye floor below is the part that still does real work.
 *
 * THIS IS THE `identify` RADIUS OF A SENSOR SPHERE. See `sight.ts` for the model
 * it belongs to; nothing outside `sensorSphere` should turn a level into a radius.
 */
export const sensorReach = (telescopeLevel: number): number =>
  Math.min(
    SENSOR.maxRadius,
    Math.max(SENSOR.baseRadius, telescopeRange(telescopeLevel)),
  );

const COMPASS = [
  'east', 'south-east', 'south', 'south-west',
  'west', 'north-west', 'north', 'north-east',
] as const;

export type Bearing = (typeof COMPASS)[number];

/**
 * Eight-point compass direction from one planet to another, on the disc plane.
 *
 * Deliberately coarse: "a scan from the galactic north-west" should narrow the
 * suspect list without naming anyone. Precision here would collapse the mystery
 * that Radar L5 is supposed to be worth paying for.
 */
export function bearingBetween(from: Vec3, to: Vec3): Bearing {
  const degrees = (Math.atan2(to.z - from.z, to.x - from.x) * 180) / Math.PI;
  const index = Math.round(((degrees + 360) % 360) / 45) % 8;
  return COMPASS[index] ?? 'east';
}
