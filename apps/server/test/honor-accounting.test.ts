import { describe, expect, it } from 'vitest';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';

const member = (id: string, tier = 3, navy = 100_000) => ({ id, tier, navy, weight: 10_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 });
const event = (id: string, at = 1, over: Partial<HonorEvidence> = {}): HonorEvidence => ({
  source: 'WORLD', id, at, eligible: true,
  attack: [member('A')], defence: [{ ...member('D'), loss: 1000, combatLoss: 1000 }],
  relations: [{ a: 'A', b: 'D', related: false }], ...over,
});

describe('Honor chronological accounting', () => {
  it('orders delayed events identically to timely delivery and preserves all pair/actor totals', () => {
    const early = event('1'), late = event('2', 2);
    expect(replayHonor([late, early])).toEqual(replayHonor([early, late]));
    const result = replayHonor([early, late]);
    expect(result.totals.find(r => r.actor === 'A')?.score).toBe(1_980_198);
    expect(result.events[0]?.attack.total).toBeGreaterThan(result.events[1]?.attack.total ?? 0);
  });
  it('source types scope identical source ids, but duplicate event identities are rejected', () => {
    expect(replayHonor([event('1'), event('1', 2, { source: 'MONUMENT' })]).events).toHaveLength(2);
    expect(() => replayHonor([event('1'), event('1')])).toThrow();
  });
  it('includes neither ineligible harm nor no-op attempts in the weak repeat count', () => {
    const weak = (id: string, at: number) => event(id, at, { attack: [member('A', 4, 200_000)] });
    const r = replayHonor([weak('1', 1), { ...weak('npc', 2), eligible: false },
      { ...weak('empty', 3), defence: [member('D')] }, weak('2', 4), weak('3', 5)]);
    expect(r.events.map(e => e.attack.total)).toEqual([-250_000, 0, 0, -375_000, -500_000]);
  });
  it('expires repeats exactly at 24h and remembers them across source types', () => {
    const weak = event('1', 0, { attack: [member('A', 4, 200_000)] });
    expect(replayHonor([weak, { ...weak, id: '2', source: 'MONUMENT', at: 86_399_999 }]).events[1]?.attack.total).toBe(-375_000);
    expect(replayHonor([weak, { ...weak, id: '2', at: 86_400_000 }]).events[1]?.attack.total).toBe(-250_000);
  });
  it('consumes retaliation once without minting an endless revenge loop', () => {
    const opening = event('1', 0, { attack: [member('D', 2, 50_000)], defence: [{ ...member('A', 3), loss: 1000, combatLoss: 1000 }],
      relations: [{ a: 'D', b: 'A', related: false }] });
    const counter = event('2', 1, { defence: [{ ...member('D', 2, 50_000), loss: 1000, combatLoss: 1000 }] });
    const r = replayHonor([opening, counter, { ...counter, id: '3', at: 2 }]);
    expect(r.events[1]?.attack.total).toBe(0);
    expect(r.events[2]?.attack.total).toBeLessThan(0);
    expect(r.events[1]?.pool.attack.exposures[0]?.retaliationSpentFifths).toBe(5000);
    expect(r.retaliations.filter(x => x.sourceKey === JSON.stringify(['WORLD', '2']))).toEqual([]);
  });
  it('expired provocation cannot cover a later weak raid', () => {
    const opening = event('1', 0, { attack: [member('D', 2, 50_000)], defence: [{ ...member('A'), loss: 1000, combatLoss: 1000 }],
      relations: [{ a: 'D', b: 'A', related: false }] });
    const counter = event('2', 86_400_000, { defence: [{ ...member('D', 2, 50_000), loss: 1000, combatLoss: 1000 }] });
    expect(replayHonor([opening, counter]).events[1]?.attack.total).toBe(-250_000);
  });
  it('simultaneous harm cannot retroactively license a weak raid according to source-id order', () => {
    const opening = event('1', 1000, { attack: [member('D', 2, 50_000)],
      defence: [{ ...member('A'), loss: 1000, combatLoss: 1000 }],
      relations: [{ a: 'D', b: 'A', related: false }] });
    const counter = event('2', 1000, { defence: [{ ...member('D', 2, 50_000), loss: 1000, combatLoss: 1000 }] });
    const firstOrder = replayHonor([opening, counter]);
    const secondOrder = replayHonor([{ ...opening, id: '2' }, { ...counter, id: '1' }]);
    const counterIn = (r: ReturnType<typeof replayHonor>, id: string) => r.events.find(row => row.key === JSON.stringify(['WORLD', id]));
    expect(counterIn(firstOrder, '2')?.attack.total).toBe(-250_000);
    expect(counterIn(secondOrder, '1')?.attack.total).toBe(-250_000);
    expect(counterIn(firstOrder, '2')?.pool.attack.exposures[0]?.retaliationSpentFifths).toBe(0);
    expect(firstOrder.totals).toEqual(secondOrder.totals);
  });
  it('consumes genuine older grants while leaving a simultaneous provocation unavailable to that battle', () => {
    const opening = event('0', 0, { attack: [member('D', 2, 50_000)],
      defence: [{ ...member('A'), loss: 1000, combatLoss: 1000 }],
      relations: [{ a: 'D', b: 'A', related: false }] });
    const simultaneous = { ...opening, id: '1', at: 1000,
      defence: [{ ...member('A'), loss: 2000, combatLoss: 2000 }] };
    const counter = event('2', 1000, { defence: [{ ...member('D', 2, 50_000), loss: 3000, combatLoss: 3000 }] });
    const r = replayHonor([opening, simultaneous, counter]);
    expect(r.events[2]?.pool.attack.exposures[0]?.retaliationSpentFifths).toBe(5000);
    expect(r.events[2]?.attack.total).toBe(-500_000);
    expect(r.retaliations.find(row => row.holder === 'A' && row.sourceKey === JSON.stringify(['WORLD', '1']))?.remaining).toBe(10_000);
  });
  it('validates all committed pair relationships, rather than assuming missing means unrelated', () => {
    expect(() => replayHonor([event('1', 1, { relations: [] })])).toThrow();
    expect(() => replayHonor([event('1', 1, { relations: [{ a: 'D', b: 'A', related: false }] })])).toThrow();
  });
  it('does not accept caller-authored repeat counters or retaliation balances', () => {
    expect(() => replayHonor([{ ...event('1'), relations: [{ a: 'A', b: 'D', related: false, weakRepeat: 0 }] }])).toThrow();
  });
});
