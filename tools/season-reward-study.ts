#!/usr/bin/env -S pnpm exec tsx
/**
 * Decision study for the bounded next-season rank reward.
 *
 * These tables are candidates, not shipping game rules. The selected table moves
 * into `@astera/rules` only after the product decision gate. Keeping the study
 * separate prevents an unapproved balance proposal from becoming server policy.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLANET_START,
  alloyRate,
  crystalRate,
  fleetCount,
  rewardPurse,
  type Resources,
} from '../packages/rules/src/index.js';
import { calibratedScenario } from './progression-calibration-study.js';
import { fleetSession } from './fleet-session-study.js';

export interface SeasonRewardCandidate {
  place: number;
  reward: Resources;
}

const tier = (
  place: number,
  alloy: number,
  crystal: number,
  deuterium: number,
): SeasonRewardCandidate => ({ place, reward: { alloy, crystal, deuterium } });

export const RECOMMENDED_SEASON_REWARDS = [
  tier(1, 900, 400, 12),
  tier(2, 800, 355, 10),
  tier(3, 700, 310, 9),
  tier(4, 600, 265, 8),
  tier(5, 500, 220, 7),
  tier(6, 425, 190, 6),
  tier(7, 350, 155, 5),
  tier(8, 300, 135, 4),
  tier(9, 250, 110, 3),
  tier(10, 200, 90, 2),
] as const satisfies readonly SeasonRewardCandidate[];

export const CONSERVATIVE_SEASON_REWARDS = [
  tier(1, 600, 265, 8),
  tier(2, 525, 235, 7),
  tier(3, 450, 200, 6),
  tier(4, 375, 165, 5),
  tier(5, 325, 145, 4),
  tier(6, 275, 120, 3),
  tier(7, 225, 100, 3),
  tier(8, 175, 80, 2),
  tier(9, 125, 55, 1),
  tier(10, 100, 45, 1),
] as const satisfies readonly SeasonRewardCandidate[];

/** The user's illustrative amount, retained only as the deliberately unsafe comparator. */
export const OWNER_EXAMPLE_REWARD: Resources = {
  alloy: 3_000,
  crystal: 2_000,
  deuterium: 500,
};

/** D208 parity: 32 Alloy = 16 Crystal = 1 Deuterium. */
export const economicValue = (resources: Resources): number =>
  resources.alloy + 2 * resources.crystal + 32 * resources.deuterium;

const freshOreValuePerHour = alloyRate(1) + 2 * crystalRate(1);

function earlyRouteBuiltHulls(reward: Resources, hours: 24 | 48): number {
  const scenario = calibratedScenario('average', 2, 1, 0.65);
  scenario.end = hours * 60;
  scenario.seasonEnd = 14 * 24 * 60;
  scenario.stock = {
    alloy: scenario.stock.alloy + reward.alloy,
    crystal: scenario.stock.crystal + reward.crystal,
    deuterium: scenario.stock.deuterium + reward.deuterium,
  };
  return fleetCount(fleetSession(scenario).built);
}

const noReward: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const baselineHulls = {
  at24Hours: earlyRouteBuiltHulls(noReward, 24),
  at48Hours: earlyRouteBuiltHulls(noReward, 48),
};

export interface RewardTableStudy {
  tableValue: number;
  strictlyDecreasing: boolean;
  winner: {
    value: number;
    shareOfStartingValue: number;
    /** Alloy/Crystal part expressed as fresh L1 Works production time. */
    freshProductionHours: number;
    deuteriumShareOfStartingTank: number;
    earlyRoute: {
      extraBuiltHullsAt24Hours: number;
      extraBuiltHullsAt48Hours: number;
    };
  };
}

export function measureRewardTable(
  table: readonly SeasonRewardCandidate[],
): RewardTableStudy {
  if (table.length === 0) throw new Error('Reward study needs at least one place');
  for (const [index, candidate] of table.entries()) {
    const amounts = Object.values(candidate.reward);
    if (
      candidate.place !== index + 1
      || amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
    ) throw new Error('Reward study table must use sequential places and non-negative safe integers');
  }

  const values = table.map((candidate) => economicValue(candidate.reward));
  const winner = table[0]!.reward;
  return {
    tableValue: values.reduce((sum, value) => sum + value, 0),
    strictlyDecreasing: values.every((value, index) =>
      index === 0 || values[index - 1]! > value),
    winner: {
      value: values[0]!,
      shareOfStartingValue: values[0]! / economicValue(PLANET_START),
      freshProductionHours: (winner.alloy + 2 * winner.crystal) / freshOreValuePerHour,
      deuteriumShareOfStartingTank: winner.deuterium / PLANET_START.deuterium,
      earlyRoute: {
        extraBuiltHullsAt24Hours:
          earlyRouteBuiltHulls(winner, 24) - baselineHulls.at24Hours,
        extraBuiltHullsAt48Hours:
          earlyRouteBuiltHulls(winner, 48) - baselineHulls.at48Hours,
      },
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const actionPurse = rewardPurse();
  process.stdout.write(`${JSON.stringify({
    assumptions: {
      startingResources: PLANET_START,
      valuation: 'Alloy + 2×Crystal + 32×Deuterium',
      freshOreValuePerHour,
      actionRewardPurse: actionPurse,
      actionRewardPurseValue: economicValue(actionPurse),
      earlyRoute:
        'Same deterministic average-player route and seed; only the starting wallet differs. The route is a bounded sensitivity, not a PvP outcome forecast.',
      reset:
        'The world wallet is wiped each cycle, so a repeat winner receives the same bounded head start again; unused resources do not compound across seasons.',
    },
    recommended: {
      table: RECOMMENDED_SEASON_REWARDS,
      study: measureRewardTable(RECOMMENDED_SEASON_REWARDS),
    },
    conservative: {
      table: CONSERVATIVE_SEASON_REWARDS,
      study: measureRewardTable(CONSERVATIVE_SEASON_REWARDS),
    },
    illustrativeUnsafe: {
      reward: OWNER_EXAMPLE_REWARD,
      study: measureRewardTable([{ place: 1, reward: OWNER_EXAMPLE_REWARD }]),
    },
  }, null, 2)}\n`);
}
