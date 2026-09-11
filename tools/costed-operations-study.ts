/** Bounded operational expense study: known stationary opponents, paid probes, no loot or retaliation. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineCandidateScenario, summarizeCosted } from './costed-progression-study.js';
import { fleetSession } from './fleet-session-study.js';
import { playerWindows, type ActivityProfile } from '../packages/sim/src/player-calendar.js';

export function operationsScenario(profile: ActivityProfile, targetCount: number, seed: number, opponent: 'opening' | 'line' = 'opening') {
  if (!Number.isInteger(targetCount) || targetCount < 0 || targetCount > 6) throw new Error('Invalid target count');
  const s = offlineCandidateScenario(profile, 'baseline'); s.seed = seed;
  // Candidate military recipes already carry the agreed unresearched round-trip speeds.
  s.world!.orders['intel:uplink'] = { satellite: 'UPLINK' };
  s.world!.orders['intel:telescope'] = { instrument: 'TELESCOPE', level: 1 };
  s.development.splice(4, 0, ...['intel:uplink', 'intel:telescope'].map(id => ({
    id, queue: 'construction' as const, cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 1, requires: [] })));
  s.intel = { maxAgeMinutes: 60 };
  s.maxExpectedLossFraction = 0.3;
  s.targets = Array.from({ length: targetCount }, (_, i) => ({ id: `local-${i}`, distance: 1250,
    fleet: opponent === 'line' ? { VIPER: 6 } : { DART: 2 }, tech: {}, economy: {
      stock: { alloy: 1500, crystal: 400, deuterium: 50 }, rate: { alloy: 300, crystal: 120, deuterium: 20 },
      windows: playerWindows('average', 14), yard: 2, hangar: 100, batchRebuild: true } }));
  return s;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const count of [0, 1, 3]) {
    const scenario = operationsScenario(profile, count, 42), result = fleetSession(scenario);
    rows.push({ profile, count, scenario, summary: summarizeCosted(scenario, result), result });
  }
  const scenario = operationsScenario('average', 3, 42, 'line'), result = fleetSession(scenario);
  const lineControl = { scenario, summary: summarizeCosted(scenario, result), result };
  const files = ['tools/costed-operations-study.ts', 'tools/costed-progression-study.ts', 'tools/costed-world.ts',
    'tools/fleet-session-study.ts', 'tools/fleet-economy-next-study.ts', 'tools/fleet-economy-study.ts',
    'tools/economy-calendar-model.ts', 'packages/sim/src/player-calendar.ts',
    'packages/rules/src/hulls.ts', 'packages/rules/src/research.ts', 'packages/rules/src/economy.ts',
    'packages/rules/src/constants.ts', 'packages/rules/src/tech.ts', 'packages/rules/src/combat.ts',
    'packages/rules/src/fuel.ts', 'packages/rules/src/travel.ts', 'packages/rules/src/intel.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes, lineControl,
    caveat: 'Nine opening-opponent cases plus one stronger six-Viper control, one combat seed. All attacker infrastructure, military research, Uplink/Telescope, probes, hull replacement and fuel share one wallet. Zero-target control also buys hardware. Defender installed industry and fleet are explicit external fixtures, not a fully priced second player. Defender repeatedly rebuilds its fixed initial composition only; no tier growth, retaliation, shield, tier-band gate or loot. Probe takes an exact known-composition snapshot at arrival, usable only after return and until 60min age; real fuzzy reports/discovery/detection are not modeled. Sensors are purchased development goals, not probe prerequisites or proof of geometric visibility. No propulsion research bought; candidate speeds unchanged. Not a sustainable PvP balance or server-scale acceptance.', rows }, null, 2) + '\n');
}
