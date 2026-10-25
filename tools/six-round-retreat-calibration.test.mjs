import test from 'node:test';
import assert from 'node:assert/strict';
import { SIX_BALANCED, SIX_POLICIES, targetError } from './six-round-retreat-calibration.mjs';

test('six-round candidates raise the weak HP gate as the initial power gap grows', () => {
  for (const p of SIX_POLICIES) {
    assert.deepEqual(p.rows.map(r => r.minRatio), [1, 1.5, 2, 3]);
    assert.deepEqual(p.rows[0].weak, p.rows[0].strong);
    for (let i=1;i<4;i++) assert.ok(p.rows[i].weak.threshold >= p.rows[i-1].weak.threshold);
    for (const r of p.rows) for (const side of ['weak','strong']) {
      assert.ok(r[side].chance >= 0 && r[side].chance <= 1);
      assert.ok(r[side].threshold >= 0 && r[side].threshold <= 1);
    }
  }
});

test('close-fight score measures physical survivors on BOTH sides, not just escape or the weaker side', () => {
  const good = { attacker:{physical:.15}, defender:{physical:.15} };
  const misleading = { attacker:{physical:1}, defender:{physical:.15} };
  assert.equal(targetError(1,good),0);
  assert.ok(targetError(1.5,misleading) > 0);
});

test('unequal-fight score targets escaped starting-fleet share and a strong controller', () => {
  const good = { weak:{escape:[0,.15,0,0,0],active:0}, monumentControl:'ATTACKER' };
  assert.equal(targetError(2,good),0);
  assert.ok(targetError(2,{...good,weak:{escape:[0,0,0,0,0],active:0}})>0);
  assert.ok(targetError(3,good)>0);
  assert.equal(targetError(3,{...good,weak:{escape:[.25,0,0,0,0],active:0}}),0);
});

test('composed candidate uses measured per-bucket windows with monotonically increasing weak gates and chances', () => {
  assert.deepEqual(SIX_BALANCED.rows.map(r=>r.weak), [
    {chance:.10,threshold:.30}, {chance:.20,threshold:.45},
    {chance:.20,threshold:.60}, {chance:.40,threshold:.75},
  ]);
  const sources=['A-low','A-middle','A-low','A-high'];
  for(let i=0;i<4;i++) assert.deepEqual(SIX_BALANCED.rows[i],SIX_POLICIES.find(p=>p.id===sources[i]).rows[i]);
});
