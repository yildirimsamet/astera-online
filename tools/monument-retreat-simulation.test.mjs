import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ALL_HULLS, HULLS, hullTech, mulberry32, resolveBattle, resolveMonumentCombat, shipShieldMult } from '../packages/rules/src/index.ts';
import { retreatSide, prepareEngine, sampleBattle, summarize } from './monument-retreat-simulation.mjs';
import { simulateRandomBattle } from './monument-random-target-model.mjs';
import { retreatProbabilities, adaptiveRetreatPolicy } from './monument-escape-policy.mjs';

const stat = { hp: () => 100, shield: () => 0 };
const key = 'CORSAIR:100:0';
const setup = (hpLeft, count = 1) => ({
  fleets: [{ CORSAIR: count }], stats: [stat], ids: ['a'],
  wounded: [new Map([['CORSAIR', [{ count, hpLeft }]]])], carry: new Map(),
});
const run = (side, rng = () => 0) => retreatSide(side, rng, { threshold: 0.3, chance: 0.5 });

test('adaptive policy implements every approved probability, HP threshold and tier boundary', () => {
  for (const [n, chanceW, hpW, chanceS, hpS] of [
    [100, 0.25, 0.25, 0.25, 0.25], [149, 0.25, 0.25, 0.25, 0.25],
    [150, 0.33, 0.3, 0.2, 0.3], [199, 0.33, 0.3, 0.2, 0.3],
    [200, 0.5, 0.5, 0.15, 0.3], [299, 0.5, 0.5, 0.15, 0.3],
    [300, 0.75, 0.7, 0.1, 0.25], [500, 0.75, 0.7, 0.1, 0.25],
  ]) {
    const p = adaptiveRetreatPolicy({ CORSAIR: n }, { CORSAIR: 100 });
    assert.deepEqual(p.attacker, { chance: chanceS, threshold: hpS });
    assert.deepEqual(p.defender, { chance: chanceW, threshold: hpW });
    const reverse = adaptiveRetreatPolicy({ CORSAIR: 100 }, { CORSAIR: n });
    assert.deepEqual(reverse.attacker, p.defender);
    assert.deepEqual(reverse.defender, p.attacker);
  }
});

test('adaptive power excludes cargo; two cargo-only sides are equal, one unarmed side is weaker', () => {
  const p = adaptiveRetreatPolicy({ CORSAIR: 3, ARGOSY: 999 }, { CORSAIR: 1 });
  assert.deepEqual(p, adaptiveRetreatPolicy({ CORSAIR: 3 }, { CORSAIR: 1, ARGOSY: 999 }));
  assert.deepEqual(adaptiveRetreatPolicy({ ARGOSY: 3 }, { ARGOSY: 1 }).attacker, { chance: 0.25, threshold: 0.25 });
  assert.deepEqual(adaptiveRetreatPolicy({ CORSAIR: 1 }, { ARGOSY: 10 }).defender, { chance: 0.75, threshold: 0.7 });
});

test('adaptive equal Corsairs escape only at <=25% hull HP, not at the old 50% threshold', () => {
  for (let seed = 0; seed < 32; seed++) {
    const r = simulateRandomBattle({ attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 } },
      { rounds: 3, targeting: 'random_live', escapePolicy: 'adaptive', shieldFraction: 0.25 }, seed);
    assert.equal(r.a.fled + r.d.fled, 0);
    assert.equal(r.rounds, 3);
  }
});

test('adaptive 3:1 permits weak ships at <=70%, while stronger ships only flee at <=25%', () => {
  let highHpEscape = 0;
  for (let seed = 0; seed < 64; seed++) {
    const r = simulateRandomBattle({ attacker: { CORSAIR: 30 }, defender: { CORSAIR: 10 } },
      { rounds: 3, targeting: 'random_live', escapePolicy: 'adaptive', shieldFraction: 0.25 }, seed);
    for (const row of r.a.damage) assert.ok(row.hpLeft / row.maxHp <= 0.25 + 1e-12);
    for (const row of r.d.damage) {
      assert.ok(row.hpLeft / row.maxHp <= 0.7 + 1e-12);
      highHpEscape += Number(row.hpLeft / row.maxHp > 0.5);
    }
    for (const side of [r.a, r.d]) assert.equal(side.sent, side.active + side.fled + side.dead);
  }
  assert.ok(highHpEscape > 0);
});

test('adaptive CLI selects the new policy while keeping base shield at 25%', () => {
  const output = JSON.parse(execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke', '--shield-25', '--adaptive-escape'],
  { encoding: 'utf8', timeout: 10000 }));
  assert.equal(output.escapePolicy, 'adaptive');
  assert.equal(output.shieldFraction, 0.25);
});

test('revised adaptive policy changes only weak side in 2x and 3x bands, preserving old study', () => {
  for (const [n, chance, threshold] of [[100, 0.25, 0.25], [150, 0.33, 0.3],
    [199, 0.33, 0.3], [200, 0.55, 0.55], [250, 0.55, 0.55], [299, 0.55, 0.55],
    [300, 0.7, 0.7], [500, 0.7, 0.7]]) {
    const a = { CORSAIR: n }, d = { CORSAIR: 100 };
    const revised = adaptiveRetreatPolicy(a, d, { revised: true });
    const original = adaptiveRetreatPolicy(a, d);
    assert.deepEqual(revised.defender, { chance, threshold });
    assert.deepEqual(revised.attacker, original.attacker);
    if (n < 200) assert.deepEqual(revised, original);
    const reverse = adaptiveRetreatPolicy(d, a, { revised: true });
    assert.deepEqual(reverse.attacker, revised.defender);
    assert.deepEqual(reverse.defender, revised.attacker);
  }
});

test('revised adaptive CLI opts into v2 without changing the first adaptive policy', () => {
  const output = JSON.parse(execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke', '--shield-25', '--adaptive-escape-v2'],
  { encoding: 'utf8', timeout: 10000 }));
  assert.equal(output.escapePolicy, 'adaptive-v2');
  assert.equal(output.shieldFraction, 0.25);
});

test('review: an attacker arriving with <=5% HP cannot capture using its inactive warship', () => {
  for (const damageBp of [9500, 9600]) for (const defender of [{ ARGOSY: 1 }, {}]) {
    const input = { attacker: { CORSAIR: 1 }, defender,
      attackerDamage: [{ hull: 'CORSAIR', count: 1, damageBp }] };
    const actual = simulateRandomBattle(input, { rounds: 3, targeting: 'random_live',
      shieldFraction: 0.25, escapePolicy: 'adaptive' }, 7);
    const expected = resolveMonumentCombat([
      { contributionId: 'a', playerId: 'a', fleet: input.attacker, damage: input.attackerDamage,
        tech: { tech: {}, shipShields: false } },
    ], [{ stackId: 'd', playerId: 'd', fleet: defender, tech: { tech: {}, shipShields: false } }], mulberry32(7), true);
    assert.equal(actual.control, expected.control);
    assert.equal(actual.a.physical, 1);
    assert.equal(actual.a.fled, 0);
  }
});

test('standalone simulation CLI completes without an import-cycle deadlock', () => {
  const output = execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke'], { encoding: 'utf8', timeout: 10000 });
  const result = JSON.parse(output);
  assert.equal(result.control, 'ATTACKER');
  assert.equal(result.a.sent, 3);
});

test('50% threshold CLI opt-in reaches the simulation without replacing the 30% default', () => {
  const cli = extra => JSON.parse(execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke', ...extra], { encoding: 'utf8', timeout: 10000 }));
  assert.equal(cli(['--threshold-50']).threshold, 0.5);
  assert.equal(cli([]).threshold, 0.3);
});

test('50% HP is inclusive, above it excluded, and fleeing never heals a wound', () => {
  const at = setup(50), above = setup(50.001), dead = setup(0);
  const options = { threshold: 0.5, chance: 1 };
  assert.equal(retreatSide(at, () => 0, options)[0].hpLeft, 50);
  assert.deepEqual(retreatSide(above, () => 0, options), []);
  assert.deepEqual(retreatSide(dead, () => 0, options), []);
  // 1% arrival wound makes the first hit cross 50% even at the minimum attack roll.
  const input = { attacker: { CORSAIR: 2 }, defender: { CORSAIR: 1 },
    defenderDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 100 }] };
  const config = { rounds: 3, targeting: 'random_live', chance: 1, threshold: 0.5 };
  const r = simulateRandomBattle(input, config, 7);
  assert.equal(r.d.fled, 1);
  assert.equal(r.rounds, 1);
  assert.ok(r.d.damage[0].hpLeft > r.d.damage[0].maxHp * 0.3);
  assert.ok(r.d.damage[0].hpLeft <= r.d.damage[0].maxHp * 0.5);
});

test('25% shield CLI opt-in keeps 50% escape threshold and leaves the default shieldless', () => {
  const cli = extra => JSON.parse(execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke', '--threshold-50', ...extra], { encoding: 'utf8', timeout: 10000 }));
  const shielded = cli(['--shield-25']);
  assert.equal(shielded.shieldFraction, 0.25);
  assert.equal(shielded.threshold, 0.5);
  assert.equal(cli([]).shieldFraction, 0);
});

test('25% shields absorb first, retain depleted state over rounds and never heal hull HP', () => {
  const seed = 7, rng = mulberry32(seed), maxHp = HULLS.CORSAIR.hp, atk = HULLS.CORSAIR.atk;
  const r = simulateRandomBattle({ attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 } },
    { rounds: 3, chance: 0, targeting: 'random_live', shieldFraction: 0.25, trace: true }, seed);
  let hp = maxHp, shield = maxHp * 0.25;
  for (let round = 0; round < 3; round++) {
    rng(); // attacker variance
    const fire = atk * (0.92 + rng() * 0.16), absorbed = Math.min(shield, fire);
    shield -= absorbed;
    hp -= fire - absorbed;
    assert.ok(Math.abs(r.trace[round].aHp[0] - hp) < 1e-8);
    assert.ok(Math.abs(r.trace[round].aShield[0] - shield) < 1e-8);
    assert.equal(r.trace[round].aMaxShield[0], maxHp * 0.25);
  }
});

test('shield capacity is researched maximum HP; arrival radiation wounds remain on hull', () => {
  const tech = { SHIP_ARMOR: 5, SHIP_SHIELDS: 4 };
  const input = { attacker: { ARGOSY: 1 }, defender: { ARGOSY: 1 },
    attackerTech: tech, attackerDamage: [{ hull: 'ARGOSY', count: 1, damageBp: 8000 }] };
  const r = simulateRandomBattle(input, { rounds: 1, chance: 0, targeting: 'random', shieldFraction: 0.25, trace: true }, 9);
  const maxHp = HULLS.ARGOSY.hp * hullTech(tech, 'ARGOSY').hp;
  assert.equal(r.trace[0].aShield[0], maxHp * 0.25);
  assert.ok(Math.abs(r.trace[0].aHp[0] - maxHp * 0.2) < 1e-8);
});

test('live targets include shield HP; destroying a shield alone cannot remove a target', () => {
  // A Pike shot always exceeds an unshielded Pike HP but cannot kill HP + 25% shield.
  const r = simulateRandomBattle({ attacker: { PIKE: 1 }, defender: { PIKE: 1 } },
    { rounds: 1, chance: 0, targeting: 'random_live', shieldFraction: 0.25, trace: true }, 9);
  assert.equal(r.a.dead + r.d.dead, 0);
  assert.ok(r.trace[0].aHp[0] > 0);
  assert.ok(r.trace[0].aHp[0] < HULLS.PIKE.hp);
  assert.equal(r.trace[0].aShield[0], 0);
});

test('shielded targets need two Pike hits; only the fifth remaining shot can hit cargo', () => {
  const input = { attacker: { PIKE: 5 }, defender: { PIKE: 2, ARGOSY: 1 } };
  const r = simulateRandomBattle(input, { rounds: 1, chance: 0, targeting: 'random_live',
    shieldFraction: 0.25, trace: true }, 9);
  assert.equal(r.trace[0].aShots, 5);
  assert.equal(r.trace[0].dShots, 2); // both defenders retain simultaneous fire rights
  assert.equal(r.d.armed.dead, 2);
  assert.ok(r.trace[0].dShield[2] < HULLS.ARGOSY.hp * 0.25);
  assert.equal(r.trace[0].dHp[2], HULLS.ARGOSY.hp);
});

test('shielded escape compares hull HP only and preserves the escaped wound', () => {
  const input = { attacker: { CORSAIR: 2 }, defender: { CORSAIR: 1 } };
  const r = simulateRandomBattle(input, { rounds: 3, chance: 1, threshold: 0.5,
    targeting: 'random_live', shieldFraction: 0.25, trace: true }, 7);
  assert.equal(r.rounds, 2);
  assert.equal(r.d.fled, 1);
  assert.equal(r.d.damage[0].hpLeft, r.trace[1].dHp[0]);
  assert.ok(r.trace[0].dHp[0] > HULLS.CORSAIR.hp * 0.5);
  assert.ok(r.trace[1].dHp[0] > 0 && r.trace[1].dHp[0] <= HULLS.CORSAIR.hp * 0.5);
});

test('25% base shield follows the existing L0-L4 ladder only when explicitly enabled', () => {
  for (const [level, multiplier] of [[0, 1], [1, 1.25], [2, 1.5], [3, 1.7], [4, 2]]) {
    assert.equal(shipShieldMult({ SHIP_SHIELDS: level }), multiplier);
    const input = { attacker: { ARGOSY: 1 }, defender: { ARGOSY: 1 },
      attackerTech: { SHIP_ARMOR: 5, SHIP_SHIELDS: level }, defenderTech: { SHIP_SHIELDS: 4 } };
    const r = simulateRandomBattle(input, { rounds: 1, chance: 0, targeting: 'random',
      shieldFraction: 0.25, shieldResearch: true, trace: true }, 9);
    assert.equal(r.trace[0].aMaxShield[0], HULLS.ARGOSY.hp * hullTech(input.attackerTech, 'ARGOSY').hp * 0.25 * multiplier);
    assert.equal(r.trace[0].dMaxShield[0], HULLS.ARGOSY.hp * 0.5);
    const legacy = simulateRandomBattle(input, { rounds: 1, chance: 0, targeting: 'random',
      shieldFraction: 0.25, trace: true }, 9);
    assert.equal(legacy.trace[0].dMaxShield[0], HULLS.ARGOSY.hp * 0.25);
  }
});

test('equal L4 shields on a 25% base exactly match a fixed 50% shield, including wounds and escape', () => {
  const input = { attacker: { CORSAIR: 30, CATACLYSM: 10, ARGOSY: 3 }, defender: { CORSAIR: 20, ARGOSY: 2 },
    attackerTech: { SHIP_SHIELDS: 4, SHIP_POWER: 2 }, defenderTech: { SHIP_SHIELDS: 4, SHIP_ARMOR: 3 },
    defenderDamage: [{ hull: 'CORSAIR', count: 3, damageBp: 7000 }] };
  const config = { rounds: 3, threshold: 0.5, targeting: 'random_live', escapePolicy: 'ratio', trace: true };
  for (let seed = 0; seed < 32; seed++) assert.deepEqual(
    simulateRandomBattle(input, { ...config, shieldFraction: 0.25, shieldResearch: true }, seed),
    simulateRandomBattle(input, { ...config, shieldFraction: 0.5 }, seed));
});

test('L4 shield CLI explicitly models both commanders at level 4 with the 25% base', () => {
  const output = JSON.parse(execFileSync(process.execPath, ['--v8-pool-size=1', '--import', 'tsx',
    'tools/monument-retreat-simulation.mjs', '--smoke', '--threshold-50', '--shield-25', '--shield-research-4'],
  { encoding: 'utf8', timeout: 10000 }));
  assert.equal(output.shieldResearchLevel, 4);
  assert.equal(output.shieldFraction, 0.25);
  assert.equal(output.threshold, 0.5);
});

test('analytical L4 Corsair 3v1: shield delays the escape window, corpses cannot flee', () => {
  const input = { attacker: { CORSAIR: 3 }, defender: { CORSAIR: 1 },
    attackerTech: { SHIP_SHIELDS: 4 }, defenderTech: { SHIP_SHIELDS: 4 } };
  const hp = HULLS.CORSAIR.hp, shot = HULLS.CORSAIR.atk;
  for (let seed = 0; seed < 1000; seed++) {
    const fire = mulberry32(seed), retreat = mulberry32(seed ^ 0x78E5CA9E);
    const first = 3 * shot * (0.92 + fire() * 0.16);
    fire(); // simultaneous defender shot cannot kill any of the three attackers
    const second = 3 * shot * (0.92 + fire() * 0.16);
    const afterFirst = hp * 1.5 - first;
    assert.ok(afterFirst > hp * 0.5); // no round-one escape opportunity
    const expectedFled = Number(hp * 1.5 - first - second > 0 && retreat() < 0.75);
    const r = simulateRandomBattle(input, { rounds: 3, threshold: 0.5, targeting: 'random_live',
      escapePolicy: 'ratio', shieldFraction: 0.25, shieldResearch: true }, seed);
    assert.equal(r.d.fled, expectedFled);
    assert.equal(r.d.dead, 1 - expectedFled);
    assert.equal(r.control, 'ATTACKER');
  }
});

test('30% inclusive, above threshold and dead ships excluded; each eligible ship rolls', () => {
  const at = setup(30, 3);
  let rolls = 0;
  const escaped = run(at, () => [0.1, 0.5, 0.49][rolls++]);
  assert.equal(rolls, 3);
  assert.equal(escaped.reduce((n, row) => n + row.count, 0), 2);
  assert.equal(at.fleets[0].CORSAIR, 1);
  assert.equal(at.wounded[0].get('CORSAIR')[0].count, 1);
  for (const hp of [30.01, 100, 0, -1]) assert.deepEqual(run(setup(hp)), []);
});

test('partial healthy-cohort wound escapes once, clearing carry without healing others', () => {
  const side = { fleets: [{ CORSAIR: 5 }], stats: [stat], ids: ['a'], wounded: [new Map()], carry: new Map([[key, 70]]) };
  const escaped = run(side);
  assert.equal(escaped[0].hpLeft, 30);
  assert.equal(escaped[0].maxHp, 100);
  assert.equal(side.fleets[0].CORSAIR, 4);
  assert.equal(side.carry.has(key), false);
  assert.deepEqual(run(side), []);
});

test('cohort partial ship belongs to largest healthy owner, stable id breaks ties', () => {
  const side = { fleets: [{ CORSAIR: 2 }, { CORSAIR: 3 }], stats: [stat, stat], ids: ['z', 'a'],
    wounded: [new Map(), new Map()], carry: new Map([[key, 80]]) };
  assert.equal(run(side)[0].index, 1);
  assert.deepEqual(side.fleets, [{ CORSAIR: 2 }, { CORSAIR: 2 }]);
  side.carry.set(key, 80);
  assert.equal(run(side)[0].index, 1);
});

test('chance zero preserves all internal state, ground guns never escape', () => {
  const side = setup(10, 5), before = structuredClone({ fleets: side.fleets, wounded: side.wounded });
  assert.deepEqual(retreatSide(side, () => { throw new Error('unexpected roll'); }, { threshold: 0.3, chance: 0 }), []);
  assert.deepEqual(side.fleets, before.fleets);
  assert.deepEqual(side.wounded, before.wounded);
  const ground = { fleets: [{ BASTION: 1 }], stats: [stat], ids: ['a'],
    wounded: [new Map([['BASTION', [{ count: 1, hpLeft: 10 }]]])], carry: new Map() };
  assert.deepEqual(run(ground), []);
});

test('independent seeded escape draws approximate 50%, including large injured lots', () => {
  const side = setup(20, 10000);
  const n = run(side, mulberry32(721)).reduce((sum, row) => sum + row.count, 0);
  assert.ok(n > 4800 && n < 5200);
});

test('shadow resolver with disabled retreat exactly matches real MONUMENT path', async () => {
  const engine = await prepareEngine();
  for (const shipShields of [false, true]) for (const n of [1, 2, 10, 100]) {
    const tech = { tech: { SHIP_POWER: 2, SHIP_ARMOR: 2 }, shipShields };
    const a = [{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: n * 2, ARGOSY: 1 }, tech }];
    const d = [{ stackId: 'd', playerId: 'd', fleet: { CORSAIR: n, ARGOSY: 1 },
      damage: [{ hull: 'CORSAIR', count: 1, damageBp: 3100, remainderBp: 0.4 }], tech }];
    for (let seed = 0; seed < 16; seed++) {
      engine.options.rounds = 3; engine.options.chance = 0;
      const { audit, ...actual } = engine.resolve(a, d, 0, mulberry32(seed), 'MONUMENT', true);
      assert.deepEqual(actual, resolveBattle(a, d, 0, mulberry32(seed), 'MONUMENT', true));
      assert.deepEqual(audit.fledA, []);
    }
  }
});

test('simultaneous fire precedes retreat; both eligible sides can leave EMPTY', async () => {
  const engine = await prepareEngine();
  const input = { attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 },
    attackerDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 7000 }],
    defenderDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 7000 }] };
  const result = sampleBattle(engine, input, { rounds: 100, chance: 1, threshold: 0.3 }, 7);
  assert.equal(result.control, 'EMPTY');
  assert.equal(result.rounds, 1);
  assert.equal(result.a.fled, 1);
  assert.equal(result.d.fled, 1);
  assert.equal(result.a.dead + result.d.dead, 0);
  assert.equal(result.a.damage[0].hpLeft < 0.3 * result.a.damage[0].maxHp, true);
});

test('owner clarification: only first and second rounds permit retreat, never third', async () => {
  const engine = await prepareEngine();
  // Runtime Corsair: 1508 HP, 408 attack. Only round three crosses the 30% HP threshold.
  const result = sampleBattle(engine, { attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 } },
    { rounds: 3, chance: 1, threshold: 0.3 }, 7);
  assert.equal(result.rounds, 3);
  assert.equal(result.a.fled + result.d.fled, 0);
  assert.equal(result.a.active, 1);
  assert.equal(result.d.active, 1);
});

test('escape conserves both sides, physical survivors include fled; repeat is deterministic', async () => {
  const engine = await prepareEngine();
  const input = { attacker: { CORSAIR: 30 }, defender: { CORSAIR: 10 } };
  const before = structuredClone(input), config = { rounds: 100, chance: 0.5, threshold: 0.3 };
  for (let seed = 0; seed < 100; seed++) {
    const result = sampleBattle(engine, input, config, seed);
    assert.deepEqual(result, sampleBattle(engine, input, config, seed));
    for (const side of [result.a, result.d]) {
      assert.equal(side.active + side.fled + side.dead, side.sent);
      assert.equal(side.physical, side.active + side.fled);
      assert.ok(side.damage.every(row => row.hpLeft > 0 && row.hpLeft <= row.maxHp));
    }
    assert.ok(result.rounds < 100);
  }
  assert.deepEqual(input, before);
});

test('summary includes zero survivors and separates unresolved fights from true losers', () => {
  const side = (physical, active, sent = 10) => ({ physical, active, sent, fled: physical - active });
  const s = summarize([
    { a: side(10, 10), d: side(0, 0), control: 'ATTACKER', rounds: 2 },
    { a: side(10, 10), d: side(2, 0), control: 'ATTACKER', rounds: 3 },
    { a: side(8, 8), d: side(8, 8), control: 'DEFENDER', rounds: 3 },
  ], 3);
  assert.equal(s.defender.meanRemaining, 1 / 3);
  assert.equal(s.defender.aliveProbability, 2 / 3);
  assert.equal(s.loser.meanRemaining, 1 / 3);
  assert.equal(s.roundLimitProbability, 1 / 3);
  assert.equal(s.eitherWipedProbability, 1 / 3);
});

test('random target: simultaneous lethal shots, no corpse escape or free healing', () => {
  const input = { attacker: { CATACLYSM: 1 }, defender: { CATACLYSM: 1 } };
  const result = simulateRandomBattle(input, { rounds: 3, chance: 0.5 }, 9);
  assert.equal(result.a.dead, 1);
  assert.equal(result.d.dead, 1);
  assert.equal(result.a.fled + result.d.fled, 0);
  assert.equal(result.control, 'EMPTY');
});

test('random target: cumulative wounds persist and third-round escape is prohibited', () => {
  const result = simulateRandomBattle({ attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 } },
    { rounds: 3, chance: 1, trace: true }, 7);
  assert.equal(result.a.fled + result.d.fled, 0);
  assert.equal(result.rounds, 3);
  for (let i = 1; i < 3; i++) assert.ok(result.trace[i].aHp[0] < result.trace[i - 1].aHp[0]);
  assert.ok(result.trace[2].aHp[0] < 400);
});

test('random target: escaped ships retain HP and cannot fire or receive fire next round', () => {
  const input = { attacker: { CORSAIR: 1 }, defender: { CORSAIR: 2 },
    defenderDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 7000 }] };
  const result = simulateRandomBattle(input, { rounds: 3, chance: 1, trace: true }, 7);
  assert.equal(result.d.fled, 1);
  assert.ok(result.d.damage[0].hpLeft <= result.d.damage[0].maxHp * 0.3);
  assert.equal(result.trace[0].dShots, 2);
  assert.equal(result.trace[1].dShots, 1);
  assert.equal(result.trace[1].dHp[0], result.trace[0].dHp[0]);
});

test('random target: cargo covered by combat hulls; arrivals below 5% cannot fire', () => {
  const input = { attacker: { CORSAIR: 2, ARGOSY: 1 }, defender: { CORSAIR: 2, ARGOSY: 1 },
    attackerDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 9600 }] };
  const result = simulateRandomBattle(input, { rounds: 1, chance: 0, trace: true }, 17);
  assert.equal(result.trace[0].aShots, 1);
  assert.equal(result.trace[0].aHp[2], result.trace[0].aMaxHp[2]);
  assert.equal(result.trace[0].dHp[2], result.trace[0].dMaxHp[2]);
});

test('random target: deterministic counts, inputs untouched, conservation across sizes', () => {
  for (const size of [1, 10, 1000]) {
    const input = { attacker: { CORSAIR: size * 3 }, defender: { CORSAIR: size } };
    const copy = structuredClone(input);
    const config = { rounds: 3, chance: 0.5 };
    const result = simulateRandomBattle(input, config, 193);
    assert.deepEqual(result, simulateRandomBattle(input, config, 193));
    for (const side of [result.a, result.d]) {
      assert.equal(side.sent, side.active + side.dead + side.fled);
      assert.equal(side.physical, side.active + side.fled);
    }
    assert.deepEqual(input, copy);
  }
});

test('random target 1v1 matches real engine across classes, tiers and research', async () => {
  const engine = await prepareEngine();
  const hulls = ALL_HULLS.filter(hull => !HULLS[hull].ground && HULLS[hull].tier && HULLS[hull].atk > 0);
  for (const a of hulls) for (const d of hulls) for (const tech of [{}, { SHIP_POWER: 5, SHIP_ARMOR: 3 }]) {
    const input = { attacker: { [a]: 1 }, defender: { [d]: 1 }, attackerTech: tech, defenderTech: tech };
    for (let seed = 0; seed < 8; seed++) {
      const config = { rounds: 3, chance: 0 };
      const original = sampleBattle(engine, input, config, seed);
      const random = simulateRandomBattle(input, config, seed);
      assert.equal(random.control, original.control);
      assert.equal(random.rounds, original.rounds);
      for (const [side, hull] of [['a', a], ['d', d]]) {
        assert.equal(random[side].physical, original[side].physical);
        const maxHp = HULLS[hull].hp * hullTech(tech, hull).hp;
        const expectedHp = original[side].active * maxHp - original[side].activeDamage.reduce((sum, lot) =>
          sum + lot.count * maxHp * (lot.damageBp + (lot.remainderBp ?? 0)) / 10000, 0);
        const actualHp = random[side].activeDamage.length ? random[side].activeDamage[0].hpLeft : random[side].active * maxHp;
        assert.ok(Math.abs(expectedHp - actualHp) < 1e-7);
      }
    }
  }
});

test('analytical oracle: 3 healthy Corsairs vs 1, weak ship has exactly one 50% escape opportunity', () => {
  // Runtime table includes the Fleet V2 stat transform, not just authored literals.
  // 3 * 408 * [0.92,1.08] = 1126.08..1321.92. Remaining HP=186.08..381.92:
  // always alive and <=30% after round one; dead in round two if it did not flee.
  let survived = 0;
  for (let seed = 0; seed < 10000; seed++) {
    const result = simulateRandomBattle({ attacker: { CORSAIR: 3 }, defender: { CORSAIR: 1 } },
      { rounds: 3, chance: 0.5 }, seed);
    assert.equal(result.control, 'ATTACKER');
    assert.equal(result.a.dead + result.a.fled, 0);
    survived += result.d.physical;
    if (result.d.fled) assert.ok(result.d.damage[0].hpLeft >= 186.08 - 1e-8 && result.d.damage[0].hpLeft <= 381.92 + 1e-8);
  }
  assert.ok(survived > 4800 && survived < 5200);
});

test('random frozen targets: uniform selection wastes overlapping lethal shots within a round', () => {
  let dead = 0;
  for (let seed = 0; seed < 10000; seed++) {
    const r = simulateRandomBattle({ attacker: { PIKE: 2 }, defender: { PIKE: 2 } },
      { rounds: 1, chance: 0 }, seed);
    dead += r.d.dead;
    assert.equal(r.d.fled, 0);
  }
  // Two independent shots into two targets: 50% hit both, 50% hit the same.
  assert.ok(dead > 14800 && dead < 15200);
});

test('live target selection: later shots skip destroyed targets, both sides still fire simultaneously', () => {
  const r = simulateRandomBattle({ attacker: { PIKE: 2 }, defender: { PIKE: 2 } },
    { rounds: 1, chance: 0.5, targeting: 'random_live', trace: true }, 9);
  assert.equal(r.a.dead, 2);
  assert.equal(r.d.dead, 2);
  assert.equal(r.trace[0].aShots, 2);
  assert.equal(r.trace[0].dShots, 2);
});

test('cargo last: only shots remaining after the combat line dies hit cargo in that SAME round', () => {
  const input = { attacker: { CATACLYSM: 2 }, defender: { DART: 1, ARGOSY: 1 } };
  const config = { rounds: 1, chance: 0, trace: true };
  const frozen = simulateRandomBattle(input, config, 7);
  const live = simulateRandomBattle(input, { ...config, targeting: 'random_live' }, 7);
  assert.equal(frozen.trace[0].dHp[1], frozen.trace[0].dMaxHp[1]);
  assert.ok(live.trace[0].dHp[1] < live.trace[0].dMaxHp[1]);
  assert.equal(live.trace[0].dShots, 1);
  assert.equal(live.d.armed.sent, 1);
  assert.equal(live.d.armed.physical, 0);
});

test('cargo-only sides do not fire or flee from a non-battle, defender retains control and wounds', () => {
  const input = { attacker: { ARGOSY: 1 }, defender: { ARGOSY: 1 },
    defenderDamage: [{ hull: 'ARGOSY', count: 1, damageBp: 7000 }] };
  const result = simulateRandomBattle(input, { rounds: 3, chance: 1, targeting: 'random_live' }, 7);
  assert.equal(result.control, 'DEFENDER');
  assert.equal(result.a.armed.sent + result.d.armed.sent, 0);
  assert.equal(result.rounds, 0);
  assert.equal(result.d.fled, 0);
  assert.ok(Math.abs(result.d.activeDamage[0].hpLeft / result.d.activeDamage[0].maxHp - 0.3) < 1e-12);
});

test('live model canonicalizes identical fleets, so JSON key order cannot change the battle', () => {
  const first = { attacker: { CORSAIR: 5, PALADIN: 2 }, defender: { CORSAIR: 3, PALADIN: 2, ARGOSY: 1 } };
  const reverse = { attacker: { PALADIN: 2, CORSAIR: 5 }, defender: { ARGOSY: 1, PALADIN: 2, CORSAIR: 3 } };
  const config = { rounds: 1, chance: 0.5, targeting: 'random_live' };
  for (let seed = 0; seed < 32; seed++) assert.deepEqual(simulateRandomBattle(first, config, seed), simulateRandomBattle(reverse, config, seed));
});

test('live model randomizes firing order so one hull class does not always fire first', () => {
  let corsairFirst = 0;
  for (let seed = 0; seed < 100; seed++) {
    const result = simulateRandomBattle({ attacker: { CORSAIR: 3, PALADIN: 1 }, defender: { CORSAIR: 10 } },
      { rounds: 1, chance: 0, targeting: 'random_live', trace: true }, seed);
    assert.ok(['CORSAIR', 'PALADIN'].includes(result.trace[0].aFirstShooter));
    corsairFirst += Number(result.trace[0].aFirstShooter === 'CORSAIR');
  }
  assert.ok(corsairFirst > 55 && corsairFirst < 90);
});

test('surviving cargo never masks wiped warships in the reported metrics', () => {
  const armedA = { sent: 1, active: 1, fled: 0, physical: 1, dead: 0 };
  const armedD = { sent: 1, active: 0, fled: 0, physical: 0, dead: 1 };
  const s = summarize([{ control: 'ATTACKER', rounds: 3,
    a: { sent: 2, active: 2, fled: 0, physical: 2, armed: armedA },
    d: { sent: 2, active: 1, fled: 0, physical: 1, armed: armedD } }], 3);
  assert.equal(s.defender.meanRemaining, 0.5);
  assert.equal(s.defender.armed.meanRemaining, 0);
  assert.equal(s.eitherArmedWipedProbability, 1);
});

test('approved ratio policy: weak side 25/50/75, strong side always 25, exact tie 25 each', () => {
  for (const [n, m, weakChance] of [[100, 100, 0.25], [149, 100, 0.25], [150, 100, 0.5],
    [200, 100, 0.5], [299, 100, 0.5], [300, 100, 0.75], [500, 100, 0.75]]) {
    const a = { CORSAIR: n }, d = { CORSAIR: m };
    const chance = retreatProbabilities(a, d);
    assert.equal(chance.attacker, 0.25);
    assert.equal(chance.defender, weakChance);
    const reverse = retreatProbabilities(d, a);
    assert.equal(reverse.attacker, weakChance);
    assert.equal(reverse.defender, 0.25);
  }
});

test('ratio policy excludes cargo from strength and handles zero combat power', () => {
  assert.deepEqual(retreatProbabilities({ CORSAIR: 3, ARGOSY: 200 }, { CORSAIR: 1 }),
    retreatProbabilities({ CORSAIR: 3 }, { CORSAIR: 1, ARGOSY: 200 }));
  const empty = retreatProbabilities({ ARGOSY: 20 }, { ARGOSY: 1 });
  assert.equal(empty.attacker, 0.25);
  assert.equal(empty.defender, 0.25);
  const unopposed = retreatProbabilities({ CORSAIR: 1 }, { ARGOSY: 50 });
  assert.equal(unopposed.attacker, 0.25);
  assert.equal(unopposed.defender, 0.75);
});

test('ratio model: analytical Corsair 3v1 escape probability becomes 75% for weak side', () => {
  let escaped = 0;
  for (let seed = 0; seed < 10000; seed++) {
    const r = simulateRandomBattle({ attacker: { CORSAIR: 3 }, defender: { CORSAIR: 1 } },
      { rounds: 3, targeting: 'random_live', escapePolicy: 'ratio' }, seed);
    escaped += r.d.fled;
    assert.equal(r.control, 'ATTACKER');
  }
  assert.ok(escaped > 7300 && escaped < 7700);
});

test('75% weak-side chance never saves a ship killed before the round-end escape window', () => {
  for (let seed = 0; seed < 100; seed++) {
    const r = simulateRandomBattle({ attacker: { CORSAIR: 5 }, defender: { CORSAIR: 1 } },
      { rounds: 3, targeting: 'random_live', escapePolicy: 'ratio' }, seed);
    assert.equal(r.d.dead, 1);
    assert.equal(r.d.fled, 0);
  }
});

test('surviving eligible ships receive a fresh independent chance in the second escape window', () => {
  const side = setup(20, 10000), rng = mulberry32(391);
  const first = run(side, rng).reduce((sum, row) => sum + row.count, 0);
  const second = run(side, rng).reduce((sum, row) => sum + row.count, 0);
  // 50% of the original survive window one; half of the remainder flee in window two.
  assert.ok(first > 4800 && first < 5200);
  assert.ok(second > 2300 && second < 2700);
  assert.ok(first + second > 7300 && first + second < 7700);
  assert.equal(side.fleets[0].CORSAIR + first + second, 10000);
  assert.equal(side.wounded[0].get('CORSAIR')[0].hpLeft, 20);
});

test('approved live-target engine matches analytical 1v1 HP with radiation and research', async () => {
  const engine = await prepareEngine();
  for (const damageBp of [0, 3000, 7000, 9600]) for (const tech of [{}, { SHIP_POWER: 5, SHIP_ARMOR: 5 }]) {
    for (let seed = 0; seed < 32; seed++) {
      const input = { attacker: { CORSAIR: 1 }, defender: { CORSAIR: 1 }, attackerTech: tech, defenderTech: tech,
        attackerDamage: [{ hull: 'CORSAIR', count: 1, damageBp }],
        defenderDamage: [{ hull: 'CORSAIR', count: 1, damageBp: 3000 }] };
      const expected = sampleBattle(engine, input, { rounds: 3, chance: 0 }, seed);
      const actual = simulateRandomBattle(input, { rounds: 3, chance: 0, targeting: 'random_live' }, seed);
      assert.equal(actual.control, expected.control);
      for (const side of ['a', 'd']) {
        assert.equal(actual[side].dead, expected[side].dead);
        const maxHp = HULLS.CORSAIR.hp * hullTech(tech, 'CORSAIR').hp;
        const expectedHp = expected[side].active * maxHp - expected[side].activeDamage.reduce((sum, lot) =>
          sum + lot.count * maxHp * (lot.damageBp + (lot.remainderBp ?? 0)) / 10000, 0);
        const actualHp = actual[side].activeDamage.length ? actual[side].activeDamage[0].hpLeft : actual[side].active * maxHp;
        assert.ok(Math.abs(expectedHp - actualHp) < 1e-7);
      }
    }
  }
});
