/** Calibration of the accepted ordinary-victory loss target; never changes game files. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCombat } from '../packages/rules/src/combat.js';
import { fleetCount } from '../packages/rules/src/hulls.js';
import { mulberry32 } from '../packages/rules/src/rng.js';
import type { Fleet, HullId } from '../packages/rules/src/types.js';
import type { TechLevels } from '../packages/rules/src/tech.js';
import { cost } from './fleet-economy-study.js';
import { prototypeRoster, withRoster } from './fleet-economy-next-study.js';

const worth = (f: Fleet) => { const c = cost(f); return c.alloy + 3 * c.crystal + 90 * c.deuterium; };
const slots: readonly (readonly [HullId, HullId, HullId])[] = [
  ['DART', 'PIKE', 'WARDEN'], ['VIPER', 'TALON', 'SENTINEL'],
  ['TEMPEST', 'BALLISTA', 'PRAETORIAN'], ['ATLAS', 'CATACLYSM', 'CITADEL'],
];
// Role order is SKIRMISHER, LANCE, BULWARK; these indices are the existing counter cycle.
const targetRole = [2, 0, 1] as const;

export function battleDistribution(attacker: Fleet, defender: Fleet, shield = 0,
  aTech: TechLevels = {}, dTech: TechLevels = {}, samples = 128) {
  const winningLosses: number[] = [];
  let mutual = 0, defeated = 0, bothSurvive = 0, meanLoss = 0;
  const grades = { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 };
  const initialValue = worth(attacker);
  for (let seed = 1; seed <= samples; seed++) {
    const r = resolveCombat(attacker, defender, shield, mulberry32(seed),
      { attacker: { tech: aTech }, defender: { tech: dTech } });
    const aLive = fleetCount(r.attackerSurvivors) > 0, dLive = fleetCount(r.defenderSurvivors) > 0;
    const loss = initialValue > 0 ? worth(r.attackerLosses) / initialValue : 0;
    meanLoss += loss / samples;
    grades[r.grade]++;
    if (aLive && !dLive) winningLosses.push(loss);
    else if (!aLive && !dLive) mutual++;
    else if (!aLive) defeated++;
    else bothSurvive++;
  }
  winningLosses.sort((a, b) => a - b);
  const p = (fraction: number) => winningLosses.length
    ? winningLosses[Math.max(0, Math.ceil(fraction * winningLosses.length) - 1)]! : null;
  return { samples, victories: winningLosses.length, mutual, defeated, bothSurvive, grades, meanLoss,
    winningMean: winningLosses.length ? winningLosses.reduce((a, b) => a + b, 0) / winningLosses.length : null,
    winningP10: p(0.1), winningP90: p(0.9), winningMax: p(1) };
}

function scan() {
  const candidates = [];
  for (const roleSpread of [0, 0.1, 0.2, 0.4, 1]) for (const lethality of [0.48, 0.5, 0.52, 0.54, 0.56, 0.6]) {
    const cases = withRoster(prototypeRoster(1.65, lethality, roleSpread), () => {
      const rows = [];
      for (let tier = 0; tier < 4; tier++) for (let role = 0; role < 3; role++) {
        for (const size of [3, 12, 48]) {
          const a = slots[tier]![role]!, d = slots[tier]![targetRole[role]!];
          rows.push({ tier: tier + 1, role, size,
            result: battleDistribution({ [a]: size }, { [d]: size }, 0, {}, {}, 64) });
        }
      }
      return rows;
    });
    const reference = cases.filter(r => r.size >= 12);
    const passed = reference.filter(({ result: r }) => r.victories / r.samples >= 0.95
      && r.winningMean !== null && r.winningMean >= 0.15 && r.winningMean <= 0.3).length;
    candidates.push({ roleSpread, lethality, passed, referenceCases: reference.length, cases });
  }
  return candidates;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['packages/rules/src/hulls.ts', 'packages/rules/src/combat.ts', 'packages/rules/src/constants.ts',
    'packages/rules/src/rng.ts', 'packages/rules/src/tech.ts', 'packages/rules/src/tempo.ts',
    'tools/fleet-economy-next-study.ts', 'tools/fleet-economy-study.ts', 'tools/fleet-loss-calibration.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256')
    .update(readFileSync(new URL(`../${f}`, import.meta.url))).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes,
    method: 'Same tier and equal recipe budget, correct counter. No shield/tech/fuel/yard/access. Conditional winning loss, not mean over failed battles. 15-30% owner target; >=95% complete victory is an explicit designer screening threshold, not a user-approved global rule. Sizes 3 are reported but excluded from screening due to integer losses.',
    candidates: scan() }, null, 2) + '\n');
}
