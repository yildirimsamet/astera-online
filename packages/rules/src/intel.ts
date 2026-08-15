import { INTEL } from './constants.js';
import { clamp, seededFrom } from './rng.js';
import type { ClarityState, FleetStatus, Rng } from './types.js';

export const clarity = (telescopeLevel: number, veilLevel: number): number =>
  telescopeLevel - veilLevel;

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
 * Minutes of warning a radar gives before an inbound fleet lands.
 *
 * Fired at `arriveAt - lead`, not at launch: a 40-minute flight should not give
 * 40 minutes of notice. Higher radar buys a longer fuse; the panic window stays tight.
 */
export function radarLeadMinutes(radarLevel: number): number {
  const table = INTEL.radarLeadMinutes;
  const idx = clamp(Math.floor(radarLevel), 0, table.length - 1);
  return table[idx] ?? 0;
}

export const radarDetectsFleets = (radarLevel: number): boolean =>
  radarLeadMinutes(radarLevel) > 0;
