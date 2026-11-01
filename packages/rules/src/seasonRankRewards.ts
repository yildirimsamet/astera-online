import type { Resources } from './types.js';

export interface SeasonRankRewardTier {
  place: number;
  reward: Resources;
}

export interface SeasonRankRewardProgram {
  version: number;
  /** A zero-Dominion join-time tie is attendance, not a competitive result. */
  minimumDominion: number;
  tiers: readonly SeasonRankRewardTier[];
}

export const CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION = 1;

/**
 * Owner-approved cross-season exception, versioned at cycle creation.
 *
 * Bots and system accounts are filtered by the server because account classes
 * are private data. This pure table only states what reward place 1..10 pays and
 * the minimum final Dominion required to enter that reward ordering.
 */
// Owner, 2026-11-01: halve the active schedule, rounding Dominion down before
// doubling for Honor. Sealed entitlements retain their stored resource amounts.
const PROGRAM_V1: SeasonRankRewardProgram = {
  version: 1,
  minimumDominion: 1,
  tiers: [
    { place: 1, reward: { alloy: 1_000, crystal: 750, deuterium: 150 } },
    { place: 2, reward: { alloy: 875, crystal: 625, deuterium: 125 } },
    { place: 3, reward: { alloy: 750, crystal: 500, deuterium: 100 } },
    { place: 4, reward: { alloy: 625, crystal: 375, deuterium: 75 } },
    { place: 5, reward: { alloy: 500, crystal: 250, deuterium: 50 } },
    { place: 6, reward: { alloy: 375, crystal: 125, deuterium: 25 } },
    { place: 7, reward: { alloy: 300, crystal: 87, deuterium: 12 } },
    { place: 8, reward: { alloy: 225, crystal: 75, deuterium: 7 } },
    { place: 9, reward: { alloy: 125, crystal: 37, deuterium: 5 } },
    { place: 10, reward: { alloy: 100, crystal: 25, deuterium: 2 } },
  ],
};

/** Unknown and pre-activation versions are a refusal, never today's fallback. */
export function seasonRankRewardProgram(version: number): SeasonRankRewardProgram | null {
  return version === PROGRAM_V1.version ? PROGRAM_V1 : null;
}
