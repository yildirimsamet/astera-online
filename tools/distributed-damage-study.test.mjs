import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBattle, aggregateSamples, buildCases } from './distributed-damage-study.mjs';

test('physical wipes include escaped survivors, while active wipes exclude them', () => {
  const input = { attacker: { CORSAIR: 2 }, defender: { CORSAIR: 1 } };
  const result = { grade: 'DECISIVE', attackerSurvivors: { CORSAIR: 2 }, defenderSurvivors: { CORSAIR: 1 },
    attackerRetreated: {}, defenderRetreated: { CORSAIR: 1 }, attackerLosses: {}, defenderLosses: {},
    rounds: [{ round: 1, retreats: [{ side: 'DEFENCE', fleet: { CORSAIR: 1 } }], attackerLosses: {}, defenderLosses: {} }] };
  const r = summarizeBattle(input, result);
  assert.equal(r.anyPhysicalWipe, 0); assert.equal(r.anyActiveWipe, 1);
  assert.equal(r.weak.physical, 1); assert.equal(r.weak.escape[0], 1); assert.equal(r.weak.dead, 0);
});

test('support survival cannot hide armed-fleet wipe; ground is not a mobile fleet survivor', () => {
  const input = { attacker: { CORSAIR: 1, GARBAGE_COLLECTOR: 1 }, defender: { DART: 1, THORN: 1 } };
  const result = { grade: 'REPELLED', attackerSurvivors: { GARBAGE_COLLECTOR: 1 }, defenderSurvivors: { THORN: 1 },
    attackerRetreated: {}, defenderRetreated: {}, attackerLosses: { CORSAIR: 1 }, defenderLosses: { DART: 1 }, rounds: [] };
  const r = summarizeBattle(input, result);
  assert.equal(r.anyPhysicalWipe, 1); assert.equal(r.anyArmedPhysicalWipe, 1);
  assert.equal(r.attacker.physical, 0.5); assert.equal(r.defender.physical, 0);
});

test('aggregation averages per-battle shares and does not turn flee into deaths', () => {
  const sample = { anyPhysicalWipe: 0, anyActiveWipe: 1, anyArmedPhysicalWipe: 0, bothPhysicalWipe: 0, grade: 'DECISIVE',
    weak: { physical: 0.5, active: 0, dead: 0.5, escape: [0.5, 0], eligible: [0.5, 0] },
    strong: { physical: 1, active: 1, dead: 0, escape: [0, 0], eligible: [0, 0] } };
  const r = aggregateSamples([sample, sample]);
  assert.equal(r.n, 2); assert.equal(r.anyPhysicalWipe, 0); assert.equal(r.weak.physical, 0.5);
  assert.equal(r.weak.escape[0], 0.5); assert.equal(r.grades.DECISIVE, 1);
});

test('main matrix has exact armed power ratios, both directions, and shield-research profiles', () => {
  const cases = buildCases();
  assert.ok(cases.length > 0);
  for (const c of cases) assert.ok(Math.abs(c.actualRatio - c.ratio) < 1e-12);
  assert.deepEqual([...new Set(cases.map(c => c.ratio))], [1, 1.5, 2, 2.5, 3]);
  assert.deepEqual([...new Set(cases.map(c => c.shieldLevel))], [0, 4]);
  assert.deepEqual([...new Set(cases.map(c => c.strongSide))], ['ATTACK', 'DEFENCE']);
});

test('monument control yields surviving support to an armed attacker, including collectors', () => {
  const input = { attacker: { CORSAIR: 2 }, defender: { CORSAIR: 1, GARBAGE_COLLECTOR: 1 } };
  const result = { grade: 'PARTIAL', attackerSurvivors: { CORSAIR: 2 }, defenderSurvivors: { GARBAGE_COLLECTOR: 1 },
    attackerRetreated: {}, defenderRetreated: {}, attackerLosses: {}, defenderLosses: { CORSAIR: 1 }, rounds: [] };
  assert.equal(summarizeBattle(input, result).monumentControl, 'ATTACKER');
});
