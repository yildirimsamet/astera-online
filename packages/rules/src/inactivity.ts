/** Continuous elapsed time, shared by selection queries and locked rechecks. */
export const INACTIVITY_MS = 48 * 60 * 60 * 1000;

/**
 * SILENT SPACE IS A WAITING ROOM. D212, owner rule 2026-10-07.
 *
 * A MAIN commander leaves after `idleMs` without a single development or combat order —
 * an attack, a building upgrade, a research, a ship or ground-defence order. Logging in
 * does not count. `INACTIVITY_MS` stays the return application's own expiry.
 *
 * Inside, the works run at `productionPace`: the rate is slowed and every ceiling keeps its
 * size, so staying is never the better way to grow.
 */
export const SILENT_SPACE = {
  idleMs: 30 * 60 * 60 * 1000,
  productionPace: 0.5,
} as const;

export interface SilentSpaceClock {
  /** The last development or combat order; null until the commander gives one. */
  readonly lastProgressAt: number | null;
  readonly joinedAt: number;
  readonly mainEnteredAt: number;
}

/** When the commander becomes due to leave. All instants are server epoch milliseconds. */
export function silentSpaceDueAt(state: SilentSpaceClock): number {
  return Math.max(state.lastProgressAt ?? -Infinity, state.joinedAt, state.mainEnteredAt) + SILENT_SPACE.idleMs;
}

/** Inclusive: exactly thirty hours is due. */
export function silentSpaceDue(state: SilentSpaceClock, now: number): boolean {
  return silentSpaceDueAt(state) <= now;
}
