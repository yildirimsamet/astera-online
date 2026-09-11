/** Conditional operation funding stress, not a battle/fleet/target simulation. No speculative loot income. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCalendar, type Action } from './economy-calendar-model.js';
import { investmentScenario, summarizeInvestment } from './colony-investment-study.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
export function operationScenario(sites: number, perSession: number, lossFraction: number) {
  if (!Number.isInteger(perSession) || perSession < 0 || perSession > 3
    || !Number.isFinite(lossFraction) || lossFraction < 0 || lossFraction > 1) throw new Error('Invalid operation budget');
  const s = investmentScenario('average', sites, 0.25, 24, 1.5);
  const reference = investmentScenario('average', 0, 0.25, 24, 1.5);
  const baseline = evaluateCalendar(reference);
  const operations: Action[] = [];
  for (let day = 3; day < 14; day++) {
    const session = s.windows.find(w => Math.floor(w.start / 1440) === day && w.end - w.start >= 90)!;
    // Contemporaneous counterfactual capital rate, not a shrinking budget that hides underfunding.
    const rate = { ...reference.rate };
    for (const a of reference.actions) if (baseline.completed[a.id] !== undefined && baseline.completed[a.id]! <= session.start) {
      for (const k of keys) rate[k] += a.rateGain?.[k] ?? 0;
    }
    for (let i = 0; i < perSession; i++) {
      const start = session.start + 6 + i * 25;
      // F=2 daily income, deployed share=.20; replace conditional loss and prepay a D fuel allowance.
      const factor = 24 * 2 * 0.20 * lossFraction;
      operations.push({ id: `op-${day}-${i}`, queue: 'yard', requires: ['opening-fleet'],
        notBefore: start, expiresAt: Math.min(session.end, start + 25), minutes: 10,
        cost: { alloy: Math.ceil(rate.alloy * factor), crystal: Math.ceil(rate.crystal * factor),
          deuterium: Math.ceil(rate.deuterium * factor) + Math.ceil(rate.deuterium * 24 * 0.015) } });
    }
  }
  // Protect a chance to fund PvP before elective investment; expired chances incur no debt.
  s.actions.unshift(...operations);
  return s;
}

export function measureOperations(s: ReturnType<typeof operationScenario>, r: ReturnType<typeof evaluateCalendar>) {
  const ops = s.actions.filter(a => a.id.startsWith('op-'));
  const paid = ops.filter(a => r.started[a.id] !== undefined);
  const operationSpent = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const a of paid) for (const k of keys) operationSpent[k] += a.cost[k];
  return { ...summarizeInvestment(s, r), offered: ops.length, funded: paid.length, missed: ops.length - paid.length,
    fundedByDay: Array.from({ length: 11 }, (_, i) => ({ day: i + 3,
      funded: paid.filter(a => a.id.startsWith(`op-${i + 3}-`)).length })), operationSpent };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const sites of [0, 1, 3]) for (const perSession of [0, 1, 2, 3]) {
    for (const lossFraction of perSession === 0 ? [0] : [0.15, 0.225, 0.30]) {
      const scenario = operationScenario(sites, perSession, lossFraction);
      const result = evaluateCalendar(scenario);
      rows.push({ sites, perSession, lossFraction, scenario, summary: measureOperations(scenario, result), result });
    }
  }
  const files = ['tools/economy-calendar-model.ts', 'tools/colony-investment-study.ts',
    'tools/pvp-budget-study.ts', 'packages/sim/src/player-calendar.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    caveat: 'Funding stress only. Days 3-13, one long daily session, assumed 25-minute cycle. Conditional victory replacement budget from F=2 reference daily output and deployment=.20. Fuel allowance=1.5% reference daily D per operation, not measured hull fuel. Ten-minute replenishment work is provisional. No physical fleet, battle, target, hangar, flights, defeats, loot or recovery. Funded does not mean launched or won. Missing opportunities expire instead of being billed next day.', rows }, null, 2) + '\n');
}
