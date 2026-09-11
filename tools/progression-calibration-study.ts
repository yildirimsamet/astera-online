/** Candidate sensitivity: no recurring income bonus, no free hulls, no extended opening session. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildingCost, buildMinutes } from '../packages/rules/src/index.js';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { progressionScenario } from './fleet-progression-study.js';
import { fleetSession } from './fleet-session-study.js';

export function calibratedScenario(profile: ActivityProfile, openingShips: number, startScale: number, researchScale: number) {
  if (!Number.isInteger(openingShips) || openingShips < 1 || openingShips > 4
    || !Number.isFinite(startScale) || startScale <= 0 || !Number.isFinite(researchScale) || researchScale <= 0) {
    throw new Error('Invalid calibration inputs');
  }
  const s = progressionScenario(profile, 14, true, true);
  s.stock = { alloy: 1500 * startScale, crystal: 400 * startScale, deuterium: 50 * startScale };
  s.packet = { DART: openingShips }; s.packetChoices![3] = { DART: openingShips }; s.desiredFleet.DART = openingShips;
  // Explicit weak starting opportunity; this is target supply, not proof a real map provides one.
  s.targets = s.targets.map((t, i) => i < 4 ? { ...t, fleet: { WARDEN: 1 } } : t);
  s.development = s.development.map(a => a.queue === 'research' ? { ...a,
    cost: { alloy: Math.ceil(a.cost.alloy * researchScale), crystal: Math.ceil(a.cost.crystal * researchScale),
      deuterium: Math.ceil(a.cost.deuterium * researchScale) } } : a);
  return s;
}

const stresses = ['baseline', 'no-targets', 'original-opening-targets', 'hangar-80', 'yard-0',
  'missed-work-checks', 'missed-first-evening', 'half-starting-stock', 'paid-yard-6'] as const;
export function stressedScenario(profile: ActivityProfile, stress: typeof stresses[number]) {
  const s = calibratedScenario(profile, 2, 1, 0.65);
  if (stress === 'no-targets') s.targets = [];
  if (stress === 'original-opening-targets') s.targets = s.targets.map((t, i) => i < 4 ? { ...t, fleet: { WARDEN: 3 } } : t);
  if (stress === 'hangar-80') s.hangar = 80;
  if (stress === 'yard-0') s.yard = 0;
  if (stress === 'missed-work-checks') s.windows = s.windows.filter(w => ![270, 480].includes(w.start % 1440));
  if (stress === 'missed-first-evening') s.windows = s.windows.filter(w => w.start !== 720);
  if (stress === 'half-starting-stock') s.stock = { alloy: s.stock.alloy / 2, crystal: s.stock.crystal / 2, deuterium: s.stock.deuterium / 2 };
  if (stress === 'paid-yard-6') {
    // Live price/time comparator, not a calibrated new construction economy. Core4 throughput assumed.
    s.development.unshift(...[5, 6].map(level => {
      const cost = buildingCost('SHIPYARD', level - 1);
      return { id: `yard-${level}`, queue: 'construction' as const, cost, minutes: buildMinutes(cost, 4, {}),
        requires: [level === 5 ? 'industry-5' : 'yard-5'] };
    }));
    s.infrastructure = { 'yard-5': { yardLevel: 5 }, 'yard-6': { yardLevel: 6 } };
  }
  return s;
}

export function scoreProgression(r: ReturnType<typeof fleetSession>, end = 14 * 1440) {
  const firstT3Day = r.firstBuilt.TEMPEST === undefined ? null : r.firstBuilt.TEMPEST / 1440;
  const firstT4Day = r.firstBuilt.CATACLYSM === undefined ? null : r.firstBuilt.CATACLYSM / 1440;
  const firstRaidResolvedMinute = r.launches.find(l => l.grade !== undefined)?.battleAt ?? null;
  const gradeCounts = { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 };
  for (const l of r.launches) if (l.grade === 'DECISIVE' || l.grade === 'PARTIAL' || l.grade === 'REPELLED') gradeCounts[l.grade]++;
  const lastLaunchDay = r.launches.length ? r.launches[r.launches.length - 1]!.at / 1440 : null;
  return { firstT3Day, firstT4Day, firstRaidResolvedMinute, lastLaunchDay,
    noLaunchTailDays: lastLaunchDay === null ? end / 1440 : end / 1440 - lastLaunchDay,
    remainingTargets: r.targets.filter(t => !t.attempted).length,
    pacingPassed: firstRaidResolvedMinute !== null && firstRaidResolvedMinute <= 60
      && firstT3Day !== null && firstT3Day >= 3 && firstT3Day <= 4
      && firstT4Day !== null && firstT4Day >= 7 && firstT4Day <= 8,
    launches: r.launches.length, gradeCounts,
    maxResourceError: Math.max(...Object.values(r.resourceConservationError).map(Math.abs)),
    maxHullError: Math.max(0, ...Object.values(r.hullConservationError).map(Math.abs)) };
}

export function recoveryScenario(profile: ActivityProfile, day: number) {
  if (!Number.isFinite(day) || day < 0 || day >= 14) throw new Error('Invalid shock day');
  const s = stressedScenario(profile, 'paid-yard-6');
  s.shocks = [{ at: day * 1440, homeLossFraction: 0.5 }];
  return s;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const openingShips of [2, 4])
    for (const startScale of [1, 1.5, 2]) for (const researchScale of [0.65, 0.8, 1]) for (const seed of [1, 7, 42, 99, 1337]) {
    const scenario = calibratedScenario(profile, openingShips, startScale, researchScale); scenario.seed = seed;
    const r = fleetSession(scenario);
    rows.push({ profile, openingShips, startScale, researchScale, seed, score: scoreProgression(r),
      initialStock: scenario.stock, finalStock: r.stock, finalFleet: r.home, firstBuilt: r.firstBuilt,
      developmentCompleted: r.developmentCompleted, launches: r.launches });
  }
  const stressRows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const stress of stresses)
    for (const seed of [1, 7, 42, 99, 1337]) {
      const s = stressedScenario(profile, stress); s.seed = seed;
      const r = fleetSession(s);
      stressRows.push({ profile, stress, seed, score: scoreProgression(r, s.end),
        finalFleet: r.home, finalStock: r.stock, overflow: r.overflow });
    }
  const files = ['tools/costed-world.ts', 'packages/rules/src/research.ts', 'packages/rules/src/tech.ts', 'tools/progression-calibration-study.ts', 'tools/fleet-progression-study.ts', 'tools/fleet-session-study.ts',
    'tools/economy-calendar-model.ts', 'tools/colony-investment-study.ts', 'tools/fleet-economy-next-study.ts',
    'packages/sim/src/player-calendar.ts', 'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts',
    'packages/rules/src/economy.ts', 'packages/rules/src/constants.ts', 'packages/rules/src/travel.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  const recoveryRows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const day of [5.5, 8.5]) for (const seed of [1, 7, 42, 99, 1337]) {
    const s = recoveryScenario(profile, day); s.seed = seed;
    const r = fleetSession(s);
    recoveryRows.push({ profile, day, seed, shocks: r.shocks, score: scoreProgression(r),
      postShockLaunches: r.launches.filter(l => l.at >= day * 1440),
      ledger: { start: s.stock, produced: r.produced, spent: r.spent, stock: r.stock, works: r.works, overflow: r.overflow } });
  }
  process.stdout.write(JSON.stringify({ version: 3, sourceHashes, stressRows, recoveryRows,
    caveat: 'Pacing subset only: actual paid hulls and finite fully-known safe target scenarios. First-T3/T4 means first built hull, not operational mixed fleet. Starting wallet is explicit; no free hulls/recurring production bonus/extra session time. Initial yard4/hangar160 still unpriced. Four weak Warden1 targets are an explicit new opening opportunity assumption. Research scales are relative to the preceding candidate bundle costs. No fog, loot, recurring opponents, defender economy or colonial ownership. Recovery rows apply an exogenous docked-hull loss to the ongoing wallet and development, not a simulated opponent attack; recoveredAt means original inventory counts restored including away hulls, not proven meaningful PvP. Passing three clocks does not certify the economy.', rows }, null, 2) + '\n');
}
