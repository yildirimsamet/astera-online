/** Simulation only. Production source, database and deployed services are never mutated. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { HULLS, counterMult } from '../packages/rules/src/hulls.ts';
import { SHIELD_BREAKER } from '../packages/rules/src/constants.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/**
 * Independent Uniform(0,1] weights, normalized per firing ship and redistribution pass.
 * Shares are BASE damage. Target counters are applied once; surplus converts back to
 * base units before redistribution so switching target classes cannot mint damage.
 * The caller applies both volleys together, preserving round-entry firing rights.
 */
export function distributedVolley(from, to, roll, rng, aegis, owners) {
  const hp = to.map(ship => ship.hp), shields = to.map(ship => ship.shield);
  let combat = [], cargo = [];
  for (let i = 0; i < to.length; i++) if (to[i].hp > 0 && !to[i].retreated) {
    (HULLS[to[i].hull].cls === 'SUPPORT' ? cargo : combat).push(i);
  }
  const shooters = from.filter(ship => ship.hp > 0 && !ship.retreated && ship.canFire && ship.attack > 0);
  for (let i = shooters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shooters[i], shooters[j]] = [shooters[j], shooters[i]];
  }
  let incoming = 0, personal = 0, hullDamage = 0, specialistAbsorbed = 0, normalAbsorbed = 0;
  let baseSpent = 0, baseUnused = 0, baseFired = 0;
  const credited = Array.from({ length: owners }, () => 0);
  for (const ship of shooters) {
    if (combat.length === 0 && cargo.length === 0) break;
    let budget = ship.attack * roll;
    baseFired += budget;
    while (budget > 0 && (combat.length > 0 || cargo.length > 0)) {
      const pool = combat.length > 0 ? combat : cargo;
      const weights = pool.map(() => 1 - rng());
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let remainingShare = budget, overflow = 0;
      for (let slot = 0; slot < pool.length; slot++) {
        const index = pool[slot], target = to[index];
        const share = slot === pool.length - 1 ? remainingShare : Math.min(remainingShare, budget * weights[slot] / total);
        remainingShare -= share;
        const multiplier = counterMult(HULLS[ship.hull].cls, HULLS[target.hull].cls);
        let damage = share * multiplier;
        if (ship.hull === 'NULLIFIER') {
          const bonus = Math.min(aegis, damage * SHIELD_BREAKER.bonusShieldDamageMult);
          aegis -= bonus;
          specialistAbsorbed += bonus;
        }
        const absorbed = Math.min(aegis, damage);
        aegis -= absorbed; damage -= absorbed; normalAbsorbed += absorbed;
        const ownAbsorbed = Math.min(shields[index], damage);
        shields[index] -= ownAbsorbed; damage -= ownAbsorbed; personal += ownAbsorbed;
        const landed = Math.min(hp[index], damage);
        hp[index] = Math.max(0, hp[index] - landed);
        credited[ship.owner] += landed;
        hullDamage += landed;
        incoming += absorbed + ownAbsorbed + landed;
        baseSpent += (absorbed + ownAbsorbed + landed) / multiplier;
        if (hp[index] === 0) overflow += Math.max(0, damage - landed) / multiplier;
      }
      if (pool === combat) combat = combat.filter(index => hp[index] > 0);
      else cargo = cargo.filter(index => hp[index] > 0);
      // Every surplus pass kills at least one target; no epsilon discards real damage.
      budget = overflow;
    }
    baseUnused += budget;
  }
  const losses = {};
  for (let i = 0; i < to.length; i++) if (to[i].hp > 0 && hp[i] === 0) {
    losses[to[i].hull] = (losses[to[i].hull] ?? 0) + 1;
  }
  return { hp, shields, incoming, personal, hullDamage, specialistAbsorbed, normalAbsorbed,
    aegis, credited, losses, baseSpent, baseUnused, baseFired };
}

let prepared;
export async function prepareStudyEngine() {
  if (prepared) return prepared;
  prepared = (async () => {
    const dir = resolve(ROOT, 'out/distributed-damage-20261023');
    mkdirSync(dir, { recursive: true });
    const source = readFileSync(resolve(ROOT, 'packages/rules/src/randomBattle.ts'), 'utf8');
    const hash = createHash('sha256').update(source).digest('hex');
    const rewritten = source.replaceAll(/from '\.\/(\w+)\.js'/g, "from '../../packages/rules/src/$1.ts'");
    writeFileSync(resolve(dir, 'baseline.ts'), rewritten);
    const start = rewritten.indexOf('function volley('), end = rewritten.indexOf('\nfunction apply(');
    if (start < 0 || end <= start || rewritten.indexOf('function volley(', start + 1) !== -1) throw new Error('volley anchors changed');
    let candidate = `import { distributedVolley } from '../../tools/distributed-damage-model.mjs';\n` + rewritten.slice(0, start)
      + `function volley(from: readonly Ship[], to: readonly Ship[], roll: number, rng: Rng, aegis: number, owners: number) {\n  return distributedVolley(from, to, roll, rng, aegis, owners);\n}\n`
      + rewritten.slice(end);
    const replaceOnce = (before, after) => {
      if (candidate.split(before).length !== 2) throw new Error(`trace anchor changed: ${before}`);
      candidate = candidate.replace(before, after);
    };
    replaceOnce('  const a = shipsOf(stacks, maintenance)', '  studyTrace.length = 0;\n  const a = shipsOf(stacks, maintenance)');
    replaceOnce('    const beforeA = a.map(ship => ship.retreated), beforeD = d.map(ship => ship.retreated);',
      `    studyTrace.push({ round, attacker: capture(a, policy.attacker), defender: capture(d, policy.defender) });\n    const beforeA = a.map(ship => ship.retreated), beforeD = d.map(ship => ship.retreated);`);
    candidate += `\nexport const studyTrace: unknown[] = [];\nfunction capture(ships: readonly Ship[], policy: RetreatWindow) {\n  const eligibleHp = ships.filter(ship => active(ship) && !HULLS[ship.hull].ground && ship.hp / ship.maxHp <= policy.threshold + 1e-12).map(ship => ship.hp / ship.maxHp);\n  return { eligible: eligibleHp.length, eligibleHp, threshold: policy.threshold, chance: policy.chance };\n}\n`;
    writeFileSync(resolve(dir, 'candidate.ts'), candidate);
    const [baseline, changed] = await Promise.all([
      import(pathToFileURL(resolve(dir, 'baseline.ts')).href),
      import(pathToFileURL(resolve(dir, 'candidate.ts')).href),
    ]);
    return { baseline: baseline.resolveRandomBattle, candidate: changed.resolveRandomBattle, trace: changed.studyTrace, sourceHash: hash };
  })();
  return prepared;
}
