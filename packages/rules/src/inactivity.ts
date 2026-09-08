/** Continuous elapsed time, shared by selection queries and locked rechecks. */
export const INACTIVITY_MS = 48 * 60 * 60 * 1000;

export interface InactivityState {
  readonly lastActiveAt: number;
  readonly joinedAt: number;
  readonly mainEnteredAt: number;
}

/** All instants are server-supplied epoch milliseconds; lastSeenAt is unrelated. */
export function inactivityEligible(state: InactivityState, now: number): boolean {
  return Math.max(state.lastActiveAt, state.joinedAt, state.mainEnteredAt) + INACTIVITY_MS <= now;
}
