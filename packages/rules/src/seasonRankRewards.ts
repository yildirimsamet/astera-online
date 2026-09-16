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
const PROGRAM_V1: SeasonRankRewardProgram = {
  version: 1,
  minimumDominion: 1,
  tiers: [
    { place: 1, reward: { alloy: 2_000, crystal: 1_500, deuterium: 300 } },
    { place: 2, reward: { alloy: 1_750, crystal: 1_250, deuterium: 250 } },
    { place: 3, reward: { alloy: 1_500, crystal: 1_000, deuterium: 200 } },
    { place: 4, reward: { alloy: 1_250, crystal: 750, deuterium: 150 } },
    { place: 5, reward: { alloy: 1_000, crystal: 500, deuterium: 100 } },
    { place: 6, reward: { alloy: 750, crystal: 250, deuterium: 50 } },
    { place: 7, reward: { alloy: 600, crystal: 175, deuterium: 25 } },
    { place: 8, reward: { alloy: 450, crystal: 150, deuterium: 15 } },
    { place: 9, reward: { alloy: 250, crystal: 75, deuterium: 10 } },
    { place: 10, reward: { alloy: 200, crystal: 50, deuterium: 5 } },
  ],
};

/** Unknown and pre-activation versions are a refusal, never today's fallback. */
export function seasonRankRewardProgram(version: number): SeasonRankRewardProgram | null {
  return version === PROGRAM_V1.version ? PROGRAM_V1 : null;
}
