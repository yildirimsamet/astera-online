import { describe, expect, it } from 'vitest';
import { honorRankRewards, honorReward, honorResourceValue, selectSeasonReward } from '../src/honorRewards.js';

describe('Honor reward program', () => {
  it('top one opens the full double package at 146 Honor', () => {
    expect(honorReward({ alloy: 4000, crystal: 3000, deuterium: 600 }, 146_000_000))
      .toEqual({ alloy: 4000, crystal: 3000, deuterium: 600 });
    expect(honorResourceValue(honorReward({ alloy: 4000, crystal: 3000, deuterium: 600 }, 1_000_000))).toBeLessThanOrEqual(200);
  });
  it.each([0, -1, -100_000_000])('no competitive payment at %s', honor => {
    expect(honorReward({ alloy: 4000, crystal: 3000, deuterium: 600 }, honor)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
  it('equal Honor shares the rank and occupied prize tiers, irrespective of input/identity order', () => {
    const rows = [{ actor: 'Z', honor: 200_000_000 }, { actor: 'A', honor: 200_000_000 }, { actor: 'C', honor: 100_000_000 }];
    const ranks = honorRankRewards(rows);
    expect(ranks).toEqual(honorRankRewards([...rows].reverse()));
    expect(ranks.find(r => r.actor === 'A')).toMatchObject({ rank: 1, nominal: { alloy: 3750, crystal: 2750, deuterium: 550 } });
    expect(ranks.find(r => r.actor === 'Z')).toMatchObject({ rank: 1, nominal: { alloy: 3750, crystal: 2750, deuterium: 550 } });
    expect(ranks.find(r => r.actor === 'C')?.rank).toBe(3);
  });
  it('a tie crossing the last paid place shares that prize rather than picking a UUID winner', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ actor: String(i), honor: i < 9 ? (20 - i) * 1_000_000 : 1_000_000 }));
    const ranks = honorRankRewards(rows);
    expect(ranks.find(r => r.actor === '9')?.nominal).toEqual({ alloy: 200, crystal: 50, deuterium: 5 });
    expect(ranks.find(r => r.actor === '10')?.nominal).toEqual(ranks.find(r => r.actor === '9')?.nominal);
    expect(ranks.find(r => r.actor === '10')?.rank).toBe(10);
  });
  it('caps after tie allocation and never sums both rankings’ resource payments', () => {
    const d = { alloy: 2000, crystal: 1500, deuterium: 300 };
    const h = honorReward({ alloy: 4000, crystal: 3000, deuterium: 600 }, 1_000_000);
    expect(selectSeasonReward(d, h)).toEqual({ ranking: 'DOMINION', reward: d });
    expect(selectSeasonReward(d, { alloy: 4000, crystal: 3000, deuterium: 600 })).toEqual({ ranking: 'HONOR', reward: { alloy: 4000, crystal: 3000, deuterium: 600 } });
  });
  it('rejects duplicate identities, fractional scores and impossible resources', () => {
    expect(() => honorRankRewards([{ actor: 'A', honor: 1 }, { actor: 'A', honor: 2 }])).toThrow();
    expect(() => honorReward({ alloy: 1, crystal: 1, deuterium: 1 }, 0.5)).toThrow();
    expect(() => honorResourceValue({ alloy: -1, crystal: 0, deuterium: 0 })).toThrow();
  });
  it('bounds resource reward below ideal recycled feeding cost', () => {
    for (const k of [1, 546, 1000, 100_000, 1_000_000]) {
      const maxHonorMicro = 1375 * k;
      const reward = honorReward({ alloy: 4000, crystal: 3000, deuterium: 600 }, maxHonorMicro);
      expect(honorResourceValue(reward)).toBeLessThanOrEqual(k * 0.275);
      expect(honorResourceValue(reward)).toBeLessThan(k * 0.7);
    }
  });
});
