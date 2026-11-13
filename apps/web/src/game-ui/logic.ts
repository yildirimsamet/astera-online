/**
 * THE GAME KIT'S ARITHMETIC: one geometry for every bar, lever and hold, so a player
 * reads the same shapes the same way on every surface.
 */

export interface Span {
  readonly low: number;
  readonly high: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const tenth = (value: number): number => Math.round(value * 10) / 10;

/** How long a finger rests on a + before it starts repeating. */
export const REPEAT_START_MS = 380;
/** The fastest a held + repeats. */
export const REPEAT_MIN_MS = 45;

/** The pause before repeat `tick` + 1: quick to start, quicker as the hold goes on. */
export function repeatInterval(tick: number): number {
  return Math.max(REPEAT_MIN_MS, Math.round(160 * 0.88 ** tick));
}

/** How many a repeat adds: one at a time first, then steps scaled to the stock. */
export function repeatStep(tick: number, stock: number): number {
  if (tick < 10) return 1;
  return Math.max(1, Math.round(stock / (tick < 25 ? 40 : 15)));
}

/** The lever position nearest a point along its track (0…1). */
export function nearestDetent(fraction: number, count: number): number {
  return clamp(Math.round(fraction * (count - 1)), 0, count - 1);
}

/** The whole count a slider stands for at a point along its track (0…1). */
export function sliderValue(fraction: number, max: number): number {
  return Math.round(clamp(fraction, 0, 1) * max);
}

export interface RangeGeometry {
  /** Percent of the track: the sure part, then how far the range reaches. */
  readonly mine: { readonly solid: number; readonly reach: number };
  readonly theirs: { readonly solid: number; readonly reach: number; readonly unknown: boolean };
}

/**
 * BOTH SIDES ON ONE AXIS. The larger reach sits at 92 % so a growing wing has
 * somewhere to go; an unscouted side (`high: null`) hatches to the end of the track,
 * which is the honest drawing of "at least this much, and we have not seen the rest".
 */
export function rangeGeometry(mine: Span, theirs: { low: number; high: number | null }): RangeGeometry {
  const unknown = theirs.high === null;
  const top = Math.max(mine.high, theirs.high ?? theirs.low * 1.25);
  if (top <= 0) return { mine: { solid: 0, reach: 0 }, theirs: { solid: 0, reach: 0, unknown } };
  const scale = top / 0.92;
  const at = (value: number): number => tenth((value / scale) * 100);
  return {
    mine: { solid: at(mine.low), reach: at(mine.high) },
    theirs: { solid: at(theirs.low), reach: theirs.high === null ? 100 : at(theirs.high), unknown },
  };
}

export type CargoFitKind = 'covers' | 'partial' | 'short';

/** Whether the hold carries the loot band, with the three marks drawn on one track. */
export function cargoFit(capacity: number, loot: Span): { fit: CargoFitKind; capacity: number; low: number; high: number } {
  const fit: CargoFitKind = capacity >= loot.high ? 'covers' : capacity >= loot.low ? 'partial' : 'short';
  const top = Math.max(capacity, loot.high);
  if (top <= 0) return { fit, capacity: 0, low: 0, high: 0 };
  const scale = top / 0.9;
  const at = (value: number): number => tenth((value / scale) * 100);
  return { fit, capacity: at(capacity), low: at(loot.low), high: at(loot.high) };
}

/** The share of a ring a timer still draws. */
export function ringFraction(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(remaining / total, 0, 1);
}
