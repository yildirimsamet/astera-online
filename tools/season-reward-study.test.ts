import { describe, expect, it } from 'vitest';
import { PLANET_START, rewardPurse } from '../packages/rules/src/index.js';
import {
  CONSERVATIVE_SEASON_REWARDS,
  OWNER_EXAMPLE_REWARD,
  RECOMMENDED_SEASON_REWARDS,
  measureRewardTable,
} from './season-reward-study.js';

describe('next-season rank reward candidates', () => {
  it.each([
    ['recommended', RECOMMENDED_SEASON_REWARDS],
    ['conservative', CONSERVATIVE_SEASON_REWARDS],
  ] as const)('%s has ten strictly decreasing places and never creates an early two-hull gap', (_, table) => {
    const study = measureRewardTable(table);

    expect(table.map((tier) => tier.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(study.strictlyDecreasing).toBe(true);
    expect(study.winner.earlyRoute.extraBuiltHullsAt24Hours).toBeLessThanOrEqual(1);
    expect(study.winner.earlyRoute.extraBuiltHullsAt48Hours).toBeLessThanOrEqual(1);
  });

  it('keeps the recommended winner below one fresh half-day and the whole table below a third of one action purse', () => {
    const study = measureRewardTable(RECOMMENDED_SEASON_REWARDS);

    expect(study.winner.shareOfStartingValue).toBeLessThanOrEqual(0.55);
    expect(study.winner.freshProductionHours).toBeLessThanOrEqual(12);
    expect(study.winner.deuteriumShareOfStartingTank).toBeLessThanOrEqual(0.25);
    expect(study.tableValue / measureRewardTable([{
      place: 1,
      reward: rewardPurse(),
    }]).tableValue).toBeLessThanOrEqual(0.30);
  });

  it('identifies the illustrative 3k/2k/500 grant as an unsafe opening replacement', () => {
    const example = measureRewardTable([{ place: 1, reward: OWNER_EXAMPLE_REWARD }]).winner;

    expect(example.shareOfStartingValue).toBeGreaterThan(5);
    expect(example.freshProductionHours).toBeGreaterThan(40);
    expect(example.deuteriumShareOfStartingTank).toBeGreaterThanOrEqual(10);
    expect(PLANET_START).toEqual({ alloy: 1_500, crystal: 400, deuterium: 50 });
  });
});
