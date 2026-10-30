import type { Resources } from './types.js';

/**
 * BİLDİRİM MERKEZİ: WHAT A WARNING OUTSIDE THE GAME COSTS. Owner 2026-10-30,
 * docs/bildirim-merkezi-plani-2026-10-30.md.
 *
 * The in-game warning stays free; a push to a closed phone is bought from a one-way
 * deuterium wallet. "Bir çıtır pahalı": every alert is a decision, so a price is
 * hours of the commander's WHOLE deuterium output with a floor, and the floor is what
 * keeps a commander with no plant from getting them free. A new paid kind is one row.
 */
export type AlertTiming = 'T3' | 'T5' | 'T15' | 'RADAR';
/** What a commander may choose for an inbound warning, cheapest first. */
export const ALERT_TIMINGS = ['T3', 'T5', 'T15', 'RADAR'] as const satisfies readonly AlertTiming[];
/** An event with no approach to time: it is sent the moment it happens. */
export type InstantTiming = 'NOW';

interface Price { hours: number; floor: number }
const INBOUND: Record<AlertTiming, Price> = {
  T3: { hours: 1, floor: 20 },
  T5: { hours: 1.5, floor: 30 },
  T15: { hours: 3, floor: 60 },
  RADAR: { hours: 5, floor: 100 },
};
const scaled = (table: Record<AlertTiming, Price>, by: number): Record<AlertTiming, Price> => ({
  T3: { hours: table.T3.hours * by, floor: table.T3.floor * by },
  T5: { hours: table.T5.hours * by, floor: table.T5.floor * by },
  T15: { hours: table.T15.hours * by, floor: table.T15.floor * by },
  RADAR: { hours: table.RADAR.hours * by, floor: table.RADAR.floor * by },
});

export const PAID_ALERTS = {
  /** An attack or a clan-war wave on any of the commander's worlds. */
  incoming_attack: { timed: INBOUND },
  /** A Death Star or another strategic weapon: half again the price. */
  incoming_strategic: { timed: scaled(INBOUND, 1.5) },
  /** A probe caught over one of the commander's worlds. */
  probe_detected: { now: { hours: 1, floor: 20 } },
} as const satisfies Record<string, { timed: Record<AlertTiming, Price> } | { now: Price }>;
export type PaidAlertKind = keyof typeof PAID_ALERTS;

export const NOTIFICATION_CENTER = {
  /** Built once, from the selected world's store: a Radar 2's price. */
  buildCost: { alloy: 1510, crystal: 1133, deuterium: 0 } satisfies Resources,
} as const;

/** Deuterium one alert costs; `deuteriumPerHour` is the commander's output across every world. */
export function alertPrice(kind: PaidAlertKind, timing: AlertTiming | InstantTiming, deuteriumPerHour: number): number {
  if (!Number.isFinite(deuteriumPerHour) || deuteriumPerHour < 0) throw new Error('Invalid deuterium rate');
  const row: { timed?: Record<AlertTiming, Price>; now?: Price } = PAID_ALERTS[kind];
  const price = timing === 'NOW' ? row.now : row.timed?.[timing];
  if (!price) throw new Error(`${kind} has no ${timing} alert`);
  // The epsilon keeps a float like 30.000000000004 from billing a whole extra unit.
  return Math.max(price.floor, Math.ceil(price.hours * deuteriumPerHour - 1e-9));
}

const LEAD_MINUTES: Record<Exclude<AlertTiming, 'RADAR'>, number> = { T3: 3, T5: 5, T15: 15 };

/**
 * WHEN THE PUSH LEAVES. Tied to the Radar (decision 4): nothing the radar never sees is
 * announced, and a radar that sees the fleet after the chosen moment sends it then.
 * Epoch milliseconds in and out: rules hold no clock.
 */
export function alertSendAt(timing: AlertTiming, arriveAtMs: number, radarSeenAtMs: number | null): number | null {
  if (radarSeenAtMs === null || radarSeenAtMs >= arriveAtMs) return null;
  if (timing === 'RADAR') return radarSeenAtMs;
  return Math.max(arriveAtMs - LEAD_MINUTES[timing] * 60_000, radarSeenAtMs);
}

/**
 * WHAT A PROBE CAN SAY ABOUT THE CENTRE (decision 8): one ladder, so "is it built" and
 * "is the wallet full" blur the same way. A rung is counted in the target's cheapest
 * alert, which is the number that decides whether the raid will be announced.
 */
export const CENTER_STATUSES = ['NONE', 'EMPTY', 'FEW', 'PLENTY'] as const;
export type CenterStatus = (typeof CENTER_STATUSES)[number];
export type CenterReading = CenterStatus | 'UNKNOWN';
/** Alerts a FEW wallet buys at most; one more is PLENTY. */
const FEW_ALERTS = 3;

export function centerStatus(built: boolean, wallet: number, cheapestAlert: number): CenterStatus {
  if (!built) return 'NONE';
  const alerts = Math.floor(wallet / cheapestAlert);
  return alerts === 0 ? 'EMPTY' : alerts <= FEW_ALERTS ? 'FEW' : 'PLENTY';
}

/**
 * Not certain on purpose ("kesin net bir sonuç olmayabilir"): the reading misses half as
 * often as the probe is inaccurate, and a miss is "unknown" or one rung off, never wild.
 * `accuracy` is `probeAccuracy(probe, veil)`.
 */
export function centerReading(truth: CenterStatus, accuracy: number, rng: () => number): CenterReading {
  if (rng() >= (1 - accuracy) / 2) return truth;
  if (rng() < 0.5) return 'UNKNOWN';
  const at = CENTER_STATUSES.indexOf(truth);
  const step = rng() < 0.5 ? -1 : 1;
  const next = CENTER_STATUSES[at + step] ?? CENTER_STATUSES[at - step];
  return next ?? truth;
}
