/** Bounded acceptance evidence for the target-derived candidate; no live economy writes. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_HULLS, RESEARCH_PROJECTS, resolveCombat, mulberry32, fleetCount } from '../packages/rules/src/index.js';
import type { Fleet, HullId } from '../packages/rules/src/types.js';
import { designHull, designEffort, designResearch, designBuilding, designSeason } from './economy-design-model.js';
import { withRoster } from './fleet-economy-next-study.js';
import { cost } from './fleet-economy-study.js';
import { designScenario } from './economy-design-study.js';
import { fleetSession } from './fleet-session-study.js';
import { summarizeCosted } from './costed-progression-study.js';
import { reciprocalEconomy, reciprocalScenario } from './reciprocal-economy-study.js';

const keys = ['alloy', 'crystal', 'deuterium'] as const;
export function designBattleSample(attacker: Fleet, defender: Fleet) {
  const roster = Object.fromEntries(ALL_HULLS.map(h => [h, designHull(h)]));
  return withRoster(roster, () => {
    const initial = cost(attacker), losses: number[] = [];
    const resourceLossShare = { alloy: 0, crystal: 0, deuterium: 0 };
    for (let seed = 1; seed <= 32; seed++) {
      const r = resolveCombat(attacker, defender, 0, mulberry32(seed), { attacker: { tech: {} }, defender: { tech: {} } });
      if (fleetCount(r.attackerSurvivors) && !fleetCount(r.defenderSurvivors)) {
        const bill = cost(r.attackerLosses);
        losses.push(designEffort(bill) / designEffort(initial));
        for (const k of keys) resourceLossShare[k] += initial[k] > 0 ? bill[k] / initial[k] : 0;
      }
    }
    for (const k of keys) resourceLossShare[k] /= Math.max(1, losses.length);
    const meanWinningLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null;
    const defended = fleetCount(defender) > 0;
    return { samples: 32, victories: losses.length, defended, meanWinningLoss, resourceLossShare,
      ordinaryTargetPassed: defended && losses.length >= 31 && meanWinningLoss !== null
        && meanWinningLoss >= 0.15 && meanWinningLoss <= 0.3 };
  });
}

export function designValidation(includeShared = true) {
  const isolated = [];
  for (const days of [14, 30]) for (const profile of ['average', 'low', 'low-once'] as const) {
    const s = designScenario(profile, days); s.fleetBudgetHours = 24;
    const result = fleetSession(s), summary = summarizeCosted(s, result), goal = designSeason(days);
    isolated.push({ days, profile, stress: 'baseline', scenario: s, summary, result,
      pacingPassed: summary.milestones.firstT3Day !== null && summary.milestones.firstT4Day !== null
        && summary.milestones.firstT3Day >= goal.t3Days[0]! && summary.milestones.firstT3Day <= goal.t3Days[1]!
        && summary.milestones.firstT4Day >= goal.t4Days[0]! && summary.milestones.firstT4Day <= goal.t4Days[1]! });
  }
  for (const stress of ['missed-work-checks', 'loss-day12'] as const) {
    const s = designScenario('average', 14); s.fleetBudgetHours = 24;
    if (stress === 'missed-work-checks') s.windows = s.windows.filter(w => ![270, 480].includes(w.start % 1440));
    else s.shocks = [{ at: 12 * 1440, homeLossFraction: 1 }];
    const result = fleetSession(s);
    isolated.push({ days: 14, profile: 'average' as const, stress, scenario: s, summary: summarizeCosted(s, result), result, pacingPassed: false });
  }
  const pairs: [HullId, HullId][] = [['VIPER', 'SENTINEL'], ['TALON', 'VIPER'], ['SENTINEL', 'TALON'],
    ['TEMPEST', 'PRAETORIAN'], ['BALLISTA', 'TEMPEST'], ['PRAETORIAN', 'BALLISTA'], ['CITADEL', 'CATACLYSM']];
  // Fortress hulls have a 25% premium: equal counts would give the attacker free budget advantage.
  const combat = pairs.flatMap(([a, d]) => [4, 12, 24].map(size => {
    const defenderCount = Math.round(size * designHull(a).alloy / designHull(d).alloy);
    return { attacker: { [a]: size }, defender: { [d]: defenderCount },
      result: designBattleSample({ [a]: size }, { [d]: defenderCount }) };
  }));
  const shared = [];
  if (includeShared) for (const contacts of [0, 4]) {
    const s = reciprocalScenario(14, 6, 42); s.contactCount = contacts; s.dispatchShare = 0.5;
    s.players = s.players.map(p => ({ ...p, ...designScenario(p.profile, 14), fleetBudgetHours: 24,
      desiredFleet: { ...designScenario(p.profile, 14).desiredFleet, COURIER: 1 } }));
    shared.push({ scenario: s, result: reciprocalEconomy(s) });
  }
  return { model: 'target-derived-candidate-v1', excluded: ['trade-ship', 'asteroid-shower', 'colony-transfer'],
    isolated, combat, shared,
    hulls: ALL_HULLS.map(designHull),
    research: [14, 30].flatMap(days => Object.values(RESEARCH_PROJECTS).flatMap(p =>
      Array.from({ length: p.maxLevel }, (_, i) => ({ days, id: p.id, level: i + 1, ...designResearch(p.id, i + 1, days) })))),
    buildings: [14, 30].flatMap(days => (['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT'] as const)
      .flatMap(id => Array.from({ length: id === 'SHIPYARD' ? 6 : 20 }, (_, i) =>
        ({ days, id, level: i + 1, ...designBuilding(id, i + 1, days) })))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['tools/economy-design-model.ts', 'tools/economy-design-study.ts', 'tools/economy-design-validation.ts',
    'tools/fleet-session-study.ts', 'tools/reciprocal-economy-study.ts', 'tools/costed-world.ts',
    'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/rules/src/constants.ts',
    'packages/rules/src/tech.ts', 'packages/rules/src/economy.ts', 'packages/sim/src/player-calendar.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  console.log(JSON.stringify({ sourceHashes, ...designValidation() }, null, 2));
}
