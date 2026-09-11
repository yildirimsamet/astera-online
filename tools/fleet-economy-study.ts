/** Read-only combat/economic experiment; no production constants are changed. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCombat } from '../packages/rules/src/combat.js';
import { RESEARCH_TECH } from '../packages/rules/src/constants.js';
import { mulberry32 } from '../packages/rules/src/rng.js';
import { HULLS, fleetCount, fleetEntries, hullBulk } from '../packages/rules/src/hulls.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import type { Fleet, HullId } from '../packages/rules/src/types.js';

interface Wallet { alloy: number; crystal: number; deuterium: number }
const resources = ['alloy', 'crystal', 'deuterium'] as const;
const empty = (): Wallet => ({ alloy: 0, crystal: 0, deuterium: 0 });
export function cost(fleet: Fleet): Wallet {
  const total = empty();
  for (const [id, count] of fleetEntries(fleet)) {
    for (const r of resources) total[r] += HULLS[id][r] * count;
  }
  return total;
}

/** Same component wallet AND hangar ceiling; full return fuel reserved on both sides. */
export function affordableFleet(id: HullId, wallet: Wallet, hangar: number): Fleet {
  if ([...resources.map(r => wallet[r]), hangar].some(v => !Number.isFinite(v) || v < 0)) {
    throw new Error('Finite nonnegative wallet and hangar required');
  }
  const h = HULLS[id];
  let n = Math.floor(hangar / hullBulk(id));
  for (const r of resources) if (h[r] > 0) n = Math.min(n, Math.floor(wallet[r] / h[r]));
  while (n > 0 && n * h.deuterium + missionFuel({ [id]: n }, 1250, 2) > wallet.deuterium) n--;
  return n > 0 ? { [id]: n } : {};
}

export function compareFleets(attacker: Fleet, defender: Fleet,
  attackerTech: TechLevels = {}, defenderTech: TechLevels = {}, shield = 0) {
  const meanAttackerLoss = empty();
  const meanDefenderLoss = empty();
  let defenderEliminated = 0;
  let attackerEliminated = 0;
  let favorableExchange = 0;
  const samples = 128;
  const weighted = (w: Wallet) => w.alloy + 3 * w.crystal + 90 * w.deuterium;
  for (let seed = 1; seed <= samples; seed++) {
    const rng = mulberry32(seed);
    const result = resolveCombat(attacker, defender, shield, rng,
      { attacker: { tech: attackerTech }, defender: { tech: defenderTech } });
    if (fleetCount(result.defenderSurvivors) === 0) defenderEliminated++;
    if (fleetCount(result.attackerSurvivors) === 0) attackerEliminated++;
    const a = cost(result.attackerLosses), d = cost(result.defenderLosses);
    if (weighted(d) > weighted(a)) favorableExchange++;
    for (const r of resources) {
      meanAttackerLoss[r] += a[r] / samples;
      meanDefenderLoss[r] += d[r] / samples;
    }
  }
  return { samples, defenderEliminated, attackerEliminated, favorableExchange,
    meanAttackerLoss, meanDefenderLoss };
}

function study() {
  const lower: HullId[] = ['VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL'];
  const upper: HullId[] = ['TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN'];
  const rows = [];
  for (const scale of [1, 4, 16]) {
    const wallet = { alloy: 12000 * scale, crystal: 4500 * scale, deuterium: 700 * scale };
    const hangar = 80 * scale;
    for (const low of lower) for (const high of upper) {
      const a = affordableFleet(low, wallet, hangar), d = affordableFleet(high, wallet, hangar);
      const unlockTech: TechLevels = Object.fromEntries(HULLS[high].requiredResearch.map(r => [r.project, r.level]));
      for (const mode of ['base-isolation', 'upper-unlock-tech', 'upper-max-combat-tech'] as const) {
        const highTech = mode === 'base-isolation' ? {} : mode === 'upper-unlock-tech' ? unlockTech
          : { ...unlockTech, SHIP_POWER: RESEARCH_TECH.weaponMaxLevel, SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel };
        for (const reverse of [false, true]) {
          rows.push({ scale, wallet, hangar, low, high, mode, reverse,
            lowFleet: a, highFleet: d, lowCost: cost(a), highCost: cost(d),
            lowFuel: missionFuel(a, 1250, 2), highFuel: missionFuel(d, 1250, 2),
            result: reverse ? compareFleets(d, a, highTech, {}) : compareFleets(a, d, {}, highTech) });
        }
      }
    }
  }
  const sourceFiles = ['hulls.ts', 'combat.ts', 'constants.ts', 'tech.ts', 'fuel.ts', 'tempo.ts', 'rng.ts'];
  return { version: 1, seeds: 'Production mulberry32, seeds 1..128',
    caveat: 'Equal available wallets, not equal spend. No shield, loot, debris or unlock investment. Trade weighting is one scenario, not economic truth.',
    sourceHashes: Object.fromEntries(sourceFiles.map(f => [f, createHash('sha256')
      .update(readFileSync(new URL(`../packages/rules/src/${f}`, import.meta.url))).digest('hex')])),
    catalog: [...lower, ...upper].map(id => ({ ...HULLS[id], bulk: hullBulk(id),
      fuel1250Return: missionFuel({ [id]: 1 }, 1250, 2), roundtripMinutes: 3000 / HULLS[id].speed + 1 / 6 })), rows };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(study(), null, 2) + '\n');
}
