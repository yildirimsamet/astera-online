/** Offline experiment only. Temporary catalogue substitutions never leave this process. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_HULLS, HULLS, fleetCargo, fleetCount, fleetEntries , hullBulk } from '../packages/rules/src/hulls.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { alloyRate, crystalRate, deuteriumRate, shieldHp, shipMinutes } from '../packages/rules/src/economy.js';
import { resolveCombat } from '../packages/rules/src/combat.js';
import { computeLoot } from '../packages/rules/src/loot.js';
import { mulberry32 } from '../packages/rules/src/rng.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import type { Fleet, Hull, HullId, Resources } from '../packages/rules/src/types.js';
import { cost } from './fleet-economy-study.js';

/** Ground-excluded bulk of a wing. The Hangar that metered it is gone (D184); the studies still size fleets by it. */
const fleetBulk = (fleet: Record<string, number | undefined>): number =>
  Object.entries(fleet).reduce(
    (sum, [id, n]) => sum + (HULLS[id as keyof typeof HULLS].ground ? 0 : hullBulk(id as never) * (n ?? 0)),
    0,
  );

const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const value = (c: Resources, dWeight = 90) => c.alloy + 3 * c.crystal + dWeight * c.deuterium;
const multiply = (f: Fleet, n: number): Fleet => Object.fromEntries(fleetEntries(f).map(([id, count]) => [id, count * n]));

/** Fixed integer composition, maximum affordable repetitions; not a fleet optimiser. */
export function affordablePacket(packet: Fleet, wallet: Resources, hangar: number): Fleet {
  const entries = fleetEntries(packet);
  const invalidCount = ALL_HULLS.some(id => {
    const n = packet[id];
    return n !== undefined && (!Number.isInteger(n) || n <= 0);
  });
  if (!entries.length || invalidCount
    || [...keys.map(k => wallet[k]), hangar].some(n => !Number.isFinite(n) || n < 0)) {
    throw new Error('Positive integer packet and finite nonnegative wallet required');
  }
  const recipe = cost(packet), bulk = fleetBulk(packet);
  if (bulk <= 0) throw new Error('Mobile packet required');
  let n = Math.floor(hangar / bulk);
  for (const k of keys) if (recipe[k] > 0) n = Math.min(n, Math.floor(wallet[k] / recipe[k]));
  while (n > 0 && recipe.deuterium * n + missionFuel(multiply(packet, n), 1250, 2) > wallet.deuterium) n--;
  return n > 0 ? multiply(packet, n) : {};
}

/** Loss value is replacement expense, excluding loot/debris and already-reserved fuel. */
export function measureBattle(attacker: Fleet, defender: Fleet, shield: number,
  attackerTech: TechLevels = {}, defenderTech: TechLevels = {}, samples = 128, raidStock?: Resources) {
  let attackerVictory = 0, defenderVictory = 0, mutualDestruction = 0, bothSurvive = 0;
  let meanAttackerYardMinutes = 0, meanDefenderYardMinutes = 0;
  let meanAttackerLossFraction = 0, meanDefenderLossFraction = 0;
  let winningAttackerLossFraction = 0;
  const meanAttackerReplacement = zero(), meanDefenderReplacement = zero();
  const grades = { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 };
  const meanLoot = raidStock ? zero() : null, meanNetResources = raidStock ? zero() : null;
  const fuel = raidStock ? missionFuel(attacker, 1250, 2) : 0;
  const attackerInitialValue = value(cost(attacker)), defenderInitialValue = value(cost(defender));
  const yard = (losses: Fleet, tech: TechLevels) => fleetEntries(losses).reduce((sum, [id, n]) =>
    sum + shipMinutes(cost({ [id]: n }), 4, tech), 0);
  for (let seed = 1; seed <= samples; seed++) {
    const result = resolveCombat(attacker, defender, shield, mulberry32(seed),
      { attacker: { tech: attackerTech }, defender: { tech: defenderTech } });
    grades[result.grade]++;
    const aLive = fleetCount(result.attackerSurvivors) > 0, dLive = fleetCount(result.defenderSurvivors) > 0;
    const a = cost(result.attackerLosses), d = cost(result.defenderLosses);
    if (raidStock && meanLoot && meanNetResources) {
      const haul = computeLoot(raidStock, zero(), zero(), result.grade, fleetCargo(result.attackerSurvivors, attackerTech));
      for (const k of keys) {
        meanLoot[k] += haul[k] / samples;
        meanNetResources[k] += (haul[k] - a[k] - (k === 'deuterium' ? fuel : 0)) / samples;
      }
    }
    const aLoss = attackerInitialValue > 0 ? value(a) / attackerInitialValue : 0;
    const dLoss = defenderInitialValue > 0 ? value(d) / defenderInitialValue : 0;
    if (aLive && !dLive) { attackerVictory++; winningAttackerLossFraction += aLoss; }
    else if (!aLive && dLive) defenderVictory++;
    else if (!aLive && !dLive) mutualDestruction++;
    else bothSurvive++;
    meanAttackerLossFraction += aLoss / samples;
    meanDefenderLossFraction += dLoss / samples;
    meanAttackerYardMinutes += yard(result.attackerLosses, attackerTech) / samples;
    meanDefenderYardMinutes += yard(result.defenderLosses, defenderTech) / samples;
    for (const k of keys) { meanAttackerReplacement[k] += a[k] / samples; meanDefenderReplacement[k] += d[k] / samples; }
  }
  return { samples, attackerVictory, defenderVictory, mutualDestruction, bothSurvive,
    grades, meanLoot, meanNetResources,
    meanAttackerReplacement, meanDefenderReplacement, meanAttackerYardMinutes, meanDefenderYardMinutes,
    meanAttackerLossFraction, meanDefenderLossFraction,
    winningAttackerLossFraction: attackerVictory ? winningAttackerLossFraction / attackerVictory : null };
}

/** ATLAS is solely a T4 SKIRMISHER adapter slot in the experiment, not a proposed Atlas change. */
const slots: readonly (readonly [HullId, HullId, HullId])[] = [
  ['DART', 'PIKE', 'WARDEN'], ['VIPER', 'TALON', 'SENTINEL'],
  ['TEMPEST', 'BALLISTA', 'PRAETORIAN'], ['ATLAS', 'CATACLYSM', 'CITADEL'],
];
const classes = ['SKIRMISHER', 'LANCE', 'BULWARK'] as const;
const roles = ['RAIDER', 'STRIKER', 'ESCORT'] as const;
const ratios = [0.8, 1.8, 0.35] as const;
const travelMinutes = [15, 20, 25] as const;

export function prototypeRoster(efficiency: number, lethality = 1, roleSpread = 1): Partial<Record<HullId, Hull>> {
  const roster: Partial<Record<HullId, Hull>> = {};
  slots.forEach((tierSlots, tierIndex) => { tierSlots.forEach((id, roleIndex) => {
    const cls = classes[roleIndex]!, profile = roles[roleIndex]!;
    const budget = 900 * 2.5 ** tierIndex;
    const dShare = [0, 0.15, 0.20, 0.25][tierIndex]!;
    const cShare = tierIndex === 0 ? 0.3 : 0.25;
    const recipe = { alloy: Math.round(budget * (1 - cShare - dShare)),
      crystal: Math.round(budget * cShare / 3), deuterium: Math.round(budget * dShare / 90) };
    const power = 40 * (value(recipe) / 900) * efficiency ** (tierIndex / 2);
    const ratio = Math.sqrt(ratios[roleIndex]! ** roleSpread);
    const tier = tierIndex === 0 ? 1 : tierIndex === 1 ? 2 : tierIndex === 2 ? 3 : 4;
    roster[id] = { ...HULLS[id], ...recipe, tier, cls, profile, family: 'OFFENSIVE', ground: false,
      name: `Prototype T${tier} ${cls}`, atk: Math.max(1, Math.round(power * ratio * lethality)),
      hp: Math.max(1, Math.round(power / ratio / lethality)), cargo: 0,
      speed: 3000 / (travelMinutes[roleIndex]! - 1 / 6), requiredResearch: [] };
  }); });
  return roster;
}

/** Synchronous combat-only scope. Cached production bulk/fuel MUST NOT be used in this scope. */
export function withRoster<T>(roster: Partial<Record<HullId, Hull>>, run: () => T): T {
  const originals: Partial<Record<HullId, Hull>> = {};
  const ids = Object.keys(roster) as HullId[];
  try {
    for (const id of ids) { originals[id] = HULLS[id]; HULLS[id] = roster[id]!; }
    return run();
  } finally {
    for (const id of ids) HULLS[id] = originals[id]!;
  }
}

function currentMixedStudy() {
  const lower: Fleet[] = [{ VIPER: 2, TALON: 1 }, { VIPER: 2, SENTINEL: 1 },
    { TALON: 1, STRONGHOLD: 1 }, { VIPER: 1, TALON: 1, SENTINEL: 1 },
    { VIPER: 2, TALON: 1, WAYFARER: 1 }];
  const upper: Fleet[] = [{ TEMPEST: 2, BALLISTA: 1 }, { TEMPEST: 2, PRAETORIAN: 1 },
    { BALLISTA: 1, LEVIATHAN: 1 }, { TEMPEST: 1, BALLISTA: 1, PRAETORIAN: 1 },
    { TEMPEST: 2, BALLISTA: 1, ATLAS: 1 }];
  const rows = [];
  for (const scale of [1, 4, 16]) for (const dFactor of [0.5, 1, 2]) {
    const wallet = { alloy: 12000 * scale, crystal: 4500 * scale, deuterium: 700 * scale * dFactor };
    for (let low = 0; low < lower.length; low++) for (let high = 0; high < upper.length; high++) {
      const a = affordablePacket(lower[low]!, wallet, 80 * scale);
      const d = affordablePacket(upper[high]!, wallet, 80 * scale);
      if (!fleetCount(a) || !fleetCount(d)) continue;
      for (const shieldLevel of [0, 6, 10]) for (const reverse of [false, true]) {
        const tech = { SHIP_POWER: 2, SHIP_ARMOR: 2 };
        rows.push({ scale, dFactor, low, high, wallet, lowFleet: a, highFleet: d,
          lowCost: cost(a), highCost: cost(d), lowFuel: missionFuel(a, 1250, 2), highFuel: missionFuel(d, 1250, 2),
          shieldLevel, shield: shieldHp(shieldLevel), reverse,
          result: reverse ? measureBattle(d, a, shieldHp(shieldLevel), tech, tech, 128, wallet)
            : measureBattle(a, d, shieldHp(shieldLevel), tech, tech, 128, wallet) });
      }
    }
  }
  return rows;
}

function prototypeStudy() {
  const rows = [];
  for (const efficiency of [1.5, 1.65, 1.8]) for (const lethality of [0.5, 0.75, 1]) {
    const roster = prototypeRoster(efficiency, lethality);
    const experiments = withRoster(roster, () => {
      const results = [];
      for (const [lowTier, highTier] of [[0, 0], [1, 1], [2, 2], [3, 3], [0, 1], [1, 2], [2, 3], [0, 2], [1, 3]]) {
        for (const low of slots[lowTier!]!) for (const high of slots[highTier!]!) {
          for (const upperCount of [3, 12, 48]) {
            const lowCount = Math.floor(upperCount * value(cost({ [high]: 1 })) / value(cost({ [low]: 1 })));
            const a = { [low]: lowCount }, d = { [high]: upperCount };
            const r = measureBattle(a, d, 0, {}, {}, 64);
            results.push({ lowTier: lowTier! + 1, highTier: highTier! + 1,
              lowClass: HULLS[low].cls, highClass: HULLS[high].cls, lowCount, upperCount,
              lowSpend: value(cost(a)), highSpend: value(cost(d)),
              attackerVictory: r.attackerVictory, defenderVictory: r.defenderVictory,
              mutualDestruction: r.mutualDestruction, bothSurvive: r.bothSurvive,
              grades: r.grades,
              meanAttackerLossFraction: r.meanAttackerLossFraction, meanDefenderLossFraction: r.meanDefenderLossFraction,
              winningAttackerLossFraction: r.winningAttackerLossFraction });
          }
        }
      }
      return results;
    });
    rows.push({ efficiency, lethality, roster, experiments });
  }
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['hulls.ts', 'combat.ts', 'economy.ts', 'constants.ts', 'tech.ts', 'fuel.ts', 'tempo.ts', 'rng.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256')
    .update(readFileSync(new URL(`../packages/rules/src/${f}`, import.meta.url))).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    infrastructureExamples: [3, 6, 9, 12].map(level => ({ level,
      hourly: { alloy: alloyRate(level), crystal: crystalRate(level), deuterium: deuteriumRate(level) } })),
    caveats: { current: 'Equal component wallets, five fixed count-ratio packets including a transport packet, both sides Power/Armor 2. Yard 4, one replacement order per lost hull type; stocked materials and empty yard assumed. Separate target stock equals wallet; zero vault floor/buffer, loot uses surviving cargo. Net excludes debris, unlock investment, passive income and further raids.',
      prototype: 'Combat isolation only: equal A+3C+90D budget with integer rounding; no access/yard/fuel/hangar/loot costs. Proposed T4 skirmisher uses ATLAS adapter slot. 64 mulberry32 seeds per case. Never use cached production bulk/fuel with prototype.' },
    current: currentMixedStudy(), prototypes: prototypeStudy() }, null, 2) + '\n');
}
