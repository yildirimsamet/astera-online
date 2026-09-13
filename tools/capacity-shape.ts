import { MULTI_WORLD } from '../packages/rules/src/index.js';

/** The staging reconciliation shape, derived from the same template that seeds a season. */
export const CAPACITY_NEUTRAL_SHAPE = {
  tier1: MULTI_WORLD.neutralCounts[1],
  tier2: MULTI_WORLD.neutralCounts[2],
  tier3: MULTI_WORLD.neutralCounts[3],
  total:
    MULTI_WORLD.neutralCounts[1]
    + MULTI_WORLD.neutralCounts[2]
    + MULTI_WORLD.neutralCounts[3],
} as const;
