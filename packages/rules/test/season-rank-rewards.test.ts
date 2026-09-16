import { describe, expect, it } from 'vitest';
import {
  CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION,
  seasonRankRewardProgram,
} from '../src/index.js';

describe('season rank reward program', () => {
  it('freezes the owner-approved ten-place table behind a version', () => {
    expect(CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION).toBe(1);
    expect(seasonRankRewardProgram(1)).toEqual({
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
    });
  });

  it('does not reinterpret pre-activation or unknown versions', () => {
    expect(seasonRankRewardProgram(0)).toBeNull();
    expect(seasonRankRewardProgram(2)).toBeNull();
  });
});
