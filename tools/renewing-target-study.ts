/** Local one-attacker pressure test. Known stationary rivals pay for rebuilding; not a multiplayer season. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Fleet } from '../packages/rules/src/types.js';
import { ABUSE, fleetCount, fleetEntries } from '../packages/rules/src/index.js';
import { playerWindows, type ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { prototypeRoster } from './fleet-economy-next-study.js';
import { fleetSession, sessionScenario, type SessionScenario } from './fleet-session-study.js';

export function renewingScenario(targetCount: number, defenderProfile: ActivityProfile, incomeScale: number, renewing: boolean, batchRebuild = false, minimumRebuildFraction = 0): SessionScenario {
  if (!Number.isInteger(targetCount) || targetCount < 1 || !Number.isFinite(incomeScale) || incomeScale <= 0) throw new Error('Invalid target scenario');
  const s = sessionScenario();
  s.end = 7 * 1440; s.windows = playerWindows('average', 7);
  s.roster = prototypeRoster(1.1, 0.52, 0); s.bulk = { VIPER: 5, SENTINEL: 5 }; s.hangar = 120;
  s.maxExpectedLossFraction = 0.3;
  s.rate = { alloy: 300 * incomeScale, crystal: 120 * incomeScale, deuterium: 20 * incomeScale };
  s.targets = Array.from({ length: targetCount }, (_, i) => ({ id: `rival-${i}`, distance: 1250, fleet: { SENTINEL: 24 },
    ...(renewing ? { economy: { stock: { ...s.stock }, rate: { ...s.rate }, windows: playerWindows(defenderProfile, 7), yard: 4, hangar: 120, batchRebuild, minimumRebuildFraction } } : {}) }));
  return s;
}

export function summarizeRenewing(r: ReturnType<typeof fleetSession>, s: SessionScenario) {
  const worth = (fleet: Fleet) => fleetEntries(fleet).reduce((sum, [h, n]) => {
    const hull = s.roster![h]!;
    return sum + n * (hull.alloy + 3 * hull.crystal + 90 * hull.deuterium);
  }, 0);
  const resolved = r.launches.filter(l => l.grade !== undefined);
  const comparable = resolved.filter(l => worth(l.defenderAtBattle ?? {}) >= 0.5 * worth(l.sent));
  const wins = resolved.filter(l => l.winningLossFraction !== null && l.winningLossFraction !== undefined);
  const countByDay = Array.from({ length: Math.ceil(s.end / 1440) }, (_, day) =>
    r.launches.filter(l => l.at >= day * 1440 && l.at < (day + 1) * 1440).length);
  const maxSameTarget12h = Math.max(0, ...r.launches.map(l => r.launches.filter(other =>
    other.target === l.target && other.at <= l.at && other.at > l.at - ABUSE.bashWindowMinutes).length));
  return { launches: r.launches.length, resolved: resolved.length, countByDay,
    comparableFleetBattles: comparable.length,
    zeroLossWins: wins.filter(l => fleetCount(l.lost ?? {}) === 0).length,
    winningLossMean: wins.length ? wins.reduce((sum, l) => sum + l.winningLossFraction!, 0) / wins.length : null,
    maxSameTarget12h,
    defendersBelowHalf: r.defenders.filter(d => worth(d.fleet) < worth(d.initial) / 2).length,
    collapsedDefenders: r.defenders.filter(d => d.recovery.collapsedAt !== null).length,
    recoveredHalfWithin24h: r.defenders.filter(d => d.recovery.collapsedAt !== null && d.recovery.halfAt !== null
      && d.recovery.halfAt - d.recovery.collapsedAt <= 1440).length,
    maxResourceError: Math.max(...[r, ...r.defenders].flatMap(d => Object.values(d.resourceConservationError).map(Math.abs))),
    maxHullError: Math.max(0, ...[r, ...r.defenders].flatMap(d => Object.values(d.hullConservationError).map(Math.abs))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const targetCount of [1, 3, 6]) for (const defenderProfile of ['average', 'low-once'] as const)
    for (const incomeScale of [1, 3]) for (const policy of ['fixed', 'incremental', 'half-batch', 'full-batch'] as const) for (const seed of [1, 42, 1337]) {
      const renewing = policy !== 'fixed';
      const s = renewingScenario(targetCount, defenderProfile, incomeScale, renewing, policy === 'full-batch', policy === 'half-batch' ? 0.5 : 0); s.seed = seed;
      const r = fleetSession(s);
      rows.push({ targetCount, defenderProfile, incomeScale, renewing, policy, seed, summary: summarizeRenewing(r, s), result: r });
    }
  const files = ['tools/costed-world.ts', 'packages/rules/src/research.ts', 'packages/rules/src/tech.ts', 'tools/renewing-target-study.ts', 'tools/fleet-session-study.ts', 'tools/fleet-economy-study.ts',
    'tools/fleet-economy-next-study.ts', 'tools/economy-calendar-model.ts', 'packages/sim/src/player-calendar.ts',
    'packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/rules/src/economy.ts',
    'packages/rules/src/constants.ts', 'packages/rules/src/fuel.ts', 'packages/rules/src/travel.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    caveat: 'Prepared equal-price T2 fleets and initial wallets, not paid season progression. One attacker with favorable class matchup versus 1/3/6 stationary known defenders; defenders rebuild but do not retaliate or invest. No loot, fog, colony or multi-attacker pressure. Production scale applies equally per commander, not only attacker. Empty dynamic targets are not attacked; partially rebuilt targets may be attacked, exposing suppression. Comparable-fleet diagnostic means defender replacement value >=50% of attacking value, not an approved definition of fun or player skill. Existing personal 3 per 12h bash limit; not a world-wide protection. No claim that 1/3/6 neighbors maps to a 300/500/1000 server.', rows }, null, 2) + '\n');
}
