import { describe, expect, it } from 'vitest';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
const member = (id: string, tier = 4, navy = 100000) => ({ id, tier, navy, weight: 100000,
  civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 });
const effect = (id = 'emp', at = 1000): HonorEvidence => ({ source: 'STRATEGIC_IMPACT', id, at, eligible: true,
  attack: [member('A')], defence: [member('D')], relations: [{ a: 'A', b: 'D', related: false }],
  tactical: [{ actor: 'A', enemy: 'D', base: 4_000_000, pressureFifths: 160000 }] });

describe('tactical effects use the same ranking journal and safeguards', () => {
  it('awards small real tactical success without invented hull casualties', () => {
    const result = replayHonor([effect()], 4);
    expect(result.events[0]?.attack.total).toBe(3_921_568);
    expect(result.events[0]?.defence.total).toBe(0);
    expect(result.retaliations[0]?.remaining).toBe(160000);
  });
  it('blocks related gain, preserves weak pressure and escalates real repeated pressure', () => {
    const related = effect(); related.relations[0]!.related = true;
    expect(replayHonor([related], 4).totals.find(r => r.actor === 'A')?.score).toBe(0);
    const weak = effect(); weak.defence[0]!.tier = 3; weak.defence[0]!.navy = 50000;
    expect(replayHonor([weak, { ...weak, id: 'repeat', at: 1001 }], 4).totals.find(r => r.actor === 'A')?.score).toBe(-20_000_000);
  });
  it('does not grant positive credit for ineffective effects or shared offence', () => {
    const empty = effect(); empty.tactical = [{ actor: 'A', enemy: 'D', base: 0, pressureFifths: 0 }];
    expect(replayHonor([empty], 4).totals.every(r => r.score === 0)).toBe(true);
    const shared = effect(); shared.attack.push(member('B')); shared.relations.push({ a: 'B', b: 'D', related: false });
    expect(replayHonor([shared], 4).totals.every(r => r.score === 0)).toBe(true);
  });
  it('caps one bomb across victims, intervals and equal-time accounting, without reducing weak penalties', () => {
    const a = { ...effect('bomb:a'), tacticalCap: { id: 'bomb', limit: 2_500_000 } };
    const b = { ...a, id: 'bomb:b' };
    const together = replayHonor([a, b], 4);
    expect(together.events.map(e => e.pool.attack.raw)).toEqual([1_250_000, 1_250_000]);
    expect(together.effectUsed).toEqual([{ id: 'bomb', value: 2_500_000 }]);
    expect(replayHonor([a, { ...b, at: 1001 }], 4).events[1]?.attack.total).toBe(0);
    const weak = { ...a, defence: [member('D', 3, 50000)] };
    expect(replayHonor([weak, { ...weak, id: 'again', at: 1001 }], 4).totals.find(r => r.actor === 'A')?.score).toBe(-20_000_000);
  });
  it('does not let a tactical source bypass the ordinary opponent soft limit', () => {
    const a = effect(); const b = effect('second', 1001);
    const result = replayHonor([a, b], 4);
    expect(result.events[1]!.attack.total).toBeLessThan(result.events[0]!.attack.total);
  });
});
it('one radiation attack does not escalate bullying merely because lazy damage is processed often', () => {
  const first = { ...effect('slice:1'), attackKey: 'bomb:one', defence: [member('D', 3, 50000)] };
  const second = { ...first, id: 'slice:2', at: 1001 };
  const result = replayHonor([first, second], 4);
  expect(result.totals.find(r => r.actor === 'A')?.score).toBe(-16_000_000);
  expect(result.repeats).toHaveLength(1);
});
it('later grouped intervals from the same bomb keep its original weak-attack step', () => {
  const first = { ...effect('slice:1'), attackKey: 'bomb:one', defence: [member('D', 3, 50000)] };
  const result = replayHonor([first, { ...first, id: 'slice:2', at: 1001 }, { ...first, id: 'slice:3', at: 1001 }], 4);
  expect(result.totals.find(r => r.actor === 'A')?.score).toBe(-24_000_000);
  expect(result.repeats).toHaveLength(1);
});
it('quantises cumulative radiation effects so score cannot reveal precise private fleet investment', () => {
  const hit = (id: string, at: number, armedMicros: number): HonorEvidence => ({ ...effect(id, at), attackKey: 'bomb:q',
    tacticalCap: {id:'bomb:q',limit:2500000}, tactical:[{actor:'A',enemy:'D',base:0,pressureFifths:0,
      radiation:{armedMicros,allMicros:armedMicros}}] });
  const a = replayHonor([hit('one',1000,1100_000_000)],4);
  const b = replayHonor([hit('one',1000,1900_000_000)],4);
  expect(a.events[0]?.attack.total).toBe(b.events[0]?.attack.total);
  expect(a.events[0]!.attack.total).toBeGreaterThan(0);
  const split = replayHonor([hit('one',1000,550_000_000), hit('two',1001,550_000_000)],4);
  expect(split.totals).toEqual(a.totals);
});
it('freezes the simultaneous repeat multiplier for each lingering bomb across later intervals', () => {
  const one = { ...effect('one:a'), attackKey:'bomb:one', defence:[member('D',3,50000)] };
  const two = { ...one,id:'two:a',attackKey:'bomb:two' };
  const split = replayHonor([one,two,{...one,id:'one:b',at:1001},{...two,id:'two:b',at:1001}],4);
  const together = replayHonor([
    {...one,tactical:one.tactical!.map(row=>({...row,pressureFifths:row.pressureFifths*2}))},
    {...two,tactical:two.tactical!.map(row=>({...row,pressureFifths:row.pressureFifths*2}))},
  ],4);
  expect(split.totals).toEqual(together.totals);
  expect(split.totals.find(row=>row.actor==='A')?.score).toBe(-40_000_000);
});
