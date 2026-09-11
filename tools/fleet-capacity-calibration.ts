/** Tests whether physical capacity can carry progression without overpowering counters. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HULLS } from '../packages/rules/src/hulls.js';
import type { Fleet, HullId } from '../packages/rules/src/types.js';
import { prototypeRoster, withRoster } from './fleet-economy-next-study.js';
import { battleDistribution } from './fleet-loss-calibration.js';

export function sizeFleet(budget: number, price: number, capacity: number, bulk: number): number {
  if (![budget, price, capacity, bulk].every(Number.isFinite) || budget < 0 || capacity < 0 || price <= 0 || bulk <= 0) {
    throw new Error('Finite budget/capacity and positive price/bulk required');
  }
  return Math.floor(Math.min(budget / price, capacity / bulk));
}
export function composition(ids: readonly HullId[], weights: readonly number[], total: number): Fleet {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (ids.length !== weights.length || !Number.isInteger(total) || total < 0
    || weights.some(w => !Number.isFinite(w) || w < 0) || sum <= 0) throw new Error('Invalid composition');
  const rows = ids.map((id, i) => ({ id, exact: total * weights[i]! / sum, count: Math.floor(total * weights[i]! / sum) }));
  const remaining = total - rows.reduce((n, r) => n + r.count, 0);
  const sorted = [...rows].sort((a, b) => (b.exact - b.count) - (a.exact - a.count));
  for (let i = 0; i < remaining; i++) sorted[i]!.count++;
  return Object.fromEntries(rows.filter(r => r.count > 0).map(r => [r.id, r.count]));
}
const slots: readonly (readonly [HullId, HullId, HullId])[] = [
  ['DART', 'PIKE', 'WARDEN'], ['VIPER', 'TALON', 'SENTINEL'],
  ['TEMPEST', 'BALLISTA', 'PRAETORIAN'], ['ATLAS', 'CATACLYSM', 'CITADEL'],
];
const bulk = [3, 5, 8, 13] as const;
const price = (id: HullId) => HULLS[id].alloy + 3 * HULLS[id].crystal + 90 * HULLS[id].deuterium;
const targetRole = [2, 0, 1] as const;

function run() {
  const candidates = [];
  for (const efficiency of [1.05, 1.1, 1.15, 1.2, 1.35, 1.65]) {
    const roster = prototypeRoster(efficiency, 0.52, 0);
    const cases = withRoster(roster, () => {
      const rows = [];
      for (const [lower, upper] of [[0, 0], [1, 1], [2, 2], [3, 3], [0, 1], [1, 2], [2, 3], [0, 2], [1, 3]]) {
        for (let role = 0; role < 3; role++) for (const upperCount of [3, 12, 48]) {
          for (const roomFactor of [1, 1.25, 1.6, 2.4, 4]) for (const favorable of [true, false]) {
            const a = slots[lower!]![role]!;
            const d = slots[upper!]![favorable ? targetRole[role]! : role]!;
            const budget = upperCount * price(d), capacity = Math.floor(upperCount * bulk[upper!]! * roomFactor);
            const n = sizeFleet(budget, price(a), capacity, bulk[lower!]!);
            rows.push({ lowTier: lower! + 1, highTier: upper! + 1, role, favorable, upperCount,
              roomFactor, capacity, lowCount: n, budget, lowSpend: n * price(a),
              lowLoad: n * bulk[lower!]!, highLoad: upperCount * bulk[upper!]!,
              result: battleDistribution({ [a]: n }, { [d]: upperCount }, 0, {}, {}, 64) });
          }
        }
      }
      return rows;
    });
    const mixed = withRoster(roster, () => {
      const rows = [];
      for (const tier of [1, 2, 3]) for (const target of [[1, 0, 0], [0.8, 0.2, 0], [0.6, 0.2, 0.2], [1, 1, 1]]) {
        for (const size of [12, 48]) for (const budgetRatio of [1, 1.1, 1.2, 1.5]) {
          const defender = composition(slots[tier]!, target, size);
          const strategies = { majorityCounter: [0, 1, 0], mirroredCounters: [target[2]!, target[0]!, target[1]!], balanced: [1, 1, 1] };
          for (const [strategy, weights] of Object.entries(strategies)) {
            const attacker = composition(slots[tier]!, weights, Math.floor(size * budgetRatio));
            rows.push({ tier: tier + 1, target, size, budgetRatio, strategy, attacker, defender,
              actualBudgetRatio: Math.floor(size * budgetRatio) / size,
              result: battleDistribution(attacker, defender, 0, {}, {}, 64) });
          }
        }
      }
      return rows;
    });
    candidates.push({ efficiency, lethality: 0.52, roleSpread: 0, bulk, roster, cases, mixed });
  }
  return candidates;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/rules/src/constants.ts',
    'packages/rules/src/tech.ts', 'packages/rules/src/rng.ts', 'packages/rules/src/tempo.ts',
    'tools/fleet-capacity-calibration.ts', 'tools/fleet-loss-calibration.ts', 'tools/fleet-economy-next-study.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256')
    .update(readFileSync(new URL(`../${f}`, import.meta.url))).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    method: 'Control hulls, equal available A+3C+90D budget; same hangar ceiling derived from upper fleet load times explicit roomFactor. Prototype bulk independent of recipe. No fuel, production, access, shield or tech. Correct-counter and same-class comparisons; unspent money retained. 64 seeds per case. Not a final hangar curve.',
    candidates: run() }, null, 2) + '\n');
}
