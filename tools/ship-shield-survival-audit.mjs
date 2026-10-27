/** Read-only battle measurement. No season, economy, database or production writes. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_HULLS, HULLS, COMBAT, combatValue, fleetCount, fleetEntries, fleetValue,
  mulberry32, resolveBattle,
} from '../packages/rules/src/index.ts';
import { budgetFleet } from './combat-attrition-audit.mjs';

const TECH = { SHIP_POWER: 2, SHIP_ARMOR: 2, STARSHIP_ENGINEERING: 2 };
const SEED = 0x51E1D000;

export function fleetSurvival(before, after) {
  const subset = (fleet, armed) => Object.fromEntries(fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground && (!armed || HULLS[id].atk > 0)));
  const armedBefore = subset(before, true), armedAfter = subset(after, true);
  const mobileBefore = subset(before, false), mobileAfter = subset(after, false);
  const fraction = (a, b) => a === 0 ? null : b / a;
  return {
    armed: fraction(fleetCount(armedBefore), fleetCount(armedAfter)),
    armedValue: fraction(fleetValue(armedBefore), fleetValue(armedAfter)),
    mobile: fraction(fleetCount(mobileBefore), fleetCount(mobileAfter)),
  };
}

export function summarizeSurvival(values) {
  if (!values.length || values.some(n => !Number.isFinite(n) || n < 0 || n > 1)) throw new RangeError('bad survival samples');
  const alive = values.filter(n => n > 0).length;
  const total = values.reduce((sum, n) => sum + n, 0);
  const sorted = values.slice().sort((a, b) => a - b);
  const quantile = q => sorted[Math.floor((sorted.length - 1) * q)];
  return {
    samples: values.length, aliveProbability: alive / values.length,
    wipedProbability: (values.length - alive) / values.length,
    meanRemaining: total / values.length, meanWhenAlive: alive ? total / alive : null,
    nearlyWipedProbability: values.filter(n => n <= 0.1).length / values.length,
    p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9),
  };
}

export function measureSurvivalCell(input, samples) {
  if (!Number.isSafeInteger(samples) || samples < 1) throw new RangeError('bad sample count');
  if (!(combatValue(input.attacker) > 0) || !(combatValue(input.defender) > 0)) throw new RangeError('both sides need warships');
  const values = { worseArmed: [], worseArmedValue: [], worseMobile: [], defenderArmed: [], attackerArmed: [] };
  let bothWiped = 0, limit = 0;
  for (let seed = 0; seed < samples; seed++) {
    const result = resolveBattle([{ contributionId: 'attack', playerId: 'attack', fleet: input.attacker,
      tech: { tech: input.attackerTech ?? {} }, damage: input.attackerDamage }],
    [{ stackId: 'defence', playerId: 'defence', fleet: input.defender,
      tech: { tech: input.defenderTech ?? {} }, damage: input.defenderDamage }],
    0, mulberry32(SEED + seed), 'MONUMENT', true);
    const a = fleetSurvival(input.attacker, result.attackerSurvivors);
    const d = fleetSurvival(input.defender, result.defenderSurvivors);
    values.worseArmed.push(Math.min(a.armed, d.armed));
    values.worseArmedValue.push(Math.min(a.armedValue, d.armedValue));
    values.worseMobile.push(Math.min(a.mobile, d.mobile));
    values.defenderArmed.push(d.armed); values.attackerArmed.push(a.armed);
    bothWiped += Number(a.armed === 0 && d.armed === 0);
    limit += Number(result.rounds.length === COMBAT.rounds);
  }
  return {
    actualRatio: combatValue(input.attacker) / combatValue(input.defender),
    ...Object.fromEntries(Object.entries(values).map(([key, rows]) => [key, summarizeSurvival(rows)])),
    bothWipedProbability: bothWiped / samples, roundLimitProbability: limit / samples,
  };
}

function roster(tier) {
  const hull = profile => {
    const id = ALL_HULLS.find(h => HULLS[h].tier === tier && HULLS[h].profile === profile);
    if (!id) throw new Error('Missing hull profile');
    return id;
  };
  const r = hull('RAIDER'), s = hull('STRIKER'), f = hull('FORTRESS'), e = hull('ESCORT');
  return [
    { name: r, mix: { [r]: 1 } }, { name: s, mix: { [s]: 1 } },
    { name: f, mix: { [f]: 1 } }, { name: e, mix: { [e]: 1 } },
    { name: 'MIX_RSF', mix: { [r]: 1, [s]: 1, [f]: 1 } },
    { name: 'MIX_RRSE', mix: { [r]: 2, [s]: 1, [e]: 1 } },
  ];
}
const scale = (fleet, factor) => Object.fromEntries(fleetEntries(fleet).map(([hull, n]) => [hull, n * factor]));

function pool(cells, metric) {
  const rows = cells.map(c => c.result[metric]);
  const samples = rows.reduce((sum, r) => sum + r.samples, 0);
  const weighted = key => rows.reduce((sum, r) => sum + r.samples * r[key], 0) / samples;
  const aliveProbability = weighted('aliveProbability'), meanRemaining = weighted('meanRemaining');
  return { scenarios: rows.length, samples, aliveProbability, wipedProbability: weighted('wipedProbability'),
    meanRemaining, meanWhenAlive: aliveProbability ? meanRemaining / aliveProbability : null,
    nearlyWipedProbability: weighted('nearlyWipedProbability'),
    rangeOfScenarioMeans: [Math.min(...rows.map(r => r.meanRemaining)), Math.max(...rows.map(r => r.meanRemaining))] };
}

export function runSurvivalAudit() {
  const cells = [];
  const add = (description, input, samples) => {
    cells.push({ ...description, ...input, samples, result: measureSurvivalCell(input, samples) });
  };
  for (const tier of [1, 2, 3, 4]) {
    const formations = roster(tier);
    for (const formation of formations) for (const ratio of [1, 2, 3]) for (const level of [0, 1, 2, 3, 4]) {
      const defender = scale(formation.mix, 100), tech = { ...TECH, SHIP_SHIELDS: level };
      add({ family: 'MIRROR', tier, formation: formation.name, ratio, level, scale: 100 },
        { attacker: scale(defender, ratio), defender, attackerTech: tech, defenderTech: tech }, 512);
    }
    for (const count of [1, 10]) for (const formation of formations) for (const ratio of [1, 2, 3]) for (const level of [0, 4]) {
      const defender = scale(formation.mix, count), tech = { ...TECH, SHIP_SHIELDS: level };
      add({ family: 'SMALL_MIRROR', tier, formation: formation.name, ratio, level, scale: count },
        { attacker: scale(defender, ratio), defender, attackerTech: tech, defenderTech: tech }, 128);
    }
    for (const a of formations) for (const d of formations) for (const ratio of [1, 2, 3]) for (const level of [0, 4]) {
      const defender = budgetFleet(d.mix, 1_000_000), tech = { ...TECH, SHIP_SHIELDS: level };
      add({ family: 'CROSS_BUDGET', tier, a: a.name, d: d.name, ratio, level },
        { attacker: budgetFleet(a.mix, combatValue(defender) * ratio), defender, attackerTech: tech, defenderTech: tech }, 128);
    }
    if (tier === 4) for (const formation of formations) for (const ratio of [1, 2, 3]) {
      for (const control of ['WEAK_SHIELD_4', 'STRONG_SHIELD_4', 'WEAK_HALF_WOUNDED', 'STRONG_TECH_5', 'CARGO_0', 'CARGO_4']) {
        let defender = scale(formation.mix, 100), attacker = scale(defender, ratio);
        let attackerTech = { ...TECH, SHIP_SHIELDS: 2 }, defenderTech = { ...TECH, SHIP_SHIELDS: 2 };
        let defenderDamage;
        if (control === 'WEAK_SHIELD_4') { attackerTech.SHIP_SHIELDS = 0; defenderTech.SHIP_SHIELDS = 4; }
        if (control === 'STRONG_SHIELD_4') { attackerTech.SHIP_SHIELDS = 4; defenderTech.SHIP_SHIELDS = 0; }
        if (control === 'WEAK_HALF_WOUNDED') defenderDamage = fleetEntries(defender).map(([hull, count]) => ({ hull, count, damageBp: 5000 }));
        if (control === 'STRONG_TECH_5') attackerTech = { ...attackerTech, SHIP_POWER: 5, SHIP_ARMOR: 5 };
        if (control.startsWith('CARGO_')) {
          attackerTech.SHIP_SHIELDS = Number(control.slice(-1)); defenderTech.SHIP_SHIELDS = Number(control.slice(-1));
          attacker = { ...attacker, ARGOSY: Math.ceil(fleetCount(attacker) / 5) };
          defender = { ...defender, ARGOSY: Math.ceil(fleetCount(defender) / 5) };
        }
        add({ family: 'CONTROL', tier, formation: formation.name, ratio, control },
          { attacker, defender, attackerTech, defenderTech, ...(defenderDamage ? { defenderDamage } : {}) }, 256);
      }
    }
    process.stderr.write(`T${tier}: ${cells.length} scenarios; ${cells.reduce((sum, c) => sum + c.samples, 0)} battles\n`);
  }
  const summaries = [];
  for (const family of ['MIRROR', 'CROSS_BUDGET', 'SMALL_MIRROR']) for (const ratio of [1, 2, 3]) {
    for (const level of family === 'MIRROR' ? [0, 1, 2, 3, 4] : [0, 4]) {
      const rows = cells.filter(c => c.family === family && c.ratio === ratio && c.level === level);
      summaries.push({ family, ratio, level, worseArmed: pool(rows, 'worseArmed'),
        weakerDefenderArmed: pool(rows, 'defenderArmed'), worseArmedValue: pool(rows, 'worseArmedValue') });
    }
  }
  const sources = ['combat.ts', 'shipShield.ts', 'tech.ts', 'hulls.ts', 'constants.ts', 'shipMaintenance.ts', 'radiationHp.ts', 'economy-profile.ts', 'tempo.ts'];
  return {
    measuredAt: new Date().toISOString(), battles: cells.reduce((sum, c) => sum + c.samples, 0),
    nodeVersion: process.version, combatConstants: COMBAT, catalog: ALL_HULLS.map(id => HULLS[id]),
    scenarioCount: cells.length, seedBase: SEED, sources: Object.fromEntries(sources.map(name => [name,
      createHash('sha256').update(readFileSync(new URL('../packages/rules/src/' + name, import.meta.url))).digest('hex')])),
    method: {
      resolver: 'resolveBattle, MONUMENT context, maintenance enabled, zero Aegis',
      definition: 'Worse side = smaller surviving warship fraction of the two sides. Not combat grade or monument control. Equal losses tie; both may survive without a decisive winner.',
      armed: 'Mobile hulls with positive attack. Survivors include wounded ships with positive hull HP. Cargo excluded from primary metric; reported separately.',
      probability: 'aliveProbability = P(both sides retain at least one warship); wipedProbability = P(at least one side loses every warship).',
      mean: 'meanRemaining includes zeros from total losses; meanWhenAlive conditions on both sides retaining a warship.',
      mirror: '24 formations = four primary profiles and two mixed formations at each of four tiers. Weaker side 100 ships per composition weight; stronger side multiplied by 1/2/3. All five equal shield levels; 512 seeds per scenario.',
      cross: 'All 6x6 formation pairings per tier; weak raw armed cost budget 1M, stronger budget x1/x2/x3, rounded down to whole ships. Equal shield L0/L4; 128 seeds each. Cost/force ratios, not damage ratios.',
      weighting: 'Within each family/ratio/level every composition is equally weighted. These are synthetic scenario averages, not estimates of the live battle distribution.',
      exclusions: 'Main tables exclude cargo, ground guns, Aegis, arrival wounds, radiation during combat, mismatched technology and escape. Escape threshold 3.5 exceeds the tested ratios. Controls are separate and not pooled into main averages.',
      changes: 'No gameplay changes, deployment, live data reads, economy/season simulation or production writes.',
    }, summaries, cells,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--run')) {
  process.stdout.write(JSON.stringify(runSurvivalAudit(), null, 2) + '\n');
}
