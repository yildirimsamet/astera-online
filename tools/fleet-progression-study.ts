/** First bridge from paid industrial/research bundles to actual hull production; no free milestone fleet. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { playerWindows } from '../packages/sim/src/player-calendar.js';
import { investmentScenario } from './colony-investment-study.js';
import { prototypeRoster } from './fleet-economy-next-study.js';
import { fleetSession, type SessionScenario } from './fleet-session-study.js';

export function progressionScenario(profile: ActivityProfile, days = 14, raids = false, informed = true): SessionScenario {
  const investment = investmentScenario(profile, 0, 0.25, 24, 1.5);
  const development = investment.actions.filter(a => !['opening-fleet', 'T3', 'T4'].includes(a.id))
    .map(a => ({ ...a, requires: a.requires.map(id => id === 'T3' ? 'T3-research' : id) }));
  const roster = prototypeRoster(1.1, 0.52, 0);
  return { initialFleet: {}, desiredFleet: { CATACLYSM: 2, TEMPEST: 4, VIPER: 8, DART: 4 },
    packet: { DART: 4 }, packetChoices: [{ CATACLYSM: 2, TEMPEST: 2 }, { TEMPEST: 2, VIPER: 4 }, { VIPER: 4 }, { DART: 4 }],
    stock: investment.start, rate: investment.rate, hangar: 160, bays: 1, yard: 4,
    end: days * 1440, seed: 42, windows: playerWindows(profile, days), development, roster,
    ...(raids && informed ? { maxExpectedLossFraction: 0.3 } : {}),
    bulk: { DART: 3, WARDEN: 3, VIPER: 5, SENTINEL: 5, TEMPEST: 8, PRAETORIAN: 8, CATACLYSM: 13, CITADEL: 13 },
    hullRequires: { DART: [], VIPER: ['industry-2'], TEMPEST: ['T3-research'], CATACLYSM: ['T4-research'] },
    targets: raids ? Array.from({ length: 12 }, (_, i) => ({ id: `known-${i}`, distance: 1250,
      fleet: i < 4 ? { WARDEN: 3 } : i < 8 ? { SENTINEL: 3 } : { PRAETORIAN: 2 } })) : [] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const profile of ['average', 'low', 'low-once'] as const) for (const days of [14, 30])
    for (const policy of ['no-raids', 'unfiltered', 'informed'] as const) for (const seed of [1, 7, 42, 99, 1337]) {
    const raids = policy !== 'no-raids';
    const scenario = progressionScenario(profile, days, raids, policy === 'informed');
    scenario.seed = seed;
    const result = fleetSession(scenario);
    rows.push({ profile, days, raids, policy, seed, scenario,
      milestones: { researchT3Day: result.developmentCompleted['T3-research'] === undefined ? null : result.developmentCompleted['T3-research'] / 1440,
        firstT3Day: result.firstBuilt.TEMPEST === undefined ? null : result.firstBuilt.TEMPEST / 1440,
        firstT4Day: result.firstBuilt.CATACLYSM === undefined ? null : result.firstBuilt.CATACLYSM / 1440,
        firstRaidDay: result.launches[0]?.at === undefined ? null : result.launches[0].at / 1440,
        firstT3RaidDay: result.launches.find(l => (l.sent.TEMPEST ?? 0) > 0)?.at === undefined ? null
          : result.launches.find(l => (l.sent.TEMPEST ?? 0) > 0)!.at / 1440 }, result });
  }
  const files = ['tools/costed-world.ts', 'packages/rules/src/research.ts', 'packages/rules/src/tech.ts', 'tools/fleet-session-study.ts', 'tools/fleet-progression-study.ts', 'tools/colony-investment-study.ts',
    'tools/economy-calendar-model.ts', 'tools/fleet-economy-next-study.ts', 'packages/sim/src/player-calendar.ts',
    'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/rules/src/economy.ts', 'packages/rules/src/constants.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    caveat: 'Integrated candidate wallet/industry/research/real hull orders/optional finite raids. No free starting hulls. Initial capacity160 and yard4 assumed, not purchased; industry/research are bundles, not all real building gates. Twelve static fully known targets, no loot, replenishment or defender economy. Unfiltered policy is a negative control, not average skill. Informed policy requires >=75% full-victory forecasts and <=30% mean loss over 16 fixed independent forecast seeds; this optimistic full-intel experiment is not actual player skill. Five actual combat seeds, not sampled human behavior. 30 days extends the same route, not a calibrated 30-day season. Milestone completion is not full fleet conversion or proven PvP health.', rows }, null, 2) + '\n');
}
