import test from 'node:test';
import assert from 'node:assert/strict';
import { distributedVolley, prepareRoundEngine, prepareStudyEngine } from './distributed-damage-model.mjs';
import { HULLS } from '../packages/rules/src/hulls.ts';
import { summarizeBattle, aggregateSamples } from './distributed-damage-study.mjs';
import { BASE_POLICY } from './distributed-retreat-tuning.mjs';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { buildMainCases } from './combat-four-rounds-study.mjs';

const aStack = fleet => [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } }];
const dStack = fleet => [{ stackId: 'host', playerId: 'd', fleet, tech: { tech: {} } }];

test('third-round escape is counted in four-round summaries and aggregation', () => {
  const input = { attacker: { CORSAIR: 2 }, defender: { CORSAIR: 1 } };
  const result = { grade: 'DECISIVE', attackerSurvivors: { CORSAIR: 2 }, defenderSurvivors: { CORSAIR: 1 },
    attackerRetreated: {}, defenderRetreated: { CORSAIR: 1 }, attackerLosses: {}, defenderLosses: {},
    rounds: [{ round: 3, retreats: [{ side: 'DEFENCE', fleet: { CORSAIR: 1 } }] }] };
  const r = summarizeBattle(input, result, [], 3);
  assert.deepEqual(r.weak.escape, [0, 0, 1]);
  assert.equal(r.weak.active + r.weak.escape.reduce((sum, n) => sum + n, 0), r.weak.physical);
  assert.deepEqual(aggregateSamples([r, r], 3).weak.escape, [0, 0, 1]);
});

test('three-round configuration is bit-for-bit equal to prior distributed engine', async () => {
  const old = await prepareStudyEngine(), configured = await prepareRoundEngine(BASE_POLICY, 3);
  for (let seed = 0; seed < 16; seed++) {
    const a = aStack({ CORSAIR: 30 }), d = dStack({ CORSAIR: 20 });
    assert.deepEqual(configured.candidate(a, d, 0, mulberry32(seed), true, true), old.candidate(a, d, 0, mulberry32(seed), true, true));
  }
});

test('four rounds preserve the first two rounds exactly, allow round-three escape, never round four', async () => {
  const three = await prepareRoundEngine(BASE_POLICY, 3), four = await prepareRoundEngine(BASE_POLICY, 4);
  let thirdEscapes = 0;
  for (let seed = 0; seed < 32; seed++) {
    const a = aStack({ CORSAIR: 30 }), d = dStack({ CORSAIR: 20 });
    const base = three.candidate(a, d, 0, mulberry32(seed), true, true);
    const r = four.candidate(a, d, 0, mulberry32(seed), true, true);
    assert.deepEqual(r.rounds.slice(0, 2), base.rounds.slice(0, 2));
    assert.ok(r.rounds.length <= 4);
    for (const row of r.rounds) {
      if (row.round === 3) thirdEscapes += row.retreats.reduce((sum, own) => sum + Object.values(own.fleet).reduce((n, c) => n + c, 0), 0);
      if (row.round === 4) assert.deepEqual(row.retreats, []);
    }
  }
  assert.ok(thirdEscapes > 0);
});

test('extra round cannot rescue ships that already died; single-ship case is a control, not a balance target', async () => {
  const { candidate } = await prepareRoundEngine(BASE_POLICY, 4);
  const r = candidate(aStack({ CATACLYSM: 3 }), dStack({ CATACLYSM: 1 }), 0, mulberry32(1), true, true);
  assert.deepEqual(r.defenderSurvivors, {}); assert.deepEqual(r.defenderRetreated, {});
  assert.equal(r.rounds.length, 1);
});

test('main balance matrix excludes tiny fleets and keeps true ratios, tech levels and directions', () => {
  const cases = buildMainCases();
  assert.equal(cases.length, 400);
  assert.deepEqual([...new Set(cases.map(c => c.size))], [20, 50, 100, 200]);
  for (const c of cases) {
    assert.equal(c.actualRatio, c.ratio);
    assert.ok(Math.min(Object.values(c.attacker).reduce((s,n)=>s+n,0), Object.values(c.defender).reduce((s,n)=>s+n,0)) >= 20);
  }
});

test('independent arithmetic verifies four complete Citadel rounds, shield carry and final hull', async () => {
  const h = HULLS.CITADEL;
  assert.equal(h.atk, 445); assert.equal(h.hp, 2158);
  let hp = h.hp, shield = h.hp * .25;
  const expected = [];
  for (let round = 1; round <= 4; round++) {
    const absorbed = Math.min(shield, h.atk);
    shield -= absorbed;
    const hullDamage = h.atk - absorbed;
    hp -= hullDamage;
    expected.push({ hp, shield, absorbed, hullDamage });
  }
  assert.deepEqual(expected.map(e => e.hp), [2158, 1807.5, 1362.5, 917.5]);
  const { candidate } = await prepareRoundEngine(BASE_POLICY, 4);
  const r = candidate(aStack({ CITADEL: 1 }), dStack({ CITADEL: 1 }), 0, () => .5, true, true);
  assert.deepEqual(r.rounds.map(e => e.round), [1, 2, 3, 4]);
  for (let i = 0; i < 4; i++) {
    assert.equal(r.rounds[i].attackerRoll, 1);
    assert.equal(r.rounds[i].attackerDamage, 445);
    assert.equal(r.rounds[i].attackerShipShieldAbsorbed, Math.round(expected[i].absorbed));
    assert.equal(r.rounds[i].attackerHullDamage, Math.round(expected[i].hullDamage));
  }
  for (const lots of [r.attackerDamage, r.defenderDamage]) {
    assert.equal(lots.length, 1);
    const actualHp = h.hp * (1 - (lots[0].damageBp + lots[0].remainderBp) / 10000);
    assert.ok(Math.abs(actualHp - 917.5) < 1e-8);
  }
});

test('20 Citadels with equal shares match the independent per-unit damage budget each round', () => {
  const h = HULLS.CITADEL;
  const a = Array.from({ length: 20 }, () => ({ hull: 'CITADEL', hp: h.hp, shield: h.hp * .25, attack: h.atk, canFire: true, retreated: false, owner: 0 }));
  const d = structuredClone(a);
  const expectedHp = [2158, 1807.5, 1362.5, 917.5], expectedShield = [94.5, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const toD = distributedVolley(a, d, 1, () => 0, 0, 1);
    const toA = distributedVolley(d, a, 1, () => 0, 0, 1);
    for (const hits of [toA, toD]) {
      assert.equal(hits.baseFired, 8900);
      assert.ok(hits.hp.every(hp => Math.abs(hp - expectedHp[i]) < 1e-8));
      assert.ok(hits.shields.every(shield => Math.abs(shield - expectedShield[i]) < 1e-8));
    }
    for (let j = 0; j < 20; j++) {
      a[j].hp = toA.hp[j]; a[j].shield = toA.shields[j];
      d[j].hp = toD.hp[j]; d[j].shield = toD.shields[j];
    }
  }
});

test('real random 20-vs-20 resolver spends all four volleys and preserves their accumulated hull damage', async () => {
  const { candidate } = await prepareRoundEngine(BASE_POLICY, 4), h = HULLS.CITADEL;
  const r = candidate(aStack({ CITADEL: 20 }), dStack({ CITADEL: 20 }), 0, () => .5, true, true);
  assert.equal(r.rounds.length, 4);
  assert.deepEqual(r.attackerSurvivors, { CITADEL: 20 }); assert.deepEqual(r.defenderSurvivors, { CITADEL: 20 });
  assert.ok(r.rounds.every(round => round.attackerDamage === 8900 && round.defenderDamage === 8900));
  for (const lots of [r.attackerDamage, r.defenderDamage]) {
    const lostHp = lots.reduce((sum, lot) => sum + lot.count * h.hp * (lot.damageBp + (lot.remainderBp ?? 0)) / 10000, 0);
    assert.ok(Math.abs(lostHp - (4 * 20 * 445 - 20 * 539.5)) < 1e-6);
    assert.ok(Math.abs((20 * h.hp - lostHp) / 20 - 917.5) < 1e-8);
  }
});

test('six-round model is independent of cached four-round model and escapes only before its last round', async () => {
  const none = BASE_POLICY.map(row => ({ ...row, weak: { ...row.weak, chance: 0 }, strong: { ...row.strong, chance: 0 } }));
  const four = await prepareRoundEngine(none, 4), six = await prepareRoundEngine(none, 6);
  const a = aStack({ CITADEL: 20 }), d = dStack({ CITADEL: 20 });
  const r4 = four.candidate(a, d, 0, () => .5, true, true);
  const r6 = six.candidate(a, d, 0, () => .5, true, true);
  assert.equal(r4.rounds.length, 4); assert.equal(r6.rounds.length, 6);
  assert.deepEqual(r6.rounds.slice(0, 4), r4.rounds);
  assert.equal(r6.rounds[5].round, 6); assert.deepEqual(r6.rounds[5].retreats, []);
  const damage = r6.defenderDamage.reduce((sum, lot) => sum + lot.count * HULLS.CITADEL.hp * (lot.damageBp + (lot.remainderBp ?? 0)) / 10000, 0);
  // Death consumes full hull HP too; final wound lots contain only living ships.
  const deadHp = (r6.defenderLosses.CITADEL ?? 0) * HULLS.CITADEL.hp;
  assert.ok(r6.rounds.every(round => round.attackerDamage === 8900));
  assert.ok(Math.abs(damage + deadHp - (6 * 20 * 445 - 20 * 539.5)) < 1e-6);
});
