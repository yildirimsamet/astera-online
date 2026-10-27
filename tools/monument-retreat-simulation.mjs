/** Simulation only. No gameplay files, database or deployment are changed. */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ALL_HULLS, HULLS, fleetCount, fleetEntries, fleetValue, mulberry32,
  monumentBattleControl, combatValue,
} from '../packages/rules/src/index.ts';
import { simulateRandomBattle } from './monument-random-target-model.mjs';
import { retreatProbabilities, adaptiveRetreatPolicy } from './monument-escape-policy.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SEED = 0xA5721022;
const keyOf = (hull, hp, shield) => `${hull}:${String(hp)}:${String(shield)}`;
const woundedCount = (groups, hull) => (groups.get(hull) ?? []).reduce((sum, row) => sum + row.count, 0);

/** Operates on the real engine's wound/cohort maps, after simultaneous casualties. */
export function retreatSide({ fleets, stats, wounded, carry, ids }, rng, { threshold, chance }) {
  if (chance === 0) return [];
  const fled = [];
  const eligible = (hpLeft, hp) => hpLeft > 0 && hpLeft / hp <= threshold + 1e-12;
  for (let index = 0; index < fleets.length; index++) {
    for (const [hull, groups] of wounded[index]) {
      if (HULLS[hull].ground) continue;
      const maxHp = stats[index].hp(hull);
      for (const group of groups) {
        if (!eligible(group.hpLeft, maxHp)) continue;
        const before = group.count;
        let count = 0;
        for (let n = 0; n < before; n++) if (rng() < chance) count++;
        if (count === 0) continue;
        group.count -= count;
        fleets[index][hull] -= count;
        fled.push({ index, hull, count, hpLeft: group.hpLeft, maxHp });
      }
      const kept = groups.filter(group => group.count > 0);
      if (kept.length) wounded[index].set(hull, kept);
      else wounded[index].delete(hull);
    }
  }
  // A healthy cohort carries at most one partly hit ship, assigned like stackSurvivorDamage.
  const holders = new Map();
  for (let index = 0; index < fleets.length; index++) {
    for (const [hull, n] of fleetEntries(fleets[index])) {
      if (HULLS[hull].ground) continue;
      const healthy = n - woundedCount(wounded[index], hull);
      if (healthy <= 0) continue;
      const hp = stats[index].hp(hull), key = keyOf(hull, hp, stats[index].shield(hull));
      const group = holders.get(key) ?? { hull, hp, members: [] };
      group.members.push({ index, healthy });
      holders.set(key, group);
    }
  }
  for (const [key, { hull, hp, members }] of holders) {
    const lost = carry.get(key) ?? 0;
    if (lost <= 0 || !eligible(hp - lost, hp) || rng() >= chance) continue;
    members.sort((a, b) => b.healthy - a.healthy || ids[a.index].localeCompare(ids[b.index]) || a.index - b.index);
    const index = members[0].index;
    fleets[index][hull]--;
    carry.delete(key);
    fled.push({ index, hull, count: 1, hpLeft: hp - lost, maxHp: hp });
  }
  return fled;
}

let prepared;
export async function prepareEngine() {
  if (prepared) return prepared;
  prepared = (async () => {
    const dir = resolve(ROOT, 'out/monument-retreat-runtime-20261022');
    mkdirSync(dir, { recursive: true });
    cpSync(resolve(ROOT, 'packages/rules/src'), resolve(dir, 'src'), { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), '{"type":"module"}\n');
    // A standalone hook avoids importing this CLI while its top-level study is awaiting us.
    const rulesUrl = pathToFileURL(resolve(ROOT, 'packages/rules/src/index.ts')).href;
    writeFileSync(resolve(dir, 'retreat-hook.mjs'),
      `import { HULLS, fleetEntries } from ${JSON.stringify(rulesUrl)};\nconst keyOf = ${keyOf.toString()};\nconst woundedCount = ${woundedCount.toString()};\n${retreatSide.toString()}\nexport { retreatSide };\n`);
    const source = readFileSync(resolve(dir, 'src/combat.ts'), 'utf8');
    const cut = source.indexOf('export function resolveBattle(');
    if (cut < 0) throw new Error('resolveBattle anchor changed');
    const replaceOnce = (text, before, after) => {
      if (text.split(before).length !== 2) throw new Error(`audit anchor changed: ${before}`);
      return text.replace(before, after);
    };
    let battle = source.slice(cut);
    battle = replaceOnce(battle, '  const monument = context', '  const fledA = [], fledD = [];\n  const monument = context');
    battle = replaceOnce(battle, 'r < COMBAT.rounds', 'r < auditOptions.rounds');
    battle = replaceOnce(battle, '\n  // Salvage is the host', `
    // STUDY ONLY: owner clarification, retreat only after rounds ONE and TWO.
    if (r < 2) {
    fledA.push(...auditRetreatSide({ fleets: live, stats, wounded, carry: carryA,
      ids: stacks.map(stack => stack.contributionId) }, auditOptions.retreatRng, { ...auditOptions, chance: auditOptions.chanceA ?? auditOptions.chance }).map(row => ({ ...row, round: r + 1 })));
    fledD.push(...auditRetreatSide({ fleets: dLive, stats: dStats, wounded: dWounded, carry: carryD,
      ids: dIds }, auditOptions.retreatRng, { ...auditOptions, chance: auditOptions.chanceD ?? auditOptions.chance }).map(row => ({ ...row, round: r + 1 })));
    }
  }

  // Salvage is the host`);
    // Move the hook inside the existing loop's closing brace.
    battle = replaceOnce(battle, '    });\n  }\n\n    // STUDY ONLY', '    });\n\n    // STUDY ONLY');
    battle = replaceOnce(battle, '  return {\n    grade,', '  return {\n    audit: { fledA, fledD },\n    grade,');
    const hookUrl = pathToFileURL(resolve(dir, 'retreat-hook.mjs')).href;
    const hook = `import { retreatSide as auditRetreatSide } from ${JSON.stringify(hookUrl)};\nexport const auditOptions = { rounds: 3, threshold: 0.3, chance: 0, retreatRng: () => 0.5 };\n`;
    writeFileSync(resolve(dir, 'src/combat.ts'), hook + source.slice(0, cut) + battle);
    const module = await import(pathToFileURL(resolve(dir, 'src/combat.ts')).href);
    const sha256 = createHash('sha256').update(source).digest('hex');
    return { resolve: module.resolveBattle, options: module.auditOptions, sha256 };
  })();
  return prepared;
}

function sideResult(start, active, escaped, damage) {
  const sent = fleetCount(start), activeCount = fleetCount(active);
  const fled = escaped.reduce((sum, row) => sum + row.count, 0);
  const armedSent = fleetEntries(start).reduce((n, [id, count]) => n + (HULLS[id].atk > 0 ? count : 0), 0);
  const armedActive = fleetEntries(active).reduce((n, [id, count]) => n + (HULLS[id].atk > 0 ? count : 0), 0);
  const armedFled = escaped.reduce((n, row) => n + (HULLS[row.hull].atk > 0 ? row.count : 0), 0);
  return { sent, active: activeCount, fled, physical: activeCount + fled,
    dead: sent - activeCount - fled, damage: escaped, activeDamage: damage,
    armed: { sent: armedSent, active: armedActive, fled: armedFled,
      physical: armedActive + armedFled, dead: armedSent - armedActive - armedFled } };
}

export function sampleBattle(engine, input, config, seed) {
  if (config.targeting === 'random' || config.targeting === 'random_live') return simulateRandomBattle(input, config, seed);
  const attacker = { contributionId: 'a', playerId: 'a', fleet: input.attacker,
    damage: input.attackerDamage, tech: { tech: input.attackerTech ?? {}, shipShields: config.shields === true } };
  const defender = { stackId: 'd', playerId: 'd', fleet: input.defender,
    damage: input.defenderDamage, tech: { tech: input.defenderTech ?? {}, shipShields: config.shields === true } };
  const chances = config.escapePolicy === 'ratio' ? retreatProbabilities(input.attacker, input.defender)
    : { attacker: config.chance ?? 0, defender: config.chance ?? 0 };
  Object.assign(engine.options, { rounds: config.rounds, threshold: config.threshold ?? 0.3,
    chanceA: chances.attacker, chanceD: chances.defender,
    chance: config.chance ?? 0, retreatRng: mulberry32(seed ^ 0x78E5CA9E) });
  const result = engine.resolve([attacker], [defender], 0, mulberry32(seed), 'MONUMENT', true);
  return {
    control: monumentBattleControl(result.attackerSurvivors, result.defenderSurvivors),
    grade: result.grade, rounds: result.rounds.length,
    a: sideResult(input.attacker, result.attackerSurvivors, result.audit.fledA, result.attackerDamage),
    d: sideResult(input.defender, result.defenderSurvivors, result.audit.fledD, result.defenderDamage),
  };
}

const mean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
function survival(sides) {
  const included = sides.filter(s => s.sent > 0);
  return { aliveProbability: mean(included.map(s => Number(s.physical > 0))),
    meanRemaining: mean(included.map(s => s.physical / s.sent)),
    meanFled: mean(included.map(s => s.fled / s.sent)),
    meanActive: mean(included.map(s => s.active / s.sent)),
    ...(sides.some(s => s.armed) ? { armed: survival(sides.map(s => s.armed)) } : {}) };
}
export function summarize(results, cap) {
  const loser = results.flatMap(row => row.control === 'ATTACKER' ? [row.d] : row.control === 'DEFENDER' ? [row.a] : [row.a, row.d]);
  const clearedLoser = results.flatMap(row => row.a.active === 0 && row.d.active === 0 ? [row.a, row.d]
    : row.a.active === 0 ? [row.a] : row.d.active === 0 ? [row.d] : []);
  return { samples: results.length, attacker: survival(results.map(row => row.a)),
    defender: survival(results.map(row => row.d)), loser: survival(loser),
    clearedLoser: survival(clearedLoser),
    eitherWipedProbability: mean(results.map(row => Number(row.a.physical === 0 || row.d.physical === 0))),
    ...(results.every(row => row.a.armed && row.d.armed) ? {
      eitherArmedWipedProbability: mean(results.map(row => Number((row.a.armed.sent > 0 && row.a.armed.physical === 0)
        || (row.d.armed.sent > 0 && row.d.armed.physical === 0)))),
    } : {}),
    bothWipedProbability: mean(results.map(row => Number(row.a.physical === 0 && row.d.physical === 0))),
    attackerWinProbability: mean(results.map(row => Number(row.control === 'ATTACKER'))),
    emptyProbability: mean(results.map(row => Number(row.control === 'EMPTY'))),
    roundLimitProbability: mean(results.map(row => Number(row.rounds === cap && row.a.active > 0 && row.d.active > 0))),
    meanRounds: mean(results.map(row => row.rounds)), maxRounds: Math.max(...results.map(row => row.rounds)) };
}

function roster(tier) {
  const pick = profile => ALL_HULLS.find(id => HULLS[id].tier === tier && HULLS[id].profile === profile);
  const r = pick('RAIDER'), s = pick('STRIKER'), f = pick('FORTRESS'), e = pick('ESCORT');
  return [{ name: 'RAIDER', mix: { [r]: 1 } }, { name: 'STRIKER', mix: { [s]: 1 } },
    { name: 'FORTRESS', mix: { [f]: 1 } }, { name: 'ESCORT', mix: { [e]: 1 } },
    { name: 'MIX_RSF', mix: { [r]: 1, [s]: 1, [f]: 1 } },
    { name: 'MIX_RRSE', mix: { [r]: 2, [s]: 1, [e]: 1 } }];
}
const scale = (mix, n) => Object.fromEntries(Object.entries(mix).map(([hull, count]) => [hull, Math.round(count * n)]));
const budgetFleet = (mix, budget) => Object.fromEntries(Object.entries(mix)
  .map(([hull, n]) => [hull, Math.floor(n * budget / fleetValue(mix))]).filter(([, n]) => n > 0));
const MODES = [
  { name: 'shield_3', shields: true, rounds: 3, chance: 0 },
  { name: 'no_shield_3', rounds: 3, chance: 0 },
  { name: 'retreat_3', rounds: 3, chance: 0.5 },
  { name: 'random_no_retreat_3', targeting: 'random', rounds: 3, chance: 0 },
  { name: 'random_retreat_3', targeting: 'random', rounds: 3, chance: 0.5 },
];

export async function runStudy({ liveOnly = false, ratioOnly = false, threshold = 0.3, shieldFraction = 0, shieldResearchLevel = null, escapePolicy = 'ratio' } = {}) {
  const engine = await prepareEngine();
  const start = performance.now(), cells = [], ratios = [1, 1.5, 2, 2.5, 3];
  const modes = ratioOnly ? [
    { name: `random_live_${escapePolicy}_retreat_3`, targeting: 'random_live', rounds: 3, escapePolicy },
  ] : liveOnly ? [
    { name: 'random_live_no_retreat_3', targeting: 'random_live', rounds: 3, chance: 0 },
    { name: 'random_live_retreat_3', targeting: 'random_live', rounds: 3, chance: 0.5 },
  ] : MODES;
  let battles = 0;
  function measure(meta, input, mode, samples) {
    const usesRatioPolicy = ['ratio', 'adaptive', 'adaptive-v2'].includes(mode.escapePolicy);
    if (mode.escapePolicy === 'ratio') mode = { ...mode, threshold };
    if (usesRatioPolicy && shieldFraction > 0) mode = { ...mode, shieldFraction };
    if (usesRatioPolicy && shieldResearchLevel !== null) {
      mode = { ...mode, shieldResearch: true };
      input = { ...input,
        attackerTech: { ...input.attackerTech, SHIP_SHIELDS: shieldResearchLevel },
        defenderTech: { ...input.defenderTech, SHIP_SHIELDS: shieldResearchLevel } };
    }
    const results = [];
    for (let n = 0; n < samples; n++) {
      const result = sampleBattle(engine, input, mode, SEED + n);
      for (const side of [result.a, result.d]) {
        if (side.sent !== side.active + side.fled + side.dead || side.dead < 0
          || side.physical !== side.active + side.fled
          || side.damage.some(row => row.hpLeft <= 0 || row.hpLeft > row.maxHp)) throw new Error('simulation conservation failed');
      }
      results.push(result);
    }
    cells.push({ ...meta, mode: mode.name, config: mode, input,
      ...(usesRatioPolicy ? { escapeProbabilities: ['adaptive', 'adaptive-v2'].includes(mode.escapePolicy)
        ? adaptiveRetreatPolicy(input.attacker, input.defender, { revised: mode.escapePolicy === 'adaptive-v2' })
        : retreatProbabilities(input.attacker, input.defender) } : {}),
      actualValueRatio: fleetValue(input.defender) ? fleetValue(input.attacker) / fleetValue(input.defender) : null,
      actualCombatValueRatio: combatValue(input.defender) ? combatValue(input.attacker) / combatValue(input.defender) : null,
      ...summarize(results, mode.rounds) });
    battles += samples;
  }
  for (const tier of [1, 2, 3, 4]) {
    for (const formation of roster(tier)) for (const size of [2, 10, 100, 1000]) for (const ratio of ratios) {
      for (const mode of modes) measure({ group: 'mirror', tier, formation: formation.name, size, ratio },
        { attacker: scale(formation.mix, size * ratio), defender: scale(formation.mix, size) }, mode, 128);
    }
    process.stderr.write(`mirror tier ${tier}: ${battles} battles\n`);
  }
  // Different equal-resource compositions: value ratio does not promise a power ratio.
  for (const tier of [1, 2, 3, 4]) {
    for (const a of roster(tier)) for (const d of roster(tier)) for (const ratio of ratios) {
      for (const mode of modes.filter(row => !row.shields)) measure({ group: 'budget_cross', tier,
        formation: `${a.name}/${d.name}`, ratio, budget: 1000000 }, {
        attacker: budgetFleet(a.mix, 1000000 * ratio), defender: budgetFleet(d.mix, 1000000),
      }, mode, 64);
    }
    process.stderr.write(`budget tier ${tier}: ${battles} battles\n`);
  }
  const examplePairs = [[1, 1], [2, 1], [3, 1], [5, 2], ...(ratioOnly ? [[4, 1], [5, 1]] : [])];
  for (const [a, d] of examplePairs) for (const damageBp of [0, 1000, 3000, 5000, 9000]) {
    for (const level of shieldResearchLevel === null ? [0, 4] : [shieldResearchLevel]) for (const mode of modes) measure({ group: 'player_examples', a, d, damageBp, shieldResearch: level }, {
      attacker: { CORSAIR: a }, defender: { CORSAIR: d },
      attackerTech: { SHIP_SHIELDS: level }, defenderTech: { SHIP_SHIELDS: level },
      defenderDamage: damageBp ? [{ hull: 'CORSAIR', count: d, damageBp }] : [],
    }, mode, 512);
  }
  process.stderr.write(`player examples: ${battles} battles\n`);
  const calibration = [
    { name: 'retreat_30_75', rounds: 3, threshold: 0.3, chance: 0.75 },
    { name: 'retreat_50_50', rounds: 3, threshold: 0.5, chance: 0.5 },
  ];
  if (!ratioOnly) for (const tier of [1, 2, 3, 4]) for (const formation of roster(tier)) {
    for (const size of [10, 1000]) for (const ratio of ratios) for (const mode of calibration) {
      for (const targeting of liveOnly ? ['random_live'] : ['focused', 'random']) measure({ group: 'calibration', tier, formation: formation.name, size, ratio },
        { attacker: scale(formation.mix, size * ratio), defender: scale(formation.mix, size) },
        { ...mode, targeting, name: `${targeting}_${mode.name}` }, 128);
    }
  }
  // Orientation, tech and arrival wounds are separate from the healthy mirror headline.
  for (const size of [2, 100]) for (const ratio of ratios) for (const scenario of [
    'REVERSED', 'DEFENDER_ARMOR_5', 'ATTACKER_POWER_5', 'BOTH_TECH_5', 'DEFENDER_WOUNDED_30', 'BOTH_WOUNDED_70',
  ]) for (const mode of modes) {
    const input = { attacker: { CORSAIR: size * ratio }, defender: { CORSAIR: size } };
    if (scenario === 'REVERSED') [input.attacker, input.defender] = [input.defender, input.attacker];
    if (scenario === 'DEFENDER_ARMOR_5') input.defenderTech = { SHIP_ARMOR: 5 };
    if (scenario === 'ATTACKER_POWER_5') input.attackerTech = { SHIP_POWER: 5 };
    if (scenario === 'BOTH_TECH_5') input.attackerTech = input.defenderTech = { SHIP_ARMOR: 5, SHIP_POWER: 5 };
    if (scenario.includes('WOUNDED')) input.defenderDamage = [{ hull: 'CORSAIR', count: fleetCount(input.defender), damageBp: scenario === 'BOTH_WOUNDED_70' ? 7000 : 3000 }];
    if (scenario === 'BOTH_WOUNDED_70') input.attackerDamage = [{ hull: 'CORSAIR', count: fleetCount(input.attacker), damageBp: 7000 }];
    measure({ group: 'controls', size, ratio, scenario }, input, mode, 128);
  }
  // Diagnostic only. Owner's candidate retains THREE rounds, not this longer cap.
  if (!liveOnly) for (const tier of [1, 2, 3, 4]) for (const formation of roster(tier)) for (const ratio of ratios) {
    for (const chance of [0, 0.5]) measure({ group: 'round_cap_diagnostic', tier, formation: formation.name, size: 100, ratio },
      { attacker: scale(formation.mix, 100 * ratio), defender: scale(formation.mix, 100) },
      { name: `diagnostic_100_${chance}`, rounds: 100, chance }, 64);
  }
  if (liveOnly) for (const scenario of [
    { name: 'CARGO_BOTH', attacker: { ARGOSY: 2 }, defender: { ARGOSY: 3 } },
    { name: 'ARMED_V_CARGO', attacker: { CORSAIR: 1 }, defender: { ARGOSY: 2 } },
    { name: 'CARGO_V_ARMED', attacker: { ARGOSY: 2 }, defender: { CORSAIR: 1 } },
    { name: '2V1_WITH_CARGO', attacker: { CORSAIR: 2, ARGOSY: 1 }, defender: { CORSAIR: 1, ARGOSY: 1 } },
    { name: '5V2_WITH_CARGO', attacker: { CORSAIR: 5, ARGOSY: 1 }, defender: { CORSAIR: 2, ARGOSY: 1 } },
    { name: '300V100_WITH_CARGO', attacker: { CORSAIR: 300, ARGOSY: 20 }, defender: { CORSAIR: 100, ARGOSY: 50 } },
    { name: 'SAME_ROUND_CARGO', attacker: { CATACLYSM: 2 }, defender: { DART: 1, ARGOSY: 1 } },
  ]) for (const mode of [...MODES.filter(row => ['retreat_3', 'random_retreat_3'].includes(row.name)), ...modes]) {
    measure({ group: 'cargo', scenario: scenario.name }, scenario, mode, 512);
  }
  const hashes = Object.fromEntries(['combat.ts', 'hulls.ts', 'tech.ts', 'constants.ts', 'shipShield.ts', 'radiationHp.ts', 'shipMaintenance.ts', 'economy-profile.ts', 'tempo.ts']
    .map(file => [file, createHash('sha256').update(readFileSync(resolve(ROOT, 'packages/rules/src', file))).digest('hex')]));
  return { methodology: { seed: SEED, sourceHashes: hashes, threshold: ['adaptive', 'adaptive-v2'].includes(escapePolicy) ? null : threshold,
    escapePolicy, shieldFraction, shieldResearchLevel, roundsCap: 3, diagnosticRoundsCap: 100,
    runtimeHulls: Object.fromEntries(ALL_HULLS.map(id => [id, { atk: HULLS[id].atk, hp: HULLS[id].hp,
      cls: HULLS[id].cls, tier: HULLS[id].tier }])),
    samplesPerMirrorCell: 128, samplesPerBudgetCell: 64, samplesPerExampleCell: 512,
    retreatRng: 'separate independently seeded stream, per eligible ship, rounds 1 and 2 ONLY',
    ratio: 'larger attacker / smaller defender; budget cross uses build resources',
    survival: 'battle-exit active + escaped; means INCLUDE zero survivors',
    randomTargeting: 'each armed ship fires once per round at a uniformly random live enemy; escort cover retained; within-round overkill wasted; shared ±8% roll per side',
    liveTargeting: 'random shooter order; skip targets destroyed by earlier shots in same round; cargo only after combat targets clear; no shot damage spills; BOTH sides retain start-of-round firing rights; cargo-only vs cargo-only is no battle',
    ratioPolicy: escapePolicy === 'adaptive-v2'
      ? 'battle-start combatValue excludes cargo; side chance/HP threshold: ratio<1.5 both 25%/25%; 1.5<=ratio<2 weak33%/30% strong20%/30%; 2<=ratio<3 weak55%/55% strong15%/30%; ratio>=3 weak70%/70% strong10%/25%; HP threshold inclusive, rounds 1 and 2 only'
      : escapePolicy === 'adaptive'
      ? 'battle-start combatValue excludes cargo; side chance/HP threshold: ratio<1.5 both 25%/25%; 1.5<=ratio<2 weak33%/30% strong20%/30%; 2<=ratio<3 weak50%/50% strong15%/30%; ratio>=3 weak75%/70% strong10%/25%; HP threshold inclusive, rounds 1 and 2 only'
      : `battle-start combatValue excludes cargo; equal=25% each; weaker: ratio<1.5=25%, 1.5<=ratio<3=50%, ratio>=3=75%; stronger always 25%; HP<=${threshold * 100}%, rounds 1 and 2 only`,
    loser: 'control loser; clearedLoser excludes unresolved mutual survival',
    resources: 'Docker memory=2g, memory-swap=2g, cpus=1; Node heap=1536 MiB, one worker',
    personalShields: shieldFraction > 0
      ? `ratio model: researched maximum HP * ${shieldFraction}${shieldResearchLevel !== null ? ` * shipShieldMult(owner SHIP_SHIELDS L${shieldResearchLevel})` : '; no SHIP_SHIELDS research multiplier'}; full at battle start, never regenerates between rounds; radiation wounds remain on hull; cargo included; Aegis=0; pre-battle fleet escape excluded`
      : 'disabled except shield_3 baseline; Aegis=0; pre-battle fleet escape excluded' },
    battles, elapsedSeconds: (performance.now() - start) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024, cells };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--smoke')) {
  const engine = await prepareEngine();
  const threshold = process.argv.includes('--threshold-50') ? 0.5 : 0.3;
  const shieldFraction = process.argv.includes('--shield-25') ? 0.25 : 0;
  const shieldResearchLevel = process.argv.includes('--shield-research-4') ? 4 : null;
  const escapePolicy = process.argv.includes('--adaptive-escape-v2') ? 'adaptive-v2'
    : process.argv.includes('--adaptive-escape') ? 'adaptive' : undefined;
  const config = { rounds: 3, chance: 0.5, threshold, ...(shieldFraction > 0 ? { targeting: 'random_live', shieldFraction } : {}),
    ...(escapePolicy ? { escapePolicy } : {}),
    ...(shieldResearchLevel !== null ? { shieldResearch: true } : {}) };
  const input = { attacker: { CORSAIR: 3 }, defender: { CORSAIR: 1 },
    ...(shieldResearchLevel !== null ? { attackerTech: { SHIP_SHIELDS: shieldResearchLevel }, defenderTech: { SHIP_SHIELDS: shieldResearchLevel } } : {}) };
  process.stdout.write(JSON.stringify({ threshold, shieldFraction, shieldResearchLevel, escapePolicy, ...sampleBattle(engine, input, config, 7) }) + '\n');
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && ['--run', '--run-live', '--run-ratio'].some(flag => process.argv.includes(flag))) {
  const ratioOnly = process.argv.includes('--run-ratio');
  const liveOnly = ratioOnly || process.argv.includes('--run-live');
  const threshold = process.argv.includes('--threshold-50') ? 0.5 : 0.3;
  const shieldFraction = process.argv.includes('--shield-25') ? 0.25 : 0;
  const shieldResearchLevel = process.argv.includes('--shield-research-4') ? 4 : null;
  const escapePolicy = process.argv.includes('--adaptive-escape-v2') ? 'adaptive-v2'
    : process.argv.includes('--adaptive-escape') ? 'adaptive' : 'ratio';
  const result = await runStudy({ liveOnly, ratioOnly, threshold, shieldFraction, shieldResearchLevel, escapePolicy });
  const output = resolve(ROOT, `docs/evidence/monument-retreat-${ratioOnly ? 'ratio-' : liveOnly ? 'live-targets-' : ''}${escapePolicy === 'adaptive-v2' ? 'adaptive-v2-' : escapePolicy === 'adaptive' ? 'adaptive-' : threshold === 0.5 ? 'hp50-' : ''}${shieldFraction > 0 ? 'shield25-' : ''}${shieldResearchLevel !== null ? 'l4-' : ''}study-2026-10-22.json`);
  mkdirSync(resolve(ROOT, 'docs/evidence'), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, battles: result.battles, elapsedSeconds: result.elapsedSeconds, maxRssMiB: result.maxRssMiB }) + '\n');
}
