import { ALL_HULLS, type Fleet } from '@astera/rules';
import type { SeasonResourceStats, SeasonStatsSnapshot } from '../db/schema.js';

/** Existing cycles remain version 0; only cycles created by telemetry-aware code promise v1. */
export const CURRENT_SEASON_STATS_VERSION = 1;

export interface SeasonStatsAverages {
  cohortSize: number;
  competition: {
    battles: number;
    attacks: number;
    defences: number;
    damageDealt: number;
    damageTaken: number;
    playerLoot: SeasonResourceStats;
    shipsBuilt: number;
    shipsLost: number;
  };
  economy: {
    produced: SeasonResourceStats;
    productiveSeconds: number;
  };
  exploration: {
    asteroidRuns: number;
    asteroidMined: SeasonResourceStats;
    convoyAttempts: number;
    convoySuccesses: number;
    convoyDelivered: SeasonResourceStats;
  };
}

const emptyResources = (): SeasonResourceStats => ({ alloy: 0, crystal: 0, deuterium: 0 });

export const emptySeasonStats = (): SeasonStatsSnapshot => ({
  version: 1,
  competition: {
    battles: 0,
    attacks: 0,
    defences: 0,
    damageDealt: 0,
    damageTaken: 0,
    playerLoot: emptyResources(),
    shipsBuilt: 0,
    shipsLost: 0,
    shipsBuiltByHull: {},
    shipsLostByHull: {},
  },
  economy: { produced: emptyResources(), productiveSeconds: 0 },
  exploration: {
    asteroidRuns: 0,
    asteroidMined: emptyResources(),
    convoyAttempts: 0,
    convoySuccesses: 0,
    convoyDelivered: emptyResources(),
  },
});

const addResources = (target: SeasonResourceStats, value: SeasonResourceStats): void => {
  target.alloy += value.alloy;
  target.crystal += value.crystal;
  target.deuterium += value.deuterium;
};

const addFleet = (target: Fleet, value: Fleet): void => {
  for (const hull of ALL_HULLS) {
    const count = value[hull] ?? 0;
    if (count > 0) target[hull] = (target[hull] ?? 0) + count;
  }
};

export function sumSeasonStats(values: readonly SeasonStatsSnapshot[]): SeasonStatsSnapshot {
  const total = emptySeasonStats();
  for (const value of values) {
    total.competition.battles += value.competition.battles;
    total.competition.attacks += value.competition.attacks;
    total.competition.defences += value.competition.defences;
    total.competition.damageDealt += value.competition.damageDealt;
    total.competition.damageTaken += value.competition.damageTaken;
    addResources(total.competition.playerLoot, value.competition.playerLoot);
    total.competition.shipsBuilt += value.competition.shipsBuilt;
    total.competition.shipsLost += value.competition.shipsLost;
    addFleet(total.competition.shipsBuiltByHull, value.competition.shipsBuiltByHull);
    addFleet(total.competition.shipsLostByHull, value.competition.shipsLostByHull);
    addResources(total.economy.produced, value.economy.produced);
    total.economy.productiveSeconds += value.economy.productiveSeconds;
    total.exploration.asteroidRuns += value.exploration.asteroidRuns;
    addResources(total.exploration.asteroidMined, value.exploration.asteroidMined);
    total.exploration.convoyAttempts += value.exploration.convoyAttempts;
    total.exploration.convoySuccesses += value.exploration.convoySuccesses;
    addResources(total.exploration.convoyDelivered, value.exploration.convoyDelivered);
  }
  return total;
}

const divideResources = (value: SeasonResourceStats, divisor: number): SeasonResourceStats => ({
  alloy: value.alloy / divisor,
  crystal: value.crystal / divisor,
  deuterium: value.deuterium / divisor,
});

export function averageSeasonStats(
  values: readonly SeasonStatsSnapshot[],
): SeasonStatsAverages | null {
  if (values.length === 0) return null;
  const total = sumSeasonStats(values);
  const divisor = values.length;
  return {
    cohortSize: divisor,
    competition: {
      battles: total.competition.battles / divisor,
      attacks: total.competition.attacks / divisor,
      defences: total.competition.defences / divisor,
      damageDealt: total.competition.damageDealt / divisor,
      damageTaken: total.competition.damageTaken / divisor,
      playerLoot: divideResources(total.competition.playerLoot, divisor),
      shipsBuilt: total.competition.shipsBuilt / divisor,
      shipsLost: total.competition.shipsLost / divisor,
    },
    economy: {
      produced: divideResources(total.economy.produced, divisor),
      productiveSeconds: total.economy.productiveSeconds / divisor,
    },
    exploration: {
      asteroidRuns: total.exploration.asteroidRuns / divisor,
      asteroidMined: divideResources(total.exploration.asteroidMined, divisor),
      convoyAttempts: total.exploration.convoyAttempts / divisor,
      convoySuccesses: total.exploration.convoySuccesses / divisor,
      convoyDelivered: divideResources(total.exploration.convoyDelivered, divisor),
    },
  };
}
