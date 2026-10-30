import { NEUTRAL_OPENING } from '../packages/rules/src/index.js';

/**
 * The staging reconciliation shape: a freshly opened season's neutral worlds, before
 * the first census grows them (`NEUTRAL_OPENING`). The capacity seed opens its
 * galaxies fresh, so this is what a run must find.
 */
export const CAPACITY_NEUTRAL_SHAPE = {
  tier1: NEUTRAL_OPENING.initial[1],
  tier2: NEUTRAL_OPENING.initial[2],
  tier3: NEUTRAL_OPENING.initial[3],
  total:
    NEUTRAL_OPENING.initial[1]
    + NEUTRAL_OPENING.initial[2]
    + NEUTRAL_OPENING.initial[3],
} as const;
