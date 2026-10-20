/**
 * Historical pre-personal-shield baseline; explicit opt-out, no season or database access.
 * node --max-old-space-size=4096 --import tsx tools/combat-attrition-audit.mjs --run
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_HULLS, COMBAT, ESCAPE, HULLS, combatValue, fleetCount, fleetEntries,
  fleetValue, mulberry32, resolveRaid, shieldHp, soloStack,
} from '../packages/rules/src/index.ts';

const TECH = { SHIP_POWER: 2, SHIP_ARMOR: 2, STARSHIP_ENGINEERING: 2, SHIP_PROPULSION: 2 };
const HIGH_TECH = { ...TECH, SHIP_POWER: 5, SHIP_ARMOR: 5 };

/** Weights describe ship counts, scaled together to fit the raw build-resource budget. */
export function budgetFleet(weights, budget) {
  if (!Number.isFinite(budget) || budget < 0) throw new RangeError('bad budget');
  const entries = Object.entries(weights);
  if (!entries.length || entries.some(([id, n]) => !HULLS[id] || !Number.isFinite(n) || n <= 0)) {
    throw new RangeError('bad composition');
  }
  const price = fleetValue(weights);
  return Object.fromEntries(entries.map(([id, n]) => [id, Math.floor(n * budget / price)])
    .filter(([, n]) => n > 0));
}

export function lossMetrics(start, survivors) {
  const populations = {
    armed: id => !HULLS[id].ground && HULLS[id].atk > 0,
    mobile: id => !HULLS[id].ground,
    all: () => true,
  };
  return Object.fromEntries(Object.entries(populations).map(([label, accepts]) => {
    const before = Object.fromEntries(fleetEntries(start).filter(([id]) => accepts(id)));
    const after = Object.fromEntries(fleetEntries(survivors).filter(([id]) => accepts(id)));
    const n = fleetCount(before), value = fleetValue(before);
    const countLoss = n ? (n - fleetCount(after)) / n : 0;
    const valueLoss = value ? (value - fleetValue(after)) / value : 0;
    return [label, { countLoss, valueLoss, wiped: n > 0 && fleetCount(after) === 0,
      nearCount: n > 0 && countLoss >= 0.9, nearValue: value > 0 && valueLoss >= 0.9 }];
  }));
}

export function sampleRaid({
  attacker, defender, seed, shield = 0, attackerTech = TECH, defenderTech = TECH,
}) {
  const { result, escape } = resolveRaid({
    stacks: [soloStack(attacker, { tech: attackerTech, shipShields: false })], line: defender,
    shield, rng: () => mulberry32(seed), defender: { tech: defenderTech, shipShields: false },
    deuterium: 1_000_000_000, escape: true, minimumCombatShips: ESCAPE.minimumCombatShips,
    maintenance: true, preciseDamage: true,
  });
  const survived = { ...result.defenderSurvivors };
  if (escape?.kind === 'ESCAPED') {
    for (const [id, n] of fleetEntries(escape.ships)) survived[id] = (survived[id] ?? 0) + n;
  }
  return { a: lossMetrics(attacker, result.attackerSurvivors), d: lossMetrics(defender, survived),
    grade: result.grade, rounds: result.rounds.length, escape: escape?.kind ?? null };
}

function roster(tier) {
  const hull = profile => {
    const found = ALL_HULLS.find(id => HULLS[id].tier === tier && HULLS[id].profile === profile);
    if (!found) throw new Error(`Missing ${tier} ${profile}`);
    return found;
  };
  const r = hull('RAIDER'), s = hull('STRIKER'), f = hull('FORTRESS'), e = hull('ESCORT');
  return [
    { name: 'RAIDER', mix: { [r]: 1 } }, { name: 'STRIKER', mix: { [s]: 1 } },
    { name: 'FORTRESS', mix: { [f]: 1 } }, { name: 'ESCORT', mix: { [e]: 1 } },
    { name: 'MIX_RSF', mix: { [r]: 1, [s]: 1, [f]: 1 } },
    { name: 'MIX_RRSE', mix: { [r]: 2, [s]: 1, [e]: 1 } },
  ];
}

function measure(input, samples) {
  const totals = { samples, eitherWiped: 0, bothWiped: 0, attackerWiped: 0, defenderWiped: 0,
    eitherNearCount: 0, eitherNearValue: 0, defenderNearCount: 0, defenderNearValue: 0,
    mobileEitherWiped: 0, mobileEitherNearCount: 0,
    attackerLossCount: 0, defenderLossCount: 0, attackerLossValue: 0, defenderLossValue: 0,
    escaped: 0, rounds: 0 };
  for (let seed = 0; seed < samples; seed++) {
    const result = sampleRaid({ ...input, seed: 0xA57E0000 + seed });
    const a = result.a.armed, d = result.d.armed;
    totals.eitherWiped += Number(a.wiped || d.wiped);
    totals.bothWiped += Number(a.wiped && d.wiped);
    totals.attackerWiped += Number(a.wiped);
    totals.defenderWiped += Number(d.wiped);
    totals.eitherNearCount += Number(a.nearCount || d.nearCount);
    totals.eitherNearValue += Number(a.nearValue || d.nearValue);
    totals.defenderNearCount += Number(d.nearCount);
    totals.defenderNearValue += Number(d.nearValue);
    totals.mobileEitherWiped += Number(result.a.mobile.wiped || result.d.mobile.wiped);
    totals.mobileEitherNearCount += Number(result.a.mobile.nearCount || result.d.mobile.nearCount);
    totals.attackerLossCount += a.countLoss;
    totals.defenderLossCount += d.countLoss;
    totals.attackerLossValue += a.valueLoss;
    totals.defenderLossValue += d.valueLoss;
    totals.escaped += Number(result.escape === 'ESCAPED');
    totals.rounds += result.rounds;
  }
  return totals;
}

export function runAudit(samples = 100) {
  if (!Number.isSafeInteger(samples) || samples < 1) throw new RangeError('bad sample count');
  const cells = [];
  const controls = ['BASE', 'SHIELD_6', 'SHIELD_10', 'ATTACKER_TECH_5', 'DEFENDER_TECH_5',
    'CARGO', 'GROUND_25'];
  for (const tier of [1, 2, 3, 4]) {
    for (const control of controls) {
      if (control !== 'BASE' && tier < 3) continue;
      const options = roster(tier);
      for (const a of options) for (const d of options) {
        // Controls span both mixed formations and all their pairings; BASE spans all 36.
        if (control !== 'BASE' && (!a.name.startsWith('MIX') || !d.name.startsWith('MIX'))) continue;
        for (const budget of [240_000, 1_000_000]) for (const ratio of [1, 1.5, 2, 3]) {
          let defender = budgetFleet(d.mix, budget);
          if (control === 'GROUND_25') {
            defender = { ...defender, ...budgetFleet({ THORN: 1, HARPOON: 1, BASTION: 1 }, budget / 4) };
          }
          let attacker = budgetFleet(a.mix, combatValue(defender) * ratio);
          if (control === 'CARGO') {
            const transport = ALL_HULLS.find(id => HULLS[id].tier === tier && HULLS[id].profile === 'TRANSPORT');
            if (!transport) throw new Error('missing transport');
            attacker = { ...attacker, [transport]: Math.ceil(fleetCount(attacker) / 10) };
            defender = { ...defender, [transport]: Math.ceil(fleetCount(defender) / 10) };
          }
          const shield = shieldHp(control === 'SHIELD_6' ? 6 : control === 'SHIELD_10' ? 10 : 0);
          const attackerTech = control === 'ATTACKER_TECH_5' ? HIGH_TECH : TECH;
          const defenderTech = control === 'DEFENDER_TECH_5' ? HIGH_TECH : TECH;
          cells.push({ tier, control, a: a.name, d: d.name, budget, ratio,
            actualRatio: combatValue(attacker) / combatValue(defender), attacker, defender, shield,
            attackerTech, defenderTech,
            totals: measure({ attacker, defender, shield, attackerTech, defenderTech }, samples) });
        }
      }
    }
    // Exact mirrored fleets isolate size advantage from rounding and composition.
    for (const formation of roster(tier)) for (const ratio of [1, 1.5, 2, 3]) {
      const defender = Object.fromEntries(Object.entries(formation.mix).map(([id, n]) => [id, n * 100]));
      const attacker = Object.fromEntries(Object.entries(defender).map(([id, n]) => [id, n * ratio]));
      cells.push({ tier, control: 'EXACT_MIRROR', a: formation.name, d: formation.name,
        budget: combatValue(defender), ratio, actualRatio: combatValue(attacker) / combatValue(defender),
        attacker, defender, shield: 0, attackerTech: TECH, defenderTech: TECH,
        totals: measure({ attacker, defender }, samples) });
    }
    process.stderr.write(`Astera T${tier} completed: ${cells.length * samples} battles\n`);
  }
  const sources = ['combat.ts', 'escape.ts', 'hulls.ts', 'constants.ts', 'economy-profile.ts',
    'tech.ts', 'shipMaintenance.ts', 'tempo.ts'];
  const hashes = Object.fromEntries(sources.map(name => [name, createHash('sha256')
    .update(readFileSync(new URL(`../packages/rules/src/${name}`, import.meta.url))).digest('hex')]));
  return { samplesPerCell: samples, battles: cells.length * samples, cells, hashes,
    constants: { combat: COMBAT, escape: ESCAPE, shields: [0, 6, 10].map(level => ({ level, hp: shieldHp(level) })) },
    roster: ALL_HULLS.filter(id => HULLS[id].atk > 0).map(id => HULLS[id]),
    methodology: 'Equal weight per cell; raw armed build-resource ratios, not damage ratios. No live-frequency claim. Seeds 0xA57E0000+i. Healthy ships, enough escape fuel. BASE: 4 tiers, 6x6 formations, 2 sizes, 4 nominal ratios rounded down to whole ships (see actualRatio). Controls: T3/T4, 2x2 mixed formations. EXACT_MIRROR: 4 tiers x 6 formations x 4 exact ratios; 100 ships per composition weight before scaling. Same research by default. Ground excluded from warship metrics. Cargo counted separately. No production/capacity/season model.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--run')) {
  process.stdout.write(JSON.stringify(runAudit(), null, 2) + '\n');
}
