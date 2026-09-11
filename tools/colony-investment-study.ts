/** Upper-bound income experiment: a productive site's output reaches the shared wallet without transport or war loss. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capitalRoute, evaluateCalendar, playerWindows, type Action } from './economy-calendar-model.js';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
export function investmentScenario(profile: ActivityProfile, sites: number, marginalShare: number, paybackHours: number,
  researchScale = 1, prepareColony = sites > 0) {
  if (!Number.isInteger(sites) || sites < 0 || sites > 3
    || !Number.isFinite(marginalShare) || marginalShare <= 0
    || !Number.isFinite(paybackHours) || paybackHours <= 0
    || !Number.isFinite(researchScale) || researchScale <= 0
    || (sites > 0 && !prepareColony)) throw new Error('Invalid investment parameters');
  const actions = capitalRoute(1.5, 1, prepareColony).map(a => {
    if (a.id !== 'T3-research' && a.id !== 'T4-research') return a;
    return { ...a, cost: { alloy: Math.ceil(a.cost.alloy * researchScale), crystal: Math.ceil(a.cost.crystal * researchScale),
      deuterium: Math.ceil(a.cost.deuterium * researchScale) } };
  });
  const rate = { alloy: 90, crystal: 40, deuterium: 6 };
  // Fixed reference industry bundle, never a multiplier on future capital/colony output.
  const reference = { ...rate };
  for (let i = 1; i <= 3; i++) {
    const gain = actions.find(a => a.id === `industry-${i}`)!.rateGain!;
    for (const k of keys) reference[k] += gain[k];
  }
  const investments: Action[] = [];
  for (let i = 1; i <= sites; i++) {
    const rateGain = { alloy: reference.alloy * marginalShare, crystal: reference.crystal * marginalShare,
      deuterium: reference.deuterium * marginalShare };
    investments.push({ id: `site-${i}`, queue: 'construction',
      cost: { alloy: Math.ceil(rateGain.alloy * paybackHours), crystal: Math.ceil(rateGain.crystal * paybackHours),
        deuterium: Math.ceil(rateGain.deuterium * paybackHours) },
      minutes: 120, requires: ['colony-ready', ...(i > 1 ? [`site-${i - 1}`] : [])],
      notBefore: (3 + (i - 1) * 3) * 1440, rateGain });
  }
  // Once available, the planned territory investment competes with all later capital purchases.
  const insert = actions.findIndex(a => a.id === 'colony-ready') + 1;
  actions.splice(insert, 0, ...investments);
  return { start: { alloy: 1200, crystal: 400, deuterium: 80 }, rate, worksHours: 12, storageHours: 48,
    end: 14 * 1440, windows: playerWindows(profile, 14), actions };
}

export function summarizeInvestment(s: ReturnType<typeof investmentScenario>, r: ReturnType<typeof evaluateCalendar>) {
  const sites = s.actions.filter(a => a.id.startsWith('site-'));
  const siteSpent = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const a of sites) if (r.started[a.id] !== undefined) for (const k of keys) siteSpent[k] += a.cost[k];
  return { preparationDay: r.completed['colony-ready'] === undefined ? null : r.completed['colony-ready'] / 1440,
    t3Day: r.completed.T3 === undefined ? null : r.completed.T3 / 1440,
    t4Day: r.completed.T4 === undefined ? null : r.completed.T4 / 1440,
    productiveSites: sites.filter(a => r.completed[a.id] !== undefined).length,
    siteCompletionDays: sites.map(a => r.completed[a.id] === undefined ? null : r.completed[a.id] / 1440),
    siteSpent, finalRate: r.rate, produced: r.produced,
    completedIndustry: s.actions.filter(a => a.id.startsWith('industry-') && r.completed[a.id] !== undefined).length,
    maxConservationError: Math.max(...Object.values(r.conservationError).map(Math.abs)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const researchScale of [1, 1.5, 2]) {
    for (const prepareColony of [false, true]) {
      const baseline = investmentScenario(profile, 0, 0.25, 72, researchScale, prepareColony);
      const result = evaluateCalendar(baseline);
      rows.push({ profile, sites: 0, prepareColony, researchScale, marginalShare: 0, paybackHours: 0, scenario: baseline,
        summary: summarizeInvestment(baseline, result), result });
    }
    for (const sites of [1, 2, 3]) for (const marginalShare of [0.1, 0.25, 0.5, 1]) for (const paybackHours of [24, 72, 120]) {
      const scenario = investmentScenario(profile, sites, marginalShare, paybackHours, researchScale);
      const result = evaluateCalendar(scenario);
      rows.push({ profile, sites, prepareColony: true, researchScale, marginalShare, paybackHours, scenario, summary: summarizeInvestment(scenario, result), result });
    }
  }
  const files = ['tools/economy-calendar-model.ts', 'tools/colony-investment-study.ts', 'packages/sim/src/player-calendar.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    caveat: 'Synthetic investment bundles, not live buildings, colonization or final balance. Opportunities at days 3/6/9 are explicit external scenario assumptions, never guaranteed ownership. All investments paid from one wallet. Fixed marginal output, pooled storage/works, no transport, upkeep, combat, territorial loss, added yard or bay capacity. Optimistic output-access scenario; not an upper bound on every possible colony design. No physical ownership distribution simulated.', rows }, null, 2) + '\n');
}
