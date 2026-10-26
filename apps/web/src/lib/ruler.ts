/**
 * THE FORCE RULER'S AXIS — combat v3 (owner 2026-10-25). Spec B5.
 *
 * Both sides are matchup power (`readPowerRange`): firepower and durability against the other
 * side, counters, research, wounds and the Aegis in. This file only carries the reading's stamp
 * and where a ratio sits on the strip.
 */

/** Where their reading came from and how old it is. */
export interface ForceReading {
  /** Already worded: `sourceLabel` from the dossier. */
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

/** The strip runs from a quarter to four times, on a log scale: twice as strong reads as far as half. */
const SPAN = 2;

/** A ratio's place on the strip, 0–100; whatever runs off an end sits on it. */
export function ratioAt(ratio: number): number {
  if (!(ratio > 0)) return 0;
  const at = ((Math.log2(ratio) + SPAN) / (2 * SPAN)) * 100;
  return Math.max(0, Math.min(100, at));
}
