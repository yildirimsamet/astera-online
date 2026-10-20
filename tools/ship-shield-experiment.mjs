/**
 * Experimental personal shields on Astera's existing focused hull-type damage.
 * Healthy solo battles only; no runtime game writes, no OGame target selection.
 * nice -n 10 node --max-old-space-size=4096 --import tsx tools/ship-shield-experiment.mjs --run
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HULLS, COMBAT, counterMult, fleetEntries, fleetCount, fleetValue, hullTech, mulberry32,
} from '../packages/rules/src/index.ts';
import { lossMetrics } from './combat-attrition-audit.mjs';

/** Full personal shield at each call; one partially wounded front ship per hull. */
export function shieldHit(count, hp, wound, damage, personalShield) {
  if (count === 0) return { count: 0, wound: 0 };
  if (personalShield === 0) {
    const effective = damage + wound;
    const killed = Math.min(count, Math.floor(effective / hp));
    return { count: count - killed, wound: killed === count ? 0 : effective - killed * hp };
  }
  let left = Math.max(0, damage - personalShield);
  if (left < hp - wound) return { count, wound: wound + left };
  left -= hp - wound;
  const killed = Math.min(count, 1 + Math.floor(left / (hp + personalShield)));
  if (killed === count) return { count: 0, wound: 0 };
  left -= (killed - 1) * (hp + personalShield);
  return { count: count - killed, wound: Math.max(0, left - personalShield) };
}

const clean = fleet => Object.fromEntries(fleetEntries(fleet));
export function shieldBattle({
  attacker, defender, seed, coefficient = 0, basis = 'HP',
  attackerTech = {}, defenderTech = {}, shield = 0,
}) {
  if (!Number.isFinite(coefficient) || coefficient < 0 || !['HP', 'ATK'].includes(basis)) {
    throw new RangeError('bad experimental shield');
  }
  if (attacker.NULLIFIER || defender.NULLIFIER) throw new Error('Nullifier is outside this experiment');
  const stats = tech => Object.fromEntries([...new Set([...Object.keys(attacker), ...Object.keys(defender)])]
    .map(id => [id, { hp: HULLS[id].hp * hullTech(tech, id).hp, atk: HULLS[id].atk * hullTech(tech, id).atk }]));
  const aStats = stats(attackerTech), dStats = stats(defenderTech);
  const a = { ...attacker }, d = { ...defender }, aWounds = {}, dWounds = {};
  const rng = mulberry32(seed);
  function fire(source, target, sourceStats, targetStats, roll) {
    const covered = fleetEntries(target).some(([id]) => HULLS[id].cls !== 'SUPPORT');
    const targets = fleetEntries(target).filter(([id]) => !covered || HULLS[id].cls !== 'SUPPORT');
    const pool = targets.reduce((sum, [id, n]) => sum + n * targetStats[id].hp, 0);
    const out = {};
    for (const [id, n] of targets) {
      let raw = 0;
      for (const [other, k] of fleetEntries(source)) raw += k * sourceStats[other].atk * counterMult(HULLS[other].cls, HULLS[id].cls);
      out[id] = raw * (n * targetStats[id].hp / pool) * roll;
    }
    return out;
  }
  function apply(fleet, wounds, own, damage, pass) {
    for (const [id, amount] of Object.entries(damage)) {
      const personalShield = HULLS[id].ground ? 0 : coefficient * own[id][basis === 'HP' ? 'hp' : 'atk'];
      const hit = shieldHit(fleet[id] ?? 0, own[id].hp, wounds[id] ?? 0, amount * pass, personalShield);
      fleet[id] = hit.count;
      wounds[id] = hit.wound;
    }
  }
  let rounds = 0, shieldLeft = shield;
  for (let i = 0; i < COMBAT.rounds && fleetCount(a) > 0 && fleetCount(d) > 0; i++) {
    const roll = () => COMBAT.varianceMin + rng() * (COMBAT.varianceMax - COMBAT.varianceMin);
    const toD = fire(a, d, aStats, dStats, roll());
    const toA = fire(d, a, dStats, aStats, roll());
    const incoming = Object.values(toD).reduce((sum, value) => sum + value, 0);
    const absorbed = Math.min(shieldLeft, incoming);
    shieldLeft -= absorbed;
    apply(d, dWounds, dStats, toD, incoming > 0 ? (incoming - absorbed) / incoming : 0);
    apply(a, aWounds, aStats, toA, 1);
    rounds++;
  }
  return { attacker: clean(a), defender: clean(d), attackerWounds: aWounds,
    defenderWounds: dWounds, rounds, shieldLeft };
}

const countArmed = fleet => fleetCount(Object.fromEntries(fleetEntries(fleet)
  .filter(([id]) => HULLS[id].atk > 0 && !HULLS[id].ground)));

export function runShieldExperiment(samples = 32, configs = [
  ...[0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8].map(coefficient => ({ basis: 'HP', coefficient })),
  ...[0.5, 1, 2, 3, 4, 6, 8, 12].map(coefficient => ({ basis: 'ATK', coefficient })),
]) {
  if (!Number.isInteger(samples) || samples < 1 || configs.length === 0
    || configs.some(({ basis, coefficient }) => !['HP', 'ATK'].includes(basis)
      || !Number.isFinite(coefficient) || coefficient < 0)) {
    throw new RangeError('bad experimental sweep');
  }
  const path = new URL('../docs/evidence/combat-attrition-astera-2026-10-20.json', import.meta.url);
  const prior = JSON.parse(readFileSync(path, 'utf8'));
  for (const [name, hash] of Object.entries(prior.hashes)) {
    const current = createHash('sha256').update(readFileSync(new URL(`../packages/rules/src/${name}`, import.meta.url))).digest('hex');
    if (current !== hash) throw new Error(`Source changed since prior audit: ${name}`);
  }
  const cells = [];
  for (const config of configs) {
    for (const [index, input] of prior.cells.entries()) {
      const bounds = input.ratio === 1 ? [0.3, 0.5] : input.ratio === 2 ? [0.2, 0.3]
        : input.ratio === 3 ? [0.05, 0.15] : null;
      const sums = { samples, lowerValue: 0, higherValue: 0, lowerCount: 0, higherCount: 0,
        defenderValue: 0, attackerValue: 0, eitherWiped: 0, bothWiped: 0,
        inBandValue: 0, belowBandValue: 0, aboveBandValue: 0,
        eitherUntouched: 0, defenderLossBelowPartial: 0, woundedSurvivors: 0 };
      for (let seed = 0; seed < samples; seed++) {
        const r = shieldBattle({ ...input, ...config, seed: 0xBEEF0000 + seed });
        const am = lossMetrics(input.attacker, r.attacker).armed;
        const dm = lossMetrics(input.defender, r.defender).armed;
        const low = 1 - Math.max(am.valueLoss, dm.valueLoss);
        sums.lowerValue += low;
        sums.higherValue += 1 - Math.min(am.valueLoss, dm.valueLoss);
        sums.lowerCount += 1 - Math.max(am.countLoss, dm.countLoss);
        sums.higherCount += 1 - Math.min(am.countLoss, dm.countLoss);
        sums.attackerValue += 1 - am.valueLoss;
        sums.defenderValue += 1 - dm.valueLoss;
        sums.eitherWiped += Number(am.wiped || dm.wiped);
        sums.bothWiped += Number(am.wiped && dm.wiped);
        sums.eitherUntouched += Number(am.valueLoss === 0 || dm.valueLoss === 0);
        sums.defenderLossBelowPartial += Number(1 - fleetValue(r.defender) / fleetValue(input.defender) < COMBAT.partialThreshold);
        if (bounds) {
          sums.inBandValue += Number(low >= bounds[0] - 1e-10 && low <= bounds[1] + 1e-10);
          sums.belowBandValue += Number(low < bounds[0] - 1e-10);
          sums.aboveBandValue += Number(low > bounds[1] + 1e-10);
        }
        const wounded = [r.attackerWounds, r.defenderWounds].reduce((sum, wounds) => sum
          + Object.entries(wounds).filter(([id, v]) => v > 0 && !HULLS[id].ground && HULLS[id].atk > 0).length, 0);
        sums.woundedSurvivors += wounded / Math.max(1, countArmed(r.attacker) + countArmed(r.defender));
      }
      cells.push({ inputIndex: index, ...config, totals: sums });
    }
    process.stderr.write(`${config.basis} x${config.coefficient}: ${cells.length * samples} battles\n`);
  }
  return { input: fileURLToPath(path), inputSha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    prototypeSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
    hypotheses: 'Personal shield = coefficient * researched HP or ATK; fresh each round; focused damage preserved. No escape/score/loot processing. Healthy solo only. No Nullifier. Seeds 0xBEEF0000+i. Symmetric rules.',
    samples, battles: cells.length * samples, configs, cells };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--run')) {
  process.stdout.write(JSON.stringify(runShieldExperiment(), null, 2) + '\n');
}
