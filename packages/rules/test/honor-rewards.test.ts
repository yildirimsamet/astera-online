import { describe, expect, it } from 'vitest';
import { honorRankRewards, honorReward, honorResourceValue, selectSeasonReward } from '../src/honorRewards.js';

describe('Honor reward program', () => {
  it('top one opens the reduced full double package at exactly 73 Honor', () => {
    const at = (honor: number) => honorRankRewards([{ actor: 'winner', honor }])[0]!;
    const full = { alloy: 2000, crystal: 1500, deuterium: 300 };
    expect(at(73_000_000)).toMatchObject({ nominal: full, reward: full });
    expect(at(72_999_999).reward).not.toEqual(full);
    expect(honorResourceValue(at(1_000_000).reward)).toBeLessThanOrEqual(200);
  });
  it('uses the approved integer packages for every Honor place', () => {
    const ranks = honorRankRewards(Array.from({ length: 10 }, (_, i) => ({ actor: String(i), honor: (200 - i) * 1_000_000 })));
    expect(ranks.map(row => row.reward)).toEqual([
      { alloy: 2000, crystal: 1500, deuterium: 300 },
      { alloy: 1750, crystal: 1250, deuterium: 250 },
      { alloy: 1500, crystal: 1000, deuterium: 200 },
      { alloy: 1250, crystal: 750, deuterium: 150 },
      { alloy: 1000, crystal: 500, deuterium: 100 },
      { alloy: 750, crystal: 250, deuterium: 50 },
      { alloy: 600, crystal: 174, deuterium: 24 },
      { alloy: 450, crystal: 150, deuterium: 14 },
      { alloy: 250, crystal: 74, deuterium: 10 },
      { alloy: 200, crystal: 50, deuterium: 4 },
    ]);
  });
  it.each([0, -1, -100_000_000])('no competitive payment at %s', honor => {
    expect(honorReward({ alloy: 2000, crystal: 1500, deuterium: 300 }, honor)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
  it('equal Honor shares the rank and occupied prize tiers, irrespective of input/identity order', () => {
    const rows = [{ actor: 'Z', honor: 200_000_000 }, { actor: 'A', honor: 200_000_000 }, { actor: 'C', honor: 100_000_000 }];
    const ranks = honorRankRewards(rows);
    expect(ranks).toEqual(honorRankRewards([...rows].reverse()));
    expect(ranks.find(r => r.actor === 'A')).toMatchObject({ rank: 1, nominal: { alloy: 1875, crystal: 1375, deuterium: 275 } });
    expect(ranks.find(r => r.actor === 'Z')).toMatchObject({ rank: 1, nominal: { alloy: 1875, crystal: 1375, deuterium: 275 } });
    expect(ranks.find(r => r.actor === 'C')?.rank).toBe(3);
  });
  it('a tie crossing the last paid place shares that prize rather than picking a UUID winner', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ actor: String(i), honor: i < 9 ? (20 - i) * 1_000_000 : 1_000_000 }));
    const ranks = honorRankRewards(rows);
    expect(ranks.find(r => r.actor === '9')?.nominal).toEqual({ alloy: 100, crystal: 25, deuterium: 2 });
    expect(ranks.find(r => r.actor === '10')?.nominal).toEqual(ranks.find(r => r.actor === '9')?.nominal);
    expect(ranks.find(r => r.actor === '10')?.rank).toBe(10);
  });
  it('caps after tie allocation and never sums both rankings’ resource payments', () => {
    const d = { alloy: 1000, crystal: 750, deuterium: 150 };
    const h = honorReward({ alloy: 2000, crystal: 1500, deuterium: 300 }, 1_000_000);
    expect(selectSeasonReward(d, h)).toEqual({ ranking: 'DOMINION', reward: d });
    expect(selectSeasonReward(d, { alloy: 2000, crystal: 1500, deuterium: 300 })).toEqual({ ranking: 'HONOR', reward: { alloy: 2000, crystal: 1500, deuterium: 300 } });
  });
  it('rejects duplicate identities, fractional scores and impossible resources', () => {
    expect(() => honorRankRewards([{ actor: 'A', honor: 1 }, { actor: 'A', honor: 2 }])).toThrow();
    expect(() => honorReward({ alloy: 1, crystal: 1, deuterium: 1 }, 0.5)).toThrow();
    expect(() => honorResourceValue({ alloy: -1, crystal: 0, deuterium: 0 })).toThrow();
  });
  it('bounds resource reward below ideal recycled feeding cost', () => {
    for (const k of [1, 546, 1000, 100_000, 1_000_000]) {
      const maxHonorMicro = 1375 * k;
      const reward = honorReward({ alloy: 2000, crystal: 1500, deuterium: 300 }, maxHonorMicro);
      expect(honorResourceValue(reward)).toBeLessThanOrEqual(k * 0.275);
      expect(honorResourceValue(reward)).toBeLessThan(k * 0.7);
    }
  });
});
