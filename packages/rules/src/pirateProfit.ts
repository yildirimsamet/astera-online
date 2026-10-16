import { resolveBattle, soloStack } from './combat.js';
import { DEBRIS } from './constants.js';
import { capLoadToSurvivors, shipDamageApplies } from './damage.js';
import { ALL_HULLS, HULLS, fleetCargo, fleetCount, fleetEntries } from './hulls.js';
import { shipHpRepairCost } from './hpDamage.js';
import { claimPirateLoot, remainingPirateLoot } from './pirateLoot.js';
import { pirateOverrun, pirateStats, type PirateLevel } from './pirates.js';
import { applyHpDose, hpRadiationApplies, normalizeHpDamage, type HpDamageLots } from './radiationHp.js';
import { seededFrom } from './rng.js';
import { settleWreck } from './salvage.js';
import { repairPct, type TechLevels } from './tech.js';
import type { Fleet, Resources, Rng } from './types.js';
import { resourceValue } from './valuation.js';
import { partitionCombatFleet } from './shipMaintenance.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const total = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

/** Reusable ships are capital; only lost ships are a replacement expense. */
export function fleetProductionCost(fleet: Fleet): Resources {
  const known: ReadonlySet<string> = new Set(ALL_HULLS);
  if (Object.keys(fleet).some(id => !known.has(id))
    || ALL_HULLS.some(id => {
      const n = fleet[id];
      return n !== undefined && (!Number.isSafeInteger(n) || n < 0);
    })) {
    throw new RangeError('bad fleet recipe');
  }
  const cost = zero();
  for (const [id, count] of fleetEntries(fleet)) for (const key of keys) cost[key] += HULLS[id][key] * count;
  return cost;
}

/** The server's void-wreck proportions, including its floating-point operation order. */
export function pirateBattleWreck(attackerLosses: Fleet, defenderLosses: Fleet): Resources {
  const materials = zero();
  for (const fleet of [attackerLosses, defenderLosses]) {
    for (const [id, count] of fleetEntries(fleet)) {
      if (!HULLS[id].ground) for (const key of keys) materials[key] += HULLS[id][key] * count;
    }
  }
  const sum = total(materials);
  if (sum <= 0) return materials;
  const wreck = sum * DEBRIS.share;
  return { alloy: wreck * materials.alloy / sum, crystal: wreck * materials.crystal / sum,
    deuterium: wreck * materials.deuterium / sum };
}

export interface PirateProfitInput {
  attacker: Fleet;
  crew: Fleet;
  level: PirateLevel;
  tech: TechLevels;
  rulesetVersion: number;
  hoard: Resources;
  paid: Resources;
  /** Both legs, from the actual interception quote. */
  fuel: number;
  /** Known route's HP exposure. Return exposure is a preflight estimate. */
  radiation?: { outboundHp: number; returnHp: number };
  damage?: HpDamageLots;
}

/** A hypothetical roll, never the server's private battle seed. */
export function pirateRaidTrial(input: PirateProfitInput, rng: Rng) {
  if (!Number.isFinite(input.fuel) || input.fuel < 0) throw new RangeError('bad quoted fuel');
  fleetProductionCost(input.attacker);
  fleetProductionCost(input.crew);
  remainingPirateLoot(input.hoard, input.paid);
  const hp = hpRadiationApplies(input.rulesetVersion);
  const outbound = hp ? applyHpDose(input.attacker, input.damage, input.radiation?.outboundHp ?? 0, input.tech)
    : { fleet: input.attacker, lots: normalizeHpDamage(input.attacker, input.damage) };
  const sides = { attacker: { tech: input.tech }, defender: { tech: {}, damageMult: pirateStats(input.level).damageMult } };
  const fight = pirateOverrun(resolveBattle([soloStack(outbound.fleet, sides.attacker, outbound.lots)],
    [{ stackId: 'pirate', playerId: '', fleet: input.crew, tech: sides.defender, maintenanceExempt: true }],
    0, rng, hp ? 'HP_PLANET' : 'PLANET', true), partitionCombatFleet(outbound.fleet, outbound.lots).eligible);
  const lived = fleetCount(fight.attackerSurvivors) > 0;
  const available = claimPirateLoot(input.hoard, input.paid, fight.grade, Number.MAX_SAFE_INTEGER);
  const loaded = lived ? claimPirateLoot(input.hoard, input.paid, fight.grade,
    fleetCargo(fight.attackerSurvivors, input.tech)).fromStock : zero();
  const lifted = settleWreck(pirateBattleWreck(fight.attackerLosses, fight.defenderLosses), fight.attackerSurvivors).salvage;
  const back = hp ? applyHpDose(fight.attackerSurvivors, fight.attackerDamage,
    input.radiation?.returnHp ?? 0, input.tech) : { fleet: fight.attackerSurvivors, lots: fight.attackerDamage };
  const cargo = capLoadToSurvivors({ loot: loaded, salvage: lifted }, back.fleet, input.tech);
  const loot = cargo.loot ?? zero();
  const salvage = cargo.salvage ?? zero();
  const losses: Fleet = {};
  for (const [id, count] of fleetEntries(input.attacker)) {
    const lost = count - (back.fleet[id] ?? 0);
    if (lost > 0) losses[id] = lost;
  }
  const lossCost = fleetProductionCost(losses);
  const repair = !shipDamageApplies(input.rulesetVersion) ? zero()
    : shipHpRepairCost(back.lots, repairPct(input.tech));
  const net = zero();
  for (const key of keys) net[key] = loot[key] + salvage[key] - lossCost[key] - repair[key]
    - (key === 'deuterium' ? input.fuel : 0);
  return { grade: fight.grade, returning: back.fleet, loot, salvage,
    lossCost, repair, net, lostShips: fleetCount(losses),
    cargoLimited: lived && total(available) > total(loaded) };
}

export function forecastPirateProfit(input: PirateProfitInput) {
  // Bounded work; stable independent rolls leave battle authority on the server.
  const trials = Array.from({ length: 12 }, (_, index) => pirateRaidTrial(input, seededFrom('pirate-profit-preview:v1', index)));
  const mean = (get: (trial: typeof trials[number]) => Resources): Resources => {
    const out = zero();
    for (const trial of trials) for (const key of keys) out[key] += get(trial)[key];
    for (const key of keys) out[key] /= trials.length;
    return out;
  };
  const band = (percentile: number): Resources => {
    const out = zero();
    for (const key of keys) {
      const sorted = trials.map(trial => trial.net[key]).sort((a, b) => a - b);
      out[key] = sorted[Math.floor((trials.length - 1) * percentile)]!;
    }
    return out;
  };
  const net = mean(trial => trial.net);
  const profitableShare = trials.filter(trial => resourceValue(trial.net) > 0).length / trials.length;
  const balancedReturn = net.alloy + net.crystal >= 0 && net.deuterium >= 0;
  const verdict = profitableShare >= 0.8 && resourceValue(net) > 0 && balancedReturn ? 'PROFIT' as const
    : profitableShare <= 0.25 || resourceValue(net) <= 0 ? 'LOSS' as const : 'RISK' as const;
  return { verdict, net, low: band(0.1), high: band(0.9),
    loot: mean(trial => trial.loot), salvage: mean(trial => trial.salvage),
    lossCost: mean(trial => trial.lossCost), repair: mean(trial => trial.repair), fuel: input.fuel,
    profitableShare, cargoLimitedShare: trials.filter(trial => trial.cargoLimited).length / trials.length,
    lossChance: trials.filter(trial => trial.lostShips > 0).length / trials.length };
}

export type PirateProfitForecast = ReturnType<typeof forecastPirateProfit>;
