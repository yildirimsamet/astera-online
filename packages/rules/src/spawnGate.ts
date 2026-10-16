/**
 * THE SKY NEVER OUTNUMBERS THE PEOPLE UNDER IT. Owner rule, 2026-10-17.
 *
 * Outside asteroid showers, the rocks drifting in a galaxy never outnumber the commanders who
 * played in the last five minutes; pirate fleets follow the same cap with no exception. The
 * hourly plans stay exactly as they are. Each planned birth is checked once, at its own
 * instant, by the worker: a birth that would bring the drifting count to the cap is skipped,
 * and that decision is stored so every read agrees with it forever after.
 */
export const SPAWN_GATE = {
  /** "Son 5 dakikada oyunda olan herkes." */
  onlineWindowMinutes: 5,
} as const;

export interface GateSpawn {
  index: number;
  appearsAt: number;
  expiresAt: number;
}

/**
 * Indexes to skip among `births`, decided in birth order (ties by index). `alive` holds what
 * already drifts and can still count: decided, unskipped, not depleted or destroyed. A kept
 * birth counts for every later birth until it expires; an exempt instant never skips.
 */
export function decideSpawnGate(input: {
  births: readonly GateSpawn[];
  alive: readonly GateSpawn[];
  cap: number;
  exempt?: (minute: number) => boolean;
}): number[] {
  if (!Number.isInteger(input.cap) || input.cap < 0) throw new RangeError('Spawn cap must be a non-negative integer');
  const births = [...input.births].sort((a, b) => a.appearsAt - b.appearsAt || a.index - b.index);
  const drifting: GateSpawn[] = [...input.alive];
  const skipped: number[] = [];
  for (const birth of births) {
    const at = birth.appearsAt;
    const count = drifting.filter((spec) => spec.appearsAt <= at && spec.expiresAt > at).length;
    if (input.exempt?.(at) !== true && count >= input.cap) skipped.push(birth.index);
    else drifting.push(birth);
  }
  return skipped;
}

/**
 * What a read may show. Births before activation are untouched; after it, only births the
 * worker has already decided and kept. A gate that is off passes the field through.
 */
export function gateSpawns<T extends { index: number; appearsAt: number }>(
  field: readonly T[],
  gate: { fromMinute: number; throughMinute: number } | null,
  skipped: ReadonlySet<number>,
): T[] {
  if (gate === null) return [...field];
  return field.filter((spec) => spec.appearsAt < gate.fromMinute
    || (spec.appearsAt <= gate.throughMinute && !skipped.has(spec.index)));
}
