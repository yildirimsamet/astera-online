import test from 'node:test';
import assert from 'node:assert/strict';
import { battleRetreatPolicy } from '../packages/rules/src/battleRetreat.ts';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { BASE_POLICY, POLICY_CANDIDATES } from './distributed-retreat-tuning.mjs';
import { retreatPolicyFor, preparePolicyEngine, prepareStudyEngine } from './distributed-damage-model.mjs';

const aStack = fleet => [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } }];
const dStack = fleet => [{ stackId: 'host', playerId: 'd', fleet, tech: { tech: {} } }];

test('baseline table exactly matches production at all tier boundaries and in both directions', () => {
  for (const n of [100, 149, 150, 199, 200, 299, 300, 500]) {
    const a = { CORSAIR: n }, d = { CORSAIR: 100 };
    assert.deepEqual(retreatPolicyFor(a, d, BASE_POLICY), battleRetreatPolicy(a, d));
    assert.deepEqual(retreatPolicyFor(d, a, BASE_POLICY), battleRetreatPolicy(d, a));
  }
  assert.deepEqual(retreatPolicyFor({ COURIER: 2 }, { GARBAGE_COLLECTOR: 1 }, BASE_POLICY), battleRetreatPolicy({ COURIER: 2 }, { GARBAGE_COLLECTOR: 1 }));
});

test('candidate adjustments stay within five chance points and ten HP points with fixed tiers', () => {
  for (const candidate of POLICY_CANDIDATES) {
    assert.deepEqual(candidate.rows.map(r => r.minRatio), [1, 1.5, 2, 3]);
    assert.deepEqual(candidate.rows[0].weak, candidate.rows[0].strong);
    for (let i = 0; i < 4; i++) for (const side of ['weak', 'strong']) {
      const policy = candidate.rows[i][side], base = BASE_POLICY[i][side];
      assert.ok(Math.abs(policy.chance - base.chance) <= 0.050000001);
      assert.ok(Math.abs(policy.threshold - base.threshold) <= 0.100000001);
      assert.ok(policy.chance >= 0 && policy.chance <= 1 && policy.threshold >= 0 && policy.threshold <= 1);
    }
  }
});

test('cargo and collectors never change the policy ratio, and swapped sides swap their windows', () => {
  for (const candidate of POLICY_CANDIDATES) {
    const a = { CORSAIR: 3 }, d = { CORSAIR: 1 };
    const base = retreatPolicyFor(a, d, candidate.rows);
    assert.deepEqual(retreatPolicyFor({ ...a, COURIER: 100 }, { ...d, GARBAGE_COLLECTOR: 100 }, candidate.rows), base);
    const reversed = retreatPolicyFor(d, a, candidate.rows);
    assert.deepEqual(reversed.attacker, base.defender); assert.deepEqual(reversed.defender, base.attacker);
  }
});

test('policy-specific engine with baseline windows exactly matches the existing distributed model', async () => {
  const baseline = await prepareStudyEngine(), configured = await preparePolicyEngine(BASE_POLICY);
  for (let seed = 0; seed < 16; seed++) {
    const a = aStack({ CORSAIR: 12, CATACLYSM: 4 }), d = dStack({ CORSAIR: 6, CATACLYSM: 2 });
    assert.deepEqual(configured.candidate(a, d, 0, mulberry32(seed), true, true), baseline.candidate(a, d, 0, mulberry32(seed), true, true));
  }
});

test('a different policy cannot contaminate the baseline engine or the caller table', async () => {
  const base = await preparePolicyEngine(BASE_POLICY), changed = await preparePolicyEngine(POLICY_CANDIDATES[1].rows);
  const original = structuredClone(BASE_POLICY), a = aStack({ CORSAIR: 30 }), d = dStack({ CORSAIR: 10 });
  const before = base.candidate(a, d, 0, mulberry32(7), true, true);
  changed.candidate(a, d, 0, mulberry32(7), true, true);
  assert.deepEqual(base.candidate(a, d, 0, mulberry32(7), true, true), before);
  assert.deepEqual(BASE_POLICY, original);
});

test('even maximum permitted knobs cannot save a ship killed before the first retreat window', async () => {
  for (const policy of POLICY_CANDIDATES) {
    const { candidate } = await preparePolicyEngine(policy.rows);
    const r = candidate(aStack({ CATACLYSM: 3 }), dStack({ CATACLYSM: 1 }), 0, mulberry32(123), true, true);
    assert.deepEqual(r.defenderRetreated, {}); assert.deepEqual(r.defenderSurvivors, {});
    assert.equal(r.rounds.length, 1);
  }
});
