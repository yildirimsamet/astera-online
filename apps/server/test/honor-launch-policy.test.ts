import { describe, expect, it } from 'vitest';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { HONOR_VERSION, isSupportedHonorVersion } from '@astera/rules';

const member = (id: string, loss = 0) => ({ id, tier: 3, navy: 100_000, weight: 100_000,
  civilianWeight: 0, loss, combatLoss: loss, lootLost: 0 });
const event = (id: string, a: string, d: string): HonorEvidence => ({ source: 'WORLD', id, at: 1000,
  eligible: true, attack: [member(a)], defence: [member(d, 100_000)], relations: [{ a, b: d, related: false }] });

describe('announced launch policy', () => {
  it('supports an explicit launch candidate without changing the existing default season version', () => {
    expect(HONOR_VERSION).toBe(3);
    expect(isSupportedHonorVersion(4)).toBe(true);
  });
  it('splits equal simultaneous opposing successes equally, independently of id ordering', () => {
    if (!isSupportedHonorVersion(4)) throw new Error('Missing launch policy');
    for (const ids of [['a', 'z'], ['z', 'a']]) {
      const result = replayHonor([event(ids[0]!, 'A', 'D'), event(ids[1]!, 'D', 'A')], 4);
      expect(result.totals).toEqual([{ actor: 'A', score: 50_000_000 }, { actor: 'D', score: 50_000_000 }]);
    }
  });
  it('does not re-enable shared positive credit when simultaneous events are grouped', () => {
    if (!isSupportedHonorVersion(4)) throw new Error('Missing launch policy');
    const shared = event('a', 'A', 'D');
    shared.attack.push(member('B'));
    shared.relations.push({ a: 'B', b: 'D', related: false });
    const result = replayHonor([shared, event('z', 'D', 'A')], 4);
    expect(result.totals.find(row => row.actor === 'A')?.score).toBe(0);
    expect(result.totals.find(row => row.actor === 'B')?.score).toBe(0);
    expect(result.totals.find(row => row.actor === 'D')?.score).toBe(66_666_666);
  });
  it('preserves the frozen v3 sequential outcomes', () => {
    const result = replayHonor([event('a', 'A', 'D'), event('z', 'D', 'A')], 3);
    expect(result.totals).toEqual([{ actor: 'A', score: 66_666_666 }, { actor: 'D', score: 33_333_334 }]);
  });
});

it('launch defence compares its genuine pre-battle navy without changing the attacker target snapshot', () => {
  if (!isSupportedHonorVersion(4)) throw new Error('Missing launch policy');
  for (const oldNavy of [0, 1, 100_000]) {
    const e = event('reactive', 'A', 'D');
    e.attack[0]!.loss = 10_000; e.attack[0]!.combatLoss = 10_000;
    const result = replayHonor([{ ...e, defence: [{ ...e.defence[0]!, navy: oldNavy, defenceNavy: 100_000 }] }], 4);
    expect(result.events[0]!.pool.defence.raw).toBe(5_454_545);
    expect(result.events[0]!.pool.attack.raw).toBe(oldNavy < 50_000 ? -1_000_000 : 94_454_545);
  }
});
