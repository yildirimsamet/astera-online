import { INTEL } from './constants.js';
import { clamp, seededFrom } from './rng.js';
import type { ClarityState, FleetStatus, InstrumentId, Rng, Vec3 } from './types.js';

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

/** How far it reaches, in game units. Infinite at the top of the table. D18. */
export const telescopeRange = (level: number): number =>
  atLevel(INTEL.telescopeRange, level);

export const withinTelescopeRange = (level: number, dist: number): boolean =>
  dist <= telescopeRange(level);

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
 * Minutes of notice a radar of this reach gives against one particular leg.
 *
 * A fleet is drawn — and therefore, for this purpose, IS — at a point interpolated
 * linearly along its leg between departure and arrival. So the fraction of the leg
 * still to fly when it crosses inside `range` is exactly `range / distance`, and
 * the notice is that fraction of the whole flight.
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

/** Radar L2 reveals a direction; L5 reveals who. Nothing in between. */
export const radarRevealsBearing = (radarLevel: number): boolean => radarLevel >= 2;
export const radarRevealsOrigin = (radarLevel: number): boolean => radarLevel >= 5;

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
