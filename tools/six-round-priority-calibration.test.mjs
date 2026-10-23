import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIORITY_POLICIES, priorityScore } from './six-round-priority-calibration.mjs';
import { SIX_BALANCED } from './six-round-retreat-calibration.mjs';
import { retreatPolicyFor } from './distributed-damage-model.mjs';

const makeRows = (values) => values.map(([ratio,shieldLevel,escaped])=>({ratio,shieldLevel,strongSide:'ATTACK',
  outcomes:{p:{weak:{escape:[escaped,0,0,0,0],physical:1},controls:{ATTACKER:1}}}}));

test('first priority is the average ESCAPED starting-fleet share at 2 and 3 for each shield profile',()=>{
  const rows=makeRows([[2,0,.20],[2,4,.22],[3,0,.25],[3,4,.24]]);
  const score=priorityScore(rows,'p');
  assert.equal(score.feasible,true);assert.equal(score.violation,0);
  rows.push({ratio:1,shieldLevel:0,outcomes:{p:{weak:{escape:[0],physical:1}}}});
  assert.deepEqual(priorityScore(rows,'p'),score);
});

test('good 3x result cannot hide 2x below 15 percent or a shield profile above its upper limit',()=>{
  assert.equal(priorityScore(makeRows([[2,0,.13],[2,4,.2],[3,0,.25],[3,4,.25]]),'p').feasible,false);
  assert.equal(priorityScore(makeRows([[2,0,.20],[2,4,.26],[3,0,.25],[3,4,.25]]),'p').feasible,false);
});

test('all candidates leave 1:1 and 1:1.5 untouched and keep growing weak HP windows',()=>{
  for(const p of PRIORITY_POLICIES) {
    for(const ratio of [1,1.25,1.5,1.75]) {
      const a={CORSAIR:20*ratio},d={CORSAIR:20};
      assert.deepEqual(retreatPolicyFor(a,d,p.rows),retreatPolicyFor(a,d,SIX_BALANCED.rows));
      assert.deepEqual(retreatPolicyFor(d,a,p.rows),retreatPolicyFor(d,a,SIX_BALANCED.rows));
    }
    for(let i=1;i<p.rows.length;i++)assert.ok(p.rows[i].weak.threshold>=p.rows[i-1].weak.threshold);
  }
});
