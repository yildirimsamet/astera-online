import type { ClarityState } from '@astera/rules';

/**
 * HOW FAR A READING CAN BE TRUSTED, AS NUMBERS THE SCREENS DRAW.
 *
 * Two axes, and they never share a mark:
 *   · CLARITY — a telescope reading, telescope minus the target's veil (`clarity`
 *     in the rules). Five bands, drawn as five signal bars.
 *   · AGE — a probe or report fact, which is exact on the minute it lands and
 *     worth less every hour after. Drawn as grain and fade (K11: 1 / 6 / 24 h).
 */

/** Signal bars lit per band, out of five. */
export const CLARITY_BARS: Record<ClarityState, number> = {
  FULL: 5,
  CLEAR: 4,
  INTERMITTENT: 3,
  DEGRADED: 2,
  BLIND: 1,
};

/** The band as a word. Keys, so it follows the language. */
export const CLARITY_WORD = {
  FULL: 'clarity.stateFull',
  CLEAR: 'clarity.stateClear',
  INTERMITTENT: 'clarity.stateIntermittent',
  DEGRADED: 'clarity.stateDegraded',
  BLIND: 'clarity.stateBlind',
} as const satisfies Record<ClarityState, string>;

export type AgeTier = 'fresh' | 'aging' | 'stale' | 'old';

const HOUR = 60;

/** Under an hour clean, to six hours light grain, to a day heavy grain, past that heavy and faded. */
export function ageTier(minutes: number): AgeTier {
  if (minutes < HOUR) return 'fresh';
  if (minutes < 6 * HOUR) return 'aging';
  if (minutes < 24 * HOUR) return 'stale';
  return 'old';
}
