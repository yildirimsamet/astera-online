/** Number formatting. Every figure a player reads goes through here. */

export const full = (value: number): string => Math.round(value).toLocaleString('en-US');

/**
 * Short form for tight columns: 12.4k, 1.8M.
 *
 * Used where the exact figure is not the decision — a storage bar, a ladder row.
 * Anything a player spends or loses is shown in full.
 */
export function compact(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** A probe report is a range, and it must never be shown as if it were a number. */
export const range = (low: number, high: number): string => `${compact(low)}–${compact(high)}`;

export const signed = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${full(Math.abs(value))}`;

export const percent = (value: number): string => `${String(Math.round(value * 100))}%`;
