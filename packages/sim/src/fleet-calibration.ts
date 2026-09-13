/** Seeded, economic-budget fleet audit. Uses live hulls and the live combat resolver; no substitute combat model. */
import {
  ALL_HULLS, COMBAT_HULLS, DEBRIS, HULLS, RESEARCH_TECH, computeLoot, counterMult, fleetCargo, fleetCount, fleetEntries,
  missionFuel, mulberry32, resolveCombat, resourceValue, settleWreck, type Fleet, type HullId, type Resources, type TechLevels,
} from '@astera/rules';

export const economicFleetValue = (fleet: Fleet): number =>
  fleetEntries(fleet).reduce((sum, [id, count]) => sum + count * resourceValue(HULLS[id]), 0);

/** An unused budget stays unused; never grant a hull that the budget cannot buy. */
export function fleetAtEconomicBudget(id: HullId, budget: number): Fleet {
  if (!Number.isFinite(budget) || budget < 0) throw new RangeError('Finite nonnegative budget required');
  const count = Math.floor(budget / resourceValue(HULLS[id]));
  return count > 0 ? { [id]: count } : {};
}

/** Fixed mobile composition, component budgets and both prepaid legs; no conversion or fleet cap. */
export function fleetAtWallet(packet: Fleet, wallet: Resources, distance = 0): Fleet {
  const entries = fleetEntries(packet);
  if (!entries.length || !Number.isFinite(distance) || distance < 0
    || Object.values(wallet).some(n => !Number.isFinite(n) || n < 0)
    || ALL_HULLS.some(id => packet[id] !== undefined
      && (!Number.isSafeInteger(packet[id]) || packet[id] <= 0 || HULLS[id].ground))) {
    throw new RangeError('Positive integer mobile packet and finite nonnegative wallet/distance required');
  }
  const price: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const [id, count] of entries) {
    for (const k of ['alloy', 'crystal', 'deuterium'] as const) price[k] += HULLS[id][k] * count;
  }
  const multiply = (n: number): Fleet => Object.fromEntries(entries.map(([id, count]) => [id, count * n]));
  let upper = Math.min(...(['alloy', 'crystal', 'deuterium'] as const)
    .filter(k => price[k] > 0).map(k => Math.floor(wallet[k] / price[k])));
  let lower = 0;
  while (lower < upper) {
    const middle = lower + Math.ceil((upper - lower) / 2);
    if (price.deuterium * middle + missionFuel(multiply(middle), distance, 2) <= wallet.deuterium) lower = middle;
    else upper = middle - 1;
  }
  return lower > 0 ? multiply(lower) : {};
}

export interface BattleMeasureOptions {
  samples?: number;
  shield?: number;
  attackerTech?: TechLevels;
  defenderTech?: TechLevels;
  raid?: { store: Resources; buffer: Resources; protected: Resources; distance: number };
}

/** Permanent economic loss, not raw-resource Dominion, and never a victory-conditioned zero for a failed raid. */
export function measureFleetBattle(attacker: Fleet, defender: Fleet, options: BattleMeasureOptions = {}) {
  const samples = options.samples ?? 64;
  if (!Number.isInteger(samples) || samples < 1) throw new RangeError('Positive integer samples required');
  const initialA = economicFleetValue(attacker), initialD = economicFleetValue(defender);
  const grades = { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 };
  let victories = 0, mutual = 0, defeated = 0, winningLoss = 0;
  let meanExchange = 0, meanAttackerRetained = 0, meanDefenderRetained = 0, roundsMean = 0;
  let meanShieldBonus = 0, meanShieldLeft = 0;
  const fuel = options.raid ? missionFuel(attacker, options.raid.distance, 2) : 0;
  const meanLoot: Resources | null = options.raid ? { alloy: 0, crystal: 0, deuterium: 0 } : null;
  let meanNet = options.raid ? -resourceValue({ alloy: 0, crystal: 0, deuterium: fuel }) : null;
  for (let seed = 1; seed <= samples; seed++) {
    const result = resolveCombat(attacker, defender, options.shield ?? 0, mulberry32(seed), {
      attacker: { tech: options.attackerTech ?? {} }, defender: { tech: options.defenderTech ?? {} },
    });
    const lossA = economicFleetValue(result.attackerLosses);
    const lossD = Math.max(0, economicFleetValue(result.defenderLosses) - economicFleetValue(result.defenceSalvage));
    const lossShare = initialA > 0 ? lossA / initialA : 0;
    if (options.raid && meanLoot && meanNet !== null) {
      const loot = computeLoot(options.raid.store, options.raid.buffer, options.raid.protected,
        result.grade, fleetCargo(result.attackerSurvivors, options.attackerTech ?? {}));
      const wreck: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
      for (const losses of [result.attackerLosses, result.defenderLosses]) {
        for (const [id, count] of fleetEntries(losses)) if (!HULLS[id].ground) {
          for (const k of ['alloy', 'crystal', 'deuterium'] as const) wreck[k] += HULLS[id][k] * count * DEBRIS.share;
        }
      }
      const salvage = settleWreck(wreck, result.attackerSurvivors).salvage;
      for (const k of ['alloy', 'crystal', 'deuterium'] as const) meanLoot[k] += loot[k] / samples;
      meanNet += (resourceValue(loot) + resourceValue(salvage) - lossA) / samples;
    }
    const aliveA = fleetCount(result.attackerSurvivors) > 0, aliveD = fleetCount(result.defenderSurvivors) > 0;
    if (aliveA && !aliveD && result.grade === 'DECISIVE') { victories++; winningLoss += lossShare; }
    else if (!aliveA && !aliveD) mutual++;
    else if (!aliveA) defeated++;
    grades[result.grade]++;
    meanExchange += (lossD - lossA) / samples;
    meanAttackerRetained += (initialA > 0 ? economicFleetValue(result.attackerSurvivors) / initialA : 0) / samples;
    meanDefenderRetained += (initialD > 0 ? economicFleetValue(result.defenderSurvivors) / initialD : 0) / samples;
    roundsMean += result.rounds.length / samples;
    meanShieldBonus += result.rounds.reduce((sum, round) => sum + round.shieldBreakerDamage, 0) / samples;
    meanShieldLeft += result.shieldLeft / samples;
  }
  return { samples, defended: fleetCount(defender) > 0, grades, victories, mutual, defeated,
    meanWinningLoss: victories > 0 ? winningLoss / victories : null,
    meanExchange, meanAttackerRetained, meanDefenderRetained, roundsMean, meanShieldBonus, meanShieldLeft,
    fuel, meanLoot, meanNet };
}

export const MAX_FLEET_TECH: TechLevels = {
  SHIP_POWER: RESEARCH_TECH.weaponMaxLevel, SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel,
  SHIP_PROPULSION: RESEARCH_TECH.propulsionMaxLevel,
};

export function runFleetCalibration(options: { samples?: number; budgets?: readonly number[] } = {}) {
  const samples = options.samples ?? 64, budgets = options.budgets ?? [240_000, 1_000_000];
  if (!budgets.length || budgets.some((budget) => !Number.isFinite(budget) || budget <= 0)) {
    throw new RangeError('Positive finite calibration budgets required');
  }
  const pairs = [];
  for (const budget of budgets) for (const research of ['NONE', 'MAX'] as const) {
    const tech = research === 'NONE' ? {} : MAX_FLEET_TECH;
    for (const attacker of COMBAT_HULLS) for (const defender of COMBAT_HULLS) {
      const A = fleetAtEconomicBudget(attacker, budget), D = fleetAtEconomicBudget(defender, budget);
      pairs.push({ attacker, defender, budget, research,
        attackerSpend: economicFleetValue(A), defenderSpend: economicFleetValue(D),
        counter: counterMult(HULLS[attacker].cls, HULLS[defender].cls),
        result: measureFleetBattle(A, D, { samples, attackerTech: tech, defenderTech: tech }) });
    }
  }
  const progression = [];
  const budget = Math.max(...budgets);
  for (const profile of ['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT']) {
    const ids = COMBAT_HULLS.filter((id) => HULLS[id].profile === profile)
      .sort((a, b) => HULLS[a].tier! - HULLS[b].tier!);
    for (let i = 1; i < ids.length; i++) {
      const higher = ids[i]!, lower = ids[i - 1]!;
      progression.push({ profile, higher, lower, budget,
        result: measureFleetBattle(fleetAtEconomicBudget(higher, budget), fleetAtEconomicBudget(lower, budget), { samples }) });
    }
  }
  return { samples, budgets, pairs, progression };
}
