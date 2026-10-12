/**
 * Read-only pirate audit. Run explicitly with:
 * nice -n 10 pnpm exec tsx tools/pirate-profit-audit.ts --run > result.json
 *
 * This is a controlled raid/supply experiment, not a season or live-telemetry model.
 * Uses ruleset 16 HP combat and the server's payout/repair/collector semantics.
 * No database, game settings or existing study is modified.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGAGEMENT_MS, resolveBattle, soloStack } from '../packages/rules/src/combat.js';
import { MULTI_WORLD, PIRATE } from '../packages/rules/src/constants.js';
import { alloyRate, crystalRate, deuteriumRate, hullWorkMinutes } from '../packages/rules/src/economy.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { fleetCargo, fleetCount, fleetEntries, fleetSpeed, combatValue, HULLS } from '../packages/rules/src/hulls.js';
import { shipHpRepairCost, shipHpRepairMinutes, splitForHpLanding } from '../packages/rules/src/hpDamage.js';
import { computeLoot } from '../packages/rules/src/loot.js';
import { pirateHoard, pirateOverrun, pirateRoster, planPirateHour, type PirateLevel } from '../packages/rules/src/pirates.js';
import { currentPirateGeneration, type PirateGeneration } from '../packages/rules/src/pirateGeneration.js';
import { pirateBattleWreck } from '../packages/rules/src/pirateProfit.js';
import { seededFrom } from '../packages/rules/src/rng.js';
import { settleWreck } from '../packages/rules/src/salvage.js';
import { cargoMult, repairPct, type TechLevels } from '../packages/rules/src/tech.js';
import { travelExact } from '../packages/rules/src/travel.js';
import type { Fleet, Grade, HullId, Resources } from '../packages/rules/src/types.js';
import type { HpDamageLots } from '../packages/rules/src/radiationHp.js';
import { resourceValue } from '../packages/rules/src/valuation.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const total = (r: Resources): number => r.alloy + r.crystal + r.deuterium;
const add = (...rs: Resources[]): Resources => {
  const sum = zero();
  for (const r of rs) for (const k of keys) sum[k] += r[k];
  return sum;
};
const scale = (r: Resources, factor: number): Resources => ({ alloy: r.alloy * factor, crystal: r.crystal * factor, deuterium: r.deuterium * factor });
const mean = (xs: number[]): number => xs.reduce((n, x) => n + x, 0) / xs.length;
const quantile = (xs: number[], q: number): number => xs.toSorted((a, b) => a - b)[Math.floor((xs.length - 1) * q)] ?? 0;

/** Enough research to legally build all sampled combat/cargo hulls; no Industrial discount. */
export const AUDIT_TECH: TechLevels = {
  SHIP_POWER: 2, SHIP_ARMOR: 2, SHIP_PROPULSION: 2, STARSHIP_ENGINEERING: 2, CARGO_HOLDS: 2,
};

export function fleetRecipe(fleet: Fleet): Resources {
  for (const n of Object.values<number | undefined>(fleet)) {
    if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new RangeError('bad fleet count');
  }
  const r = zero();
  for (const [id, n] of fleetEntries(fleet)) for (const k of keys) r[k] += HULLS[id][k] * n;
  return r;
}

export function paidRepairCost(fleet: Fleet, damage: HpDamageLots, tech: TechLevels): Resources {
  return shipHpRepairCost(splitForHpLanding(fleet, damage).docked, repairPct(tech));
}

export interface RaidInput {
  attacker: Fleet;
  crew: Fleet;
  level: PirateLevel;
  distance: number;
  seed: readonly (string | number)[];
  tech?: TechLevels;
  /** Original hoard is retained when the server re-fights a partially damaged pirate. */
  hoard?: Resources;
}

export interface RaidOutcome {
  grade: Grade;
  survived: boolean;
  fullLoot: boolean;
  attackerSurvivors: Fleet;
  defenderSurvivors: Fleet;
  attackerLosses: Fleet;
  capital: Resources;
  loot: Resources;
  lossCost: Resources;
  repair: Resources;
  repairMinutes: number;
  replacementMinutes: number;
  fuel: number;
  wreckCreated: Resources;
  npcWreckCreated: Resources;
  salvage: Resources;
  npcSalvage: Resources;
  publicWreck: Resources | null;
  expectedCapture: Resources;
  net: Resources;
  netWithCapture: Resources;
  straightRoundTripMinutes: number;
}

export function auditRaid(input: RaidInput): RaidOutcome {
  if (!Number.isFinite(input.distance) || input.distance < 0) throw new RangeError('bad distance');
  if (![1, 2, 3, 4].includes(input.level)) throw new RangeError('bad pirate level');
  const capital = fleetRecipe(input.attacker);
  const crewRecipe = fleetRecipe(input.crew);
  if (fleetCount(input.crew) === 0) throw new RangeError('pirate is already gone');
  const tech = input.tech ?? AUDIT_TECH;
  const hoard = input.hoard ?? pirateHoard(input.crew);
  if (keys.some(k => !Number.isFinite(hoard[k]) || hoard[k] < 0)) throw new RangeError('bad hoard');
  const result = pirateOverrun(resolveBattle(
    [soloStack(input.attacker, { tech })],
    [{ stackId: 'pirate', playerId: '', fleet: input.crew, tech: { tech: {}, damageMult: PIRATE.damageMult[input.level] } }],
    0, seededFrom(...input.seed), 'HP_PLANET',
  ));
  const survived = fleetCount(result.attackerSurvivors) > 0;
  const rawLoot = survived ? computeLoot(hoard, zero(), zero(), result.grade,
    fleetCargo(result.attackerSurvivors, tech)) : zero();
  const loot = { alloy: rawLoot.alloy, crystal: rawLoot.crystal, deuterium: rawLoot.deuterium };
  const available = computeLoot(hoard, zero(), zero(), result.grade, Number.MAX_SAFE_INTEGER);
  const fullLoot = survived && result.grade !== 'REPELLED' && keys.every(k => loot[k] === available[k]);
  const lossCost = fleetRecipe(result.attackerLosses);
  const docked = splitForHpLanding(result.attackerSurvivors, result.attackerDamage).docked;
  const repair = shipHpRepairCost(docked, repairPct(tech));
  const repairMinutes = shipHpRepairMinutes(docked, 6, tech, repairPct(tech));
  const replacementMinutes = fleetEntries(result.attackerLosses).reduce((n, [id, amount]) => n + hullWorkMinutes(id, amount, 6, tech), 0);
  // All audit hulls fly. For these hulls the server's material-proportional voidWreck
  // is exactly DEBRIS.share times the component replacement costs on both sides.
  const npcWreckCreated = pirateBattleWreck({}, result.defenderLosses);
  const wreckCreated = pirateBattleWreck(result.attackerLosses, result.defenderLosses);
  const settlement = settleWreck(wreckCreated, result.attackerSurvivors);
  const npcSalvage = zero();
  for (const k of keys) npcSalvage[k] = wreckCreated[k] > 0
    ? settlement.salvage[k] * npcWreckCreated[k] / wreckCreated[k] : 0;
  const expectedCapture = survived && result.grade === 'DECISIVE'
    ? scale(crewRecipe, PIRATE.captureChance[input.level] / fleetCount(input.crew)) : zero();
  const fuel = missionFuel(input.attacker, input.distance, 2);
  const net = add(loot, settlement.salvage, scale(lossCost, -1), scale(repair, -1), { alloy: 0, crystal: 0, deuterium: -fuel });
  const outSpeed = fleetSpeed(input.attacker, tech);
  const backSpeed = fleetSpeed(result.attackerSurvivors, tech);
  return {
    grade: result.grade, survived, fullLoot,
    attackerSurvivors: result.attackerSurvivors, defenderSurvivors: result.defenderSurvivors,
    attackerLosses: result.attackerLosses, capital, loot, lossCost, repair, repairMinutes,
    replacementMinutes, fuel, wreckCreated, npcWreckCreated,
    salvage: settlement.salvage, npcSalvage, publicWreck: settlement.field, expectedCapture,
    net, netWithCapture: add(net, expectedCapture),
    straightRoundTripMinutes: outSpeed > 0 ? travelExact(input.distance, outSpeed)
      + (backSpeed > 0 ? travelExact(input.distance, backSpeed) : 0) + ENGAGEMENT_MS / 60_000 : 0,
  };
}

/** Conditional sample of REAL spawn draws, not a different uniform size/roster generator. */
export function sampleCrews(level: PirateLevel, count: number, cohort: 'normal' | 'war-only', generation?: PirateGeneration): Fleet[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('bad sample size');
  return Array.from({ length: count }, (_, index) => {
    const rng = seededFrom('pirate-profit-rosters:v1', cohort, level, index);
    for (let attempt = 0; attempt < 1000; attempt++) {
      const fleet = pirateRoster(level, rng, generation);
      if (cohort === 'normal' || fleetEntries(fleet).every(([id]) => HULLS[id].cls !== 'SUPPORT')) return fleet;
    }
    throw new Error('conditional sampler exhausted');
  });
}

export function supplyProjection(people: number, bots: number, hours: number) {
  if ([people, bots, hours].some(n => !Number.isSafeInteger(n) || n < 0)) throw new RangeError('bad population/hours');
  const eligible = people + Math.floor(bots / 2);
  const lane = planPirateHour({ activePlayers: eligible, hourStartsAtMinute: 0, spawnFromMinute: 0, seasonEndsAtMinute: 60 });
  const perHour = lane?.count ?? 0;
  return { eligible, perHour, total: perHour * hours };
}

const resourcesMean = (results: RaidOutcome[], get: (r: RaidOutcome) => Resources): Resources =>
  scale(add(...results.map(get)), 1 / results.length);

function summarize(results: RaidOutcome[]) {
  const nets = results.map(r => resourceValue(r.net));
  return {
    trials: results.length,
    decisivePct: 100 * mean(results.map(r => Number(r.grade === 'DECISIVE'))),
    partialPct: 100 * mean(results.map(r => Number(r.grade === 'PARTIAL'))),
    fullDecisiveLootPct: 100 * mean(results.map(r => Number(r.grade === 'DECISIVE' && r.fullLoot))),
    noDestroyedShipPct: 100 * mean(results.map(r => Number(fleetCount(r.attackerLosses) === 0))),
    loot: resourcesMean(results, r => r.loot),
    lossCost: resourcesMean(results, r => r.lossCost),
    lostShips: mean(results.map(r => fleetCount(r.attackerLosses))),
    repair: resourcesMean(results, r => r.repair),
    repairMinutes: mean(results.map(r => r.repairMinutes)),
    replacementMinutes: mean(results.map(r => r.replacementMinutes)),
    fuel: mean(results.map(r => r.fuel)),
    salvage: resourcesMean(results, r => r.salvage),
    npcSalvage: resourcesMean(results, r => r.npcSalvage),
    npcWreckCreated: resourcesMean(results, r => r.npcWreckCreated),
    expectedCapture: resourcesMean(results, r => r.expectedCapture),
    net: resourcesMean(results, r => r.net),
    netAE: mean(nets), netWithCaptureAE: mean(results.map(r => resourceValue(r.netWithCapture))),
    netP10AE: quantile(nets, 0.1), netP50AE: quantile(nets, 0.5), netP90AE: quantile(nets, 0.9),
    negativeNetPct: 100 * mean(nets.map(n => Number(n < 0))),
    dispatchedCapital: resourcesMean(results, r => r.capital),
    dispatchedCapitalAE: mean(results.map(r => resourceValue(r.capital))),
    straightRoundTripMinutes: mean(results.map(r => r.straightRoundTripMinutes)),
  };
}

const gunSets: Fleet[] = [
  { CORSAIR: 1 }, { CATACLYSM: 1 }, { PALADIN: 1 }, { CITADEL: 1 },
  { CORSAIR: 1, CATACLYSM: 1, PALADIN: 1 },
];
const factors = [0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 8];
const transports: HullId[] = ['COURIER', 'WAYFARER', 'ATLAS', 'ARGOSY'];
const policies = ['lean', 'profit', 'safe', 'oversized', 'collector'] as const;
type Policy = typeof policies[number];

function withCargo(guns: Fleet, wanted: number, tech = AUDIT_TECH, tier = 4): Fleet {
  const remaining = wanted - fleetCargo(guns, tech);
  if (remaining <= 0) return { ...guns };
  const choices = transports.filter(id => (HULLS[id].tier ?? Infinity) <= tier).map(id => {
    const n = Math.ceil(remaining / (HULLS[id].cargo * cargoMult(tech)));
    const fleet: Fleet = { ...guns, [id]: n };
    return { fleet, cost: resourceValue(fleetRecipe(fleet)) };
  }).sort((a, b) => a.cost - b.cost);
  return choices[0]!.fleet;
}

function candidates(crew: Fleet, hoard = pirateHoard(crew), tier = 4, tech = AUDIT_TECH, balanced = false): Fleet[] {
  const loot = computeLoot(hoard, zero(), zero(), 'DECISIVE', Number.MAX_SAFE_INTEGER);
  const knownPower = combatValue(crew);
  const seen = new Map<string, Fleet>();
  const own = fleetEntries(Object.fromEntries(Object.entries(HULLS).map(([, h]) => [h.id, 1])))
    .filter(([id]) => HULLS[id].tier === tier && HULLS[id].atk > 0 && HULLS[id].profile !== 'SHIELD_BREAKER');
  const balancedSets: Fleet[] = own.map(([id]) => ({ [id]: 1 }));
  balancedSets.push(Object.fromEntries(own), Object.fromEntries(own.filter(([id]) => HULLS[id].profile !== 'FORTRESS')));
  for (const set of balanced ? balancedSets : gunSets) {
    for (const factor of factors) {
      const copies = Math.max(1, Math.ceil(knownPower * factor / combatValue(set)));
      const guns: Fleet = Object.fromEntries(fleetEntries(set).map(([id, n]) => [id, n * copies]));
      const fleet = withCargo(guns, total(loot), tech, tier);
      seen.set(JSON.stringify(fleetEntries(fleet)), fleet);
    }
  }
  return [...seen.values()];
}

function selectFleets(crew: Fleet, level: PirateLevel, tag: string, planningSamples: number,
  generation?: PirateGeneration, tier = 4, tech = AUDIT_TECH): Record<Policy, Fleet> {
  const hoard = pirateHoard(crew, generation);
  const evaluated = candidates(crew, hoard, tier, tech, generation !== undefined).map(fleet => {
    const trials = Array.from({ length: planningSamples }, (_, trial) => auditRaid({
      attacker: fleet, crew, level, hoard, tech, distance: 1000, seed: ['pirate-profit-plan:v1', tag, trial],
    }));
    return { fleet, score: mean(trials.map(r => resourceValue(r.net))),
      capital: resourceValue(fleetRecipe(fleet)), qualified: trials.every(r => r.grade === 'DECISIVE' && r.fullLoot),
      losses: mean(trials.map(r => fleetCount(r.attackerLosses))),
      noLoss: trials.every(r => fleetCount(r.attackerLosses) === 0) };
  });
  const valid = evaluated.filter(c => c.qualified);
  if (valid.length === 0) throw new Error(`No clearing fleet for ${tag}`);
  const lean = valid.toSorted((a, b) => a.capital - b.capital)[0]!;
  const profit = valid.toSorted((a, b) => b.score - a.score)[0]!;
  const safe = valid.filter(c => c.noLoss).toSorted((a, b) => a.capital - b.capital)[0]
    ?? valid.toSorted((a, b) => a.losses - b.losses || a.capital - b.capital)[0]!;
  const oversized = valid.filter(c => combatValue(c.fleet) >= combatValue(crew) * 8)
    .toSorted((a, b) => b.score - a.score)[0];
  if (!oversized) throw new Error(`No oversized clearing fleet for ${tag}`);
  return { lean: lean.fleet, profit: profit.fleet, safe: safe.fleet, oversized: oversized.fleet,
    collector: { ...profit.fleet, GARBAGE_COLLECTOR: 1 } };
}

function cohortStudy(level: PirateLevel, cohort: 'normal' | 'war-only', count: number, planningSamples: number, validationSamples: number,
  generation?: PirateGeneration, tier = 4, tech = AUDIT_TECH) {
  const crews = sampleCrews(level, count, cohort, generation);
  const plans = crews.map((crew, index) => selectFleets(crew, level, `${cohort}:${level}:${index}`, planningSamples, generation, tier, tech));
  const rows = policies.map(policy => {
    const results: RaidOutcome[] = [];
    const perCrewNet: number[] = [];
    for (let index = 0; index < crews.length; index++) {
      const trials = Array.from({ length: validationSamples }, (_, trial) => auditRaid({
        attacker: plans[index]![policy], crew: crews[index]!, level, distance: 1000, tech,
        hoard: pirateHoard(crews[index]!, generation),
        seed: ['pirate-profit-validation:v1', cohort, level, index, trial],
      }));
      results.push(...trials);
      perCrewNet.push(mean(trials.map(r => resourceValue(r.net))));
    }
    const central = mean(perCrewNet);
    const variance = perCrewNet.reduce((n, x) => n + (x - central) ** 2, 0) / Math.max(1, crews.length - 1);
    // Crew-clustered interval: multiple battle rolls on the same crew are not independent samples.
    const margin95AE = 1.96 * Math.sqrt(variance / crews.length);
    return { policy, ...summarize(results), meanNet95AE: [central - margin95AE, central + margin95AE],
      distanceSensitivity: [500, 2500, 4000].map(distance => {
        const extraFuel = mean(plans.map(p => missionFuel(p[policy], distance, 2) - missionFuel(p[policy], 1000, 2)));
        return { distance, fuel: mean(results.map(r => r.fuel)) + extraFuel,
          net: add(resourcesMean(results, r => r.net), { alloy: 0, crystal: 0, deuterium: -extraFuel }),
          netAE: central - extraFuel * 32 };
      }) };
  });
  const purseMean = scale(add(...crews.map(crew => pirateHoard(crew, generation))), 1 / crews.length);
  const capitalMean = scale(add(...crews.map(fleetRecipe)), 1 / crews.length);
  const power = crews.map(combatValue);
  const selectedIndex = power.map((value, index) => ({ index, delta: Math.abs(value - quantile(power, 0.5)) }))
    .sort((a, b) => a.delta - b.delta)[0]!.index;
  const payouts = crews.map(crew => computeLoot(pirateHoard(crew, generation), zero(), zero(), 'DECISIVE', Number.MAX_SAFE_INTEGER));
  return { level, cohort, tech, uniqueDraws: crews.length, planningSamples, validationSamples,
    maxOrePayout: Math.max(...payouts.map(r => r.alloy + r.crystal)), maxDeuteriumPayout: Math.max(...payouts.map(r => r.deuterium)),
    meanPirateShips: mean(crews.map(fleetCount)), meanPirateHoard: purseMean,
    meanPirateRecipe: capitalMean, meanPirateFirepower: mean(power), rows,
    representative: { crew: crews[selectedIndex], fleets: plans[selectedIndex] } };
}

function partialReproduction() {
  const originalCrew: Fleet = { PALADIN: 5 };
  const originalHoard = pirateHoard(originalCrew);
  let living = originalCrew;
  const raids = [3, 1, 1].map((count, step) => {
    const attacker: Fleet = { CORSAIR: count, ARGOSY: 2 };
    const result = auditRaid({ attacker, crew: living, level: 4, distance: 1000,
      hoard: originalHoard, seed: ['partial-repro', step] });
    const before = living;
    living = result.defenderSurvivors;
    return { attacker, before, result };
  });
  return { originalCrew, originalHoard, raids, receipts: add(...raids.map(r => r.result.loot)),
    net: add(...raids.map(r => r.result.net)),
    straightMinutes: raids.reduce((n, r) => n + r.result.straightRoundTripMinutes, 0),
    minimumPirateLifeMinutes: PIRATE.lifeHoursMin * 60,
    directLootRatio: total(add(...raids.map(r => r.result.loot))) / total(originalHoard) };
}

export function runPirateProfitAudit(count = 256, planningSamples = 8, validationSamples = 32) {
  const levels: PirateLevel[] = [1, 2, 3, 4];
  const normal = levels.map(level => {
    process.stderr.write(`Measuring level ${level}: ${count} crews, independent planning/validation rolls\n`);
    return cohortStudy(level, 'normal', count, planningSamples, validationSamples);
  });
  process.stderr.write('Measuring level 4 without transports\n');
  const warOnly = cohortStudy(4, 'war-only', count, planningSamples, validationSamples);
  const weighted = (get: (study: typeof normal[number]) => Resources): Resources =>
    add(...normal.map(study => scale(get(study), PIRATE.levelWeights[study.level]!)));
  const policyMeans = policies.map(policy => ({ policy,
    loot: weighted(s => s.rows.find(r => r.policy === policy)!.loot),
    net: weighted(s => s.rows.find(r => r.policy === policy)!.net),
    npcSalvage: weighted(s => s.rows.find(r => r.policy === policy)!.npcSalvage),
    npcWreckCreated: weighted(s => s.rows.find(r => r.policy === policy)!.npcWreckCreated),
    expectedCapture: weighted(s => s.rows.find(r => r.policy === policy)!.expectedCapture),
  }));
  const supply = [[10, 0], [30, 60], [100, 0], [100, 200]].map(([people, bots]) => {
    const spawn = supplyProjection(people!, bots!, 24);
    return { peoplePerHour: people, activeBotsPerHour: bots, ...spawn,
      level4PerDay: spawn.total * PIRATE.levelWeights[4]!,
      uptake: [0.25, 0.5, 1].map(fraction => ({ attemptedFraction: fraction,
        raidsPerDay: spawn.total * fraction,
        policies: policyMeans.map(p => ({ policy: p.policy,
          lootPerDay: scale(p.loot, spawn.total * fraction),
          netPerDay: scale(p.net, spawn.total * fraction),
          npcSalvagePerDay: scale(p.npcSalvage, spawn.total * fraction),
          npcWreckCreatedPerDay: scale(p.npcWreckCreated, spawn.total * fraction),
          expectedCapturedAssetsPerDay: scale(p.expectedCapture, spawn.total * fraction) })) })) };
  });
  const referenceProduction = [3, 6, 9, 12].map(level => ({ level,
    onePlanetPerDay: { alloy: alloyRate(level) * 24, crystal: crystalRate(level) * 24, deuterium: deuteriumRate(level) * 24 } }));
  const sourceFiles = ['tools/pirate-profit-audit.ts', 'tools/pirate-profit-audit.test.ts',
    'packages/rules/src/constants.ts', 'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts',
    'packages/rules/src/tempo.ts', 'packages/rules/src/economy-profile.ts', 'packages/rules/src/economy.ts',
    'packages/rules/src/pirates.ts', 'packages/rules/src/fuel.ts', 'packages/rules/src/hpDamage.ts',
    'packages/rules/src/loot.ts', 'packages/rules/src/tech.ts', 'packages/rules/src/salvage.ts',
    'packages/rules/src/valuation.ts', 'apps/server/src/services/pirateRaid.ts', 'apps/server/src/services/asteroidSpawn.ts'];
  return {
    version: 1, rulesetVersion: MULTI_WORLD.rulesetVersion, sourceHashes: Object.fromEntries(sourceFiles.map(path =>
      [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
    assumptions: { countPerLevel: count, planningSamples, validationSamples, tech: AUDIT_TECH,
      shipyard: 6, distance: 1000, radiation: 'clear route, no pre-existing damage',
      information: 'identified crew; choose among four T4 pure gun types and a three-class mix',
      forceGrid: factors, collector: 'one collector added to profit fleet, no guaranteed public recovery',
      capital: 'dispatched fleet cost reported separately; research/building capital not amortized',
      validation: 'independent seeds, clustered 95% intervals across pirate crews',
      supply: 'shared galaxy supply, constant smoothed eligible count every hour, all levels weighted',
      caveat: 'No live telemetry, visibility, contention, expiry, progression, hangar/bay saturation, intercept wait or return radiation; supply numbers are scenario potentials, not observed server inflow.' },
    normal, warOnly, weightedPolicyMeans: policyMeans, supply, referenceProduction,
    repeatedPartial: partialReproduction(),
  };
}

export function runBalancedPirateAudit(count = 128, planningSamples = 8, validationSamples = 32) {
  const generation = currentPirateGeneration();
  const levels = ([1, 2, 3, 4] as const).map(level => {
    const tech: TechLevels = level === 4 ? AUDIT_TECH : level === 3
      ? { SHIP_POWER: 2, SHIP_ARMOR: 2, SHIP_PROPULSION: 2, STARSHIP_ENGINEERING: 1, CARGO_HOLDS: 1 }
      : level === 2 ? { SHIP_POWER: 1, SHIP_ARMOR: 1, SHIP_PROPULSION: 1, CARGO_HOLDS: 1 } : {};
    process.stderr.write(`Balanced level ${level}: ${count} armed crews; matching-tier fleet\n`);
    return cohortStudy(level, 'normal', count, planningSamples, validationSamples, generation, level, tech);
  });
  const sources = ['tools/pirate-profit-audit.ts', 'packages/rules/src/constants.ts', 'packages/rules/src/hulls.ts',
    'packages/rules/src/economy-profile.ts', 'packages/rules/src/tempo.ts', 'packages/rules/src/pirates.ts',
    'packages/rules/src/pirateGeneration.ts', 'packages/rules/src/pirateLoot.ts', 'packages/rules/src/pirateProfit.ts',
    'packages/rules/src/combat.ts', 'packages/rules/src/fuel.ts', 'packages/rules/src/hpDamage.ts',
    'packages/rules/src/loot.ts', 'packages/rules/src/damage.ts', 'packages/rules/src/tech.ts',
    'packages/rules/src/salvage.ts', 'packages/rules/src/valuation.ts', 'packages/rules/src/economy.ts',
    'packages/rules/src/radiationHp.ts', 'packages/rules/src/rng.ts', 'packages/rules/src/travel.ts'];
  const sourceHashes = Object.fromEntries(sources.map(path =>
    [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
  return { version: 2, generation, sourceHashes, assumptions: { count, planningSamples, validationSamples,
    distance: 1000, collector: 'not included in profit policy; one separate collector variant',
    margin: 'net = delivered - fuel - replacement - paid repair; capture excluded' }, levels };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!['--run', '--balanced', '--balanced-quick'].includes(process.argv[2] ?? '')) throw new Error('Explicit run mode required for this economy experiment');
  const report = process.argv[2] === '--run' ? runPirateProfitAudit()
    : process.argv[2] === '--balanced-quick' ? runBalancedPirateAudit(32, 4, 8) : runBalancedPirateAudit();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
