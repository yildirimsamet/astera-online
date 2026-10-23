import test from 'node:test';
import assert from 'node:assert/strict';
import { roundEvenFraction, roundEscapePolicy } from './six-round-even-rounding.mjs';
import { PRIORITY_POLICIES } from './six-round-priority-calibration.mjs';

test('percent parameters round to nearest even integer; exact ties go upward',()=>{
  for(const [input,expected] of [[.274,.28],[.275,.28],[.45,.46],[.65,.66],[.05,.06],[.25,.26],[.29,.30],[.57,.58],[0,0],[1,1]]){
    assert.equal(roundEvenFraction(input),expected);
  }
});

test('only chance/HP percentages are rounded, not entry ratio tiers or the input policy',()=>{
  const original=PRIORITY_POLICIES.find(p=>p.id==='early275'),snapshot=structuredClone(original);
  const rounded=roundEscapePolicy(original);
  assert.deepEqual(rounded.rows.map(r=>r.minRatio),[1,1.5,2,3]);
  assert.deepEqual(rounded.rows.map(r=>r.weak),[
    {chance:.10,threshold:.30},{chance:.20,threshold:.46},
    {chance:.28,threshold:.66},{chance:.40,threshold:.80},
  ]);
  assert.deepEqual(rounded.rows[3].strong,{chance:.06,threshold:.26});
  for(const row of rounded.rows)for(const side of ['weak','strong'])for(const field of ['chance','threshold']){
    const percent=row[side][field]*100;
    assert.ok(Math.abs(percent/2-Math.round(percent/2))<1e-10);
  }
  assert.deepEqual(original,snapshot);
});

test('invalid percentages are rejected rather than rounded into valid-looking data',()=>{
  for(const value of [NaN,Infinity,-.01,1.01])assert.throws(()=>roundEvenFraction(value));
});
