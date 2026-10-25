/** Paired Monte Carlo study only; never connects to production or changes game code. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { HULLS, combatValue, fleetDiff } from '../packages/rules/src/hulls.ts';
import { battleRetreatPolicy } from '../packages/rules/src/battleRetreat.ts';
import { mulberry32, seededFrom } from '../packages/rules/src/rng.ts';
import { monumentBattleControl } from '../packages/rules/src/monumentCombat.ts';
import { prepareStudyEngine } from './distributed-damage-model.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const count = (fleet, armed = false) => Object.entries(fleet ?? {}).reduce((sum, [id, n]) => sum + (!HULLS[id].ground && (!armed || HULLS[id].atk > 0) ? n : 0), 0);
const scaleFleet = (fleet, scale) => Object.fromEntries(Object.entries(fleet).map(([id, n]) => [id, n * scale]));

export function summarizeBattle(input, result, trace = [], retreatRounds = 2) {
  const side = (name, fleet) => {
    const prefix = name === 'ATTACK' ? 'attacker' : 'defender';
    const sent = count(fleet), survivors = result[`${prefix}Survivors`], retreated = result[`${prefix}Retreated`] ?? {};
    const active = fleetDiff(survivors, retreated);
    assert.equal(count(survivors) + count(result[`${prefix}Losses`]), sent);
    assert.ok(count(retreated) <= count(survivors));
    const total = sent || 1;
    return {
      sent, armedSent: count(fleet, true), physicalCount: count(survivors), armedPhysicalCount: count(survivors, true),
      physical: count(survivors) / total, active: count(active) / total, dead: count(result[`${prefix}Losses`]) / total,
      escape: Array.from({ length: retreatRounds }, (_, i) => i + 1).map(round => result.rounds.filter(r => r.round === round).flatMap(r => r.retreats ?? []).filter(row => row.side === name).reduce((sum, row) => sum + count(row.fleet), 0) / total),
      eligible: Array.from({ length: retreatRounds }, (_, i) => i + 1).map(round => (trace.find(row => row.round === round)?.[prefix].eligible ?? 0) / total),
    };
  };
  const attacker = side('ATTACK', input.attacker), defender = side('DEFENCE', input.defender);
  const weak = combatValue(input.attacker) < combatValue(input.defender) ? attacker : defender;
  const strong = weak === attacker ? defender : attacker;
  const wiped = s => s.sent > 0 && s.physicalCount === 0;
  return {
    grade: result.grade, attacker, defender, weak, strong,
    monumentControl: [...Object.keys(input.attacker), ...Object.keys(input.defender)].some(id => HULLS[id].ground) ? null
      : monumentBattleControl(fleetDiff(result.attackerSurvivors, result.attackerRetreated ?? {}), fleetDiff(result.defenderSurvivors, result.defenderRetreated ?? {})),
    anyPhysicalWipe: Number(wiped(attacker) || wiped(defender)),
    bothPhysicalWipe: Number(wiped(attacker) && wiped(defender)),
    anyArmedPhysicalWipe: Number([attacker, defender].some(s => s.armedSent > 0 && s.armedPhysicalCount === 0)),
    anyActiveWipe: Number([attacker, defender].some(s => s.sent > 0 && s.active === 0)),
  };
}

export function aggregateSamples(samples, retreatRounds = 2) {
  assert.ok(samples.length > 0);
  const mean = fn => samples.reduce((sum, sample) => sum + fn(sample), 0) / samples.length;
  const side = name => ({ physical: mean(s => s[name].physical), active: mean(s => s[name].active), dead: mean(s => s[name].dead),
    escape: Array.from({ length: retreatRounds }, (_, i) => mean(s => s[name].escape[i])), eligible: Array.from({ length: retreatRounds }, (_, i) => mean(s => s[name].eligible[i])) });
  return { n: samples.length,
    anyPhysicalWipe: mean(s => s.anyPhysicalWipe), bothPhysicalWipe: mean(s => s.bothPhysicalWipe),
    anyActiveWipe: mean(s => s.anyActiveWipe), anyArmedPhysicalWipe: mean(s => s.anyArmedPhysicalWipe),
    weak: side('weak'), strong: side('strong'),
    ...(samples.every(s => s.attacker && s.defender) ? { attacker: side('attacker'), defender: side('defender') } : {}),
    controls: Object.fromEntries(['ATTACKER', 'DEFENDER', 'EMPTY'].map(control => [control, mean(s => Number(s.monumentControl === control))])),
    grades: Object.fromEntries(['DECISIVE', 'PARTIAL', 'REPELLED'].map(grade => [grade, mean(s => Number(s.grade === grade))])),
  };
}

export function buildCases(sizes = [2, 10, 50, 200]) {
  const profiles = { DART: { DART: 1 }, CORSAIR: { CORSAIR: 1 }, CATACLYSM: { CATACLYSM: 1 }, CITADEL: { CITADEL: 1 }, MIXED: { CORSAIR: 1, CATACLYSM: 1 } };
  const cases = [];
  for (const ratio of [1, 1.5, 2, 2.5, 3]) for (const shieldLevel of [0, 4]) for (const strongSide of ['ATTACK', 'DEFENCE']) {
    for (const [profile, fleet] of Object.entries(profiles)) for (const size of sizes) {
      const weak = scaleFleet(fleet, size), strong = scaleFleet(fleet, size * ratio);
      const attacker = strongSide === 'ATTACK' ? strong : weak, defender = strongSide === 'ATTACK' ? weak : strong;
      cases.push({ id: `${profile}-${size}-${ratio}-s${shieldLevel}-${strongSide}`, profile, size, ratio, shieldLevel, strongSide,
        attacker, defender, tech: shieldLevel ? { SHIP_SHIELDS: shieldLevel } : {},
        actualRatio: Math.max(combatValue(attacker), combatValue(defender)) / Math.min(combatValue(attacker), combatValue(defender)) });
    }
  }
  return cases;
}

function stacks(input) {
  return {
    a: input.stacks ?? [{ contributionId: 'a', playerId: 'a', fleet: input.attacker, tech: { tech: input.attackerTech ?? input.tech ?? {} }, ...(input.attackerDamage ? { damage: input.attackerDamage } : {}) }],
    d: input.defenders ?? [{ stackId: 'host', playerId: 'd', fleet: input.defender, tech: { tech: input.defenderTech ?? input.tech ?? {} }, ...(input.defenderDamage ? { damage: input.defenderDamage } : {}) }],
  };
}

function runCase(engine, input, trials, salt) {
  const { a, d } = stacks(input), baseline = [], candidate = [];
  for (let n = 0; n < trials; n++) {
    const seed = Math.imul(n + 1, 0x9e3779b1) ^ salt;
    const changed = engine.candidate(a, d, input.shield ?? 0, mulberry32(seed), true, true);
    candidate.push(summarizeBattle(input, changed, engine.trace));
    const current = engine.baseline(a, d, input.shield ?? 0, mulberry32(seed), true, true);
    baseline.push(summarizeBattle(input, current));
  }
  return { baseline: aggregateSamples(baseline), candidate: aggregateSamples(candidate) };
}

export async function runStudy(options = {}) {
  const engine = await prepareStudyEngine(), started = Date.now();
  const cases = buildCases(options.sizes), rows = [];
  const trialsSmall = options.trials ?? 500, trialsLarge = options.largeTrials ?? 100, trialsHuge = options.hugeTrials ?? 30;
  let battles = 0;
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i], trials = c.size >= 200 ? trialsHuge : c.size >= 50 ? trialsLarge : trialsSmall;
    const result = runCase(engine, c, trials, 0xA5721023 ^ i);
    rows.push({ ...c, trials, policy: battleRetreatPolicy(c.attacker, c.defender), ...result });
    battles += trials * 2;
    if (i % 20 === 19) console.log(JSON.stringify({ progress: i + 1, cases: cases.length, battles, elapsedSeconds: (Date.now() - started) / 1000, rssMb: Math.round(process.memoryUsage().rss / 1048576) }));
  }
  const live = JSON.parse(readFileSync(resolve(ROOT, 'tools/fixtures/distributed-damage-live-battle-20261023.json'), 'utf8'));
  const mission = live.missions.find(m => m.kind === 'attack'), report = live.report;
  const realInput = { attacker: report.attacker_fleet, defender: report.defender_fleet, shield: 150,
    attackerTech: mission.tech, defenderTech: live.defenderTech };
  const { a, d } = stacks(realInput);
  const sameSeed = engine.candidate(a, d, 150, seededFrom(mission.id), true, true);
  const liveTrace = structuredClone(engine.trace);
  const liveSummary = runCase(engine, realInput, Math.max(1000, trialsSmall), 0xFA47A51A);
  battles += Math.max(1000, trialsSmall) * 2 + 1;
  const examples = [];
  for (const ratio of [1, 1.5, 2, 2.5, 3]) {
    const input = { attacker: { CORSAIR: 20 * ratio }, defender: { CORSAIR: 20 } };
    const { a: ea, d: ed } = stacks(input);
    const r = engine.candidate(ea, ed, 0, mulberry32(20261023), true, true);
    examples.push({ ratio, ...input, result: r, trace: structuredClone(engine.trace) });
  }
  battles += examples.length;
  const data = { metadata: {
    createdAt: new Date().toISOString(), gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceHash: engine.sourceHash, battles, elapsedSeconds: (Date.now() - started) / 1000,
    distribution: 'Per shooter: independent Uniform(0,1] target weights normalized to base attack; surplus redistributed; counters once per target share.',
    shieldFraction: 0.25, shieldLevels: [0, 4], rounds: 3, retreatRounds: [1, 2],
    ratioMetric: 'Initial armed resource value (combatValue), excludes cargo and collectors; equal compositions.',
    limits: 'Single process; CPUQuota=100%; MemoryMax=2G; MemorySwapMax=0; Node heap=1536MiB; v8-pool-size=1.',
    excluded: ['pre-battle 4x fleet escape (ratios <=3)', 'travel radiation after battle', 'loot/repair/Dominion persistence', 'planet Aegis in main matrix'],
    wipeDefinition: 'Zero physical mobile survivors INCLUDING escaped ships; armed-only wipe also recorded. No ground salvage included.',
  }, rows, actualBattle: { input: realInput, sameSeed, trace: liveTrace, ...liveSummary }, examples };
  const output = resolve(ROOT, options.output ?? 'docs/evidence/distributed-damage-study-2026-10-23.json');
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...data.metadata }));
  return data;
}

export async function runFocusedStudy() {
  const engine = await prepareStudyEngine();
  const profiles = [
    ['2-korsan-vs-1', { CORSAIR: 2 }, { CORSAIR: 1 }],
    ['3-korsan-vs-1-plus-argosy', { CORSAIR: 3 }, { CORSAIR: 1, ARGOSY: 1 }],
    ['5-korsan-vs-2', { CORSAIR: 5 }, { CORSAIR: 2 }],
    ['4-ok-vs-2-kargi-kurye', { DART: 4 }, { PIKE: 2, COURIER: 1 }],
    ['1-korsan-vs-10-ok', { CORSAIR: 1 }, { DART: 10 }],
    ['collectors-cargo-3x', { CORSAIR: 6, COURIER: 2, GARBAGE_COLLECTOR: 2 }, { CORSAIR: 2, COURIER: 2, GARBAGE_COLLECTOR: 2 }],
    ['support-only', { COURIER: 3, GARBAGE_COLLECTOR: 2 }, { COURIER: 1, GARBAGE_COLLECTOR: 1 }],
  ];
  const rows = [];
  for (const [id, attacker, defender] of profiles) for (const shieldLevel of [0, 4]) {
    const input = { attacker, defender, tech: shieldLevel ? { SHIP_SHIELDS: shieldLevel } : {} };
    const detail = engine.candidate(stacks(input).a, stacks(input).d, 0, mulberry32(20261023), true, true);
    rows.push({ id, shieldLevel, ...input, actualRatio: Math.max(combatValue(attacker), combatValue(defender)) / Math.max(1, Math.min(combatValue(attacker), combatValue(defender))),
      trials: 1000, ...runCase(engine, input, 1000, 0xF00C0523 ^ rows.length), example: detail });
  }
  const output = resolve(ROOT, 'docs/evidence/distributed-damage-focused-2026-10-23.json');
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify({ sourceHash: engine.sourceHash, pairedBattles: rows.length * 2000, exampleBattles: rows.length, rows }, null, 2) + '\n');
  console.log(JSON.stringify({ output, pairedBattles: rows.length * 2000 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1];
  if (process.argv.includes('--focused')) await runFocusedStudy();
  else await runStudy({ trials: option('trials') ? Number(option('trials')) : undefined,
    largeTrials: option('large-trials') ? Number(option('large-trials')) : undefined,
    hugeTrials: option('huge-trials') ? Number(option('huge-trials')) : undefined,
    output: option('output') });
}
