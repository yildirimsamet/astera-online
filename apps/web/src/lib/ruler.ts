/**
 * THE FORCE AXIS — what the launch sheet puts on one scale. Spec B5.
 *
 * Both sides are `combatValue`: the resource cost of armed units, never damage or
 * spend. The inputs are the rules' own (`forecastLines`, `escapeLine`); this file
 * only carries their shapes and where the axis ends.
 */

export interface ForceReading {
  low: number;
  high: number;
  /** Where it came from, already worded: `sourceLabel` from the dossier. */
  source: string;
  /**
   * MINUTES SINCE IT WAS TRUE — NULL MEANS LIVE, and that is not zero.
   *
   * A world's defence is a frozen record and a pirate in a Telescope circle is
   * being looked at right now. Printing "0m old" over a live reading would demote
   * current sight to a very fresh memory.
   */
  ageMinutes: number | null;
}

/** `forecastLines`: armed-unit resource value at each limit, least to most favourable. */
export interface ForceLines {
  clears: { low: number; high: number };
  breaks: { low: number; high: number };
}

/**
 * The end of the axis: the largest thing on it — the wing, the band's top, the
 * breaks line's top — plus 15% headroom, rounded up to two significant figures so
 * the scale does not twitch with every ship added.
 */
export function rulerTop(...values: number[]): number {
  const raw = Math.max(0, ...values) * 1.15;
  if (raw <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.ceil(raw / step) * step;
}
