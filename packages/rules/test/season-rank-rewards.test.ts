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
        { place: 1, reward: { alloy: 1000, crystal: 750, deuterium: 150 } },
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
    });
  });

  it('does not reinterpret pre-activation or unknown versions', () => {
    expect(seasonRankRewardProgram(0)).toBeNull();
    expect(seasonRankRewardProgram(2)).toBeNull();
  });
});
