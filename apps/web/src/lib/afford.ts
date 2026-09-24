/**
 * MINUTES UNTIL A PRICE IS MET, at the planet's current rates.
 *
 * The larger of the two waits, since both prices must be met. It assumes the works
 * keep being emptied (D16), so it is a floor: a player who leaves the collectors
 * full waits longer than it says.
 *
 * Null when a resource that is short is not being made at all — "enough in ∞" is
 * worse than saying nothing.
 */
export function affordWait(
  short: { alloy: number; crystal: number },
  income: { alloyPerHour: number; crystalPerHour: number },
): number | null {
  const waits: number[] = [];
  for (const [missing, perHour] of [
    [short.alloy, income.alloyPerHour],
    [short.crystal, income.crystalPerHour],
  ] as const) {
    if (missing <= 0) continue;
    if (perHour <= 0) return null;
    waits.push((missing / perHour) * 60);
  }
  return waits.length === 0 ? 0 : Math.max(...waits);
}
