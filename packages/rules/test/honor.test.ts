import { describe, expect, it } from 'vitest';
import {
  honorChallenge, honorSide, honorPairCredit, honorSplit, honorShieldWeight,
  type HonorSideInput,
} from '../src/index.js';

const facts = (over: Partial<HonorSideInput> = {}): HonorSideInput => ({
  k: 50_000, enemyLoss: over.k ?? 50_000, l: 10_000, loot: 0,
  ownTier: 3, enemyTier: 3, ownNavy: 100_000, enemyNavy: 100_000,
  defending: false, weakRepeat: 0, related: false, eligible: true,
  retaliationFifths: 0, ...over,
});

describe('Honor v1: independent of Dominion and the battle grade', () => {
  it.each([
    ['peer efficient win', {}, 44_833_333],
    ['upper efficient win', { enemyTier: 4, enemyNavy: 150_000 }, 56_291_666],
    ['meaningful upper defeat', { k: 20_000, l: 100_000, enemyTier: 4, enemyNavy: 200_000 }, 4_583_332],
    ['empty suicide', { k: 0, l: 546, enemyTier: 4 }, -54_600],
    ['empty warehouse', { k: 0, l: 0, loot: 100_000 }, 0],
    ['helpless defender', { k: 0, l: 100_000, defending: true }, 0],
    ['civilian-only target', { k: 0, enemyLoss: 100_000, l: 0 }, 0],
    ['weak profitable raid', { l: 0, loot: 20_000, enemyTier: 2, enemyNavy: 80_000 }, -13_500_000],
    ['related pair', { related: true }, -1_000_000],
    ['NPC', { eligible: false }, 0],
  ] satisfies [string, Partial<HonorSideInput>, number][] )('%s', (_name, over, raw) => {
    expect(honorSide(facts(over)).raw).toBe(raw);
  });

  it('losing well can earn; a mosquito suicide cannot', () => {
    expect(honorSide(facts({ k: 100, l: 10_000, enemyTier: 4 })).raw).toBeLessThan(0);
    expect(honorSide(facts({ k: 10_000, l: 100_000, defending: true })).raw).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 20])('weak repeats %s saturate at double, and own losses remain separate', weakRepeat => {
    const raw = honorSide(facts({ enemyTier: 2, enemyNavy: 80_000, weakRepeat })).raw;
    expect(raw).toBe(-12_500_000 * (1 + Math.min(weakRepeat, 2) / 2) - 1_000_000);
  });

  it('weaker-tier civilians and cargo raids still incur sanctions', () => {
    expect(honorSide(facts({ k: 0, l: 0, loot: 1, ownTier: 4, enemyTier: 3, ownNavy: 0, enemyNavy: 0 })).raw).toBe(-50);
    expect(honorSide(facts({ k: 0, enemyLoss: 1, l: 0, enemyTier: 2, enemyNavy: 0 })).raw).toBe(-250);
  });

  it('retaliation consumes exact fifths, including sub-resource loot, and never earns points', () => {
    const result = honorSide(facts({ k: 0, l: 0, loot: 1, enemyTier: 2, enemyNavy: 0, retaliationFifths: 1 }));
    expect(result.raw).toBe(0);
    expect(result.retaliationSpentFifths).toBe(1);
    expect(honorSide(facts({ enemyTier: 2, enemyNavy: 1000, retaliationFifths: 5 })).raw).toBeLessThan(0);
    expect(honorSide(facts({ k: 0, l: 1, loot: 1, enemyTier: 2, enemyNavy: 0, retaliationFifths: 5 })).raw).toBe(-100);
  });

  it('retaliation does not apply to ordinary fights or ineligible sources', () => {
    expect(honorSide(facts({ retaliationFifths: 1_000_000 })).retaliationSpentFifths).toBe(0);
    expect(honorSide(facts({ eligible: false, enemyTier: 2, enemyNavy: 0, retaliationFifths: 1_000_000 })).retaliationSpentFifths).toBe(0);
  });

  it.each([20, 40] as const)('uses frozen %s%% loot weight for weak sanctions and retaliation', retaliationLootPercent => {
    const lootOnly = facts({ k: 0, enemyLoss: 0, l: 0, loot: 1, enemyTier: 2, enemyNavy: 0 });
    const fifths = retaliationLootPercent / 20;
    expect(honorSide({ ...lootOnly, retaliationLootPercent }).raw).toBe(-50 * fifths);
    expect(honorSide({ ...lootOnly, retaliationLootPercent, retaliationFifths: fifths }))
      .toMatchObject({ raw: 0, retaliationSpentFifths: fifths });
    expect(honorSide({ ...lootOnly, retaliationLootPercent, retaliationFifths: fifths - 1 }).raw).toBe(-50);
    expect(honorSide({ ...lootOnly, retaliationLootPercent, retaliationFifths: fifths, l: 1 }).raw).toBe(-100);
    expect(honorSide(facts({ retaliationLootPercent, loot: 1000 })))
      .toEqual(honorSide(facts({ loot: 1000 })));
  });

  it('strong low-Core players are not protected novices; Core camping earns no upper bonus', () => {
    expect(honorChallenge(facts({ enemyTier: 2, enemyNavy: 200_000 })).kind).toBe('PEER');
    expect(honorChallenge(facts({ ownTier: 2, enemyTier: 4, ownNavy: 1_000_000 })).kind).toBe('PEER');
    expect(honorSide(facts({ ownTier: 2, enemyTier: 4, ownNavy: 1_000_000, l: 0 })).raw).toBe(0);
  });

  it.each([[49_999, 0], [50_000, 500_000], [74_999, 500_000], [75_000, 1_000_000], [1_000_000, 1_000_000]])('publishes a coarse band at %s', (enemyNavy, gainFactor) => {
    expect(honorChallenge(facts({ enemyNavy })).gainFactor).toBe(gainFactor);
  });

  it('no fixed attendance score and no loot recycling award; combat-linked loot is capped', () => {
    expect(honorSide(facts({ k: 0, l: 0, enemyTier: 4, loot: 1_000_000 })).raw).toBe(0);
    expect(honorSide(facts({ loot: 50_000 })).raw).toBe(honorSide(facts({ loot: 1_000_000 })).raw);
  });

  it('does not count defensive loot, even if a malformed adapter supplies it', () => {
    expect(() => honorSide(facts({ defending: true, loot: 1 }))).toThrow();
  });

  it.each([{ k: -1 }, { l: Infinity }, { loot: 0.1 }, { ownTier: 0 }, { ownNavy: NaN }, { enemyLoss: 1 }, { weakRepeat: -1 }, { retaliationFifths: 0.2 }])('rejects impossible facts %j', over => {
    expect(() => honorSide(facts(over))).toThrow();
  });

  it('uses exact arithmetic and fails on unsafe output instead of rounding a large score', () => {
    expect(() => honorSide(facts({ k: Number.MAX_SAFE_INTEGER, enemyLoss: Number.MAX_SAFE_INTEGER, l: 0 }))).toThrow();
    expect(honorSide(facts({ k: 1, l: Number.MAX_SAFE_INTEGER, defending: true })).raw).toBe(500);
  });

  it('bounds the reward by permanent military destruction across a small adversarial grid', () => {
    for (const k of [0, 1, 546, 10_000, 100_000]) for (const l of [0, 1, 546, 10_000, 100_000]) {
      for (const enemyTier of [2, 3, 4]) for (const defending of [false, true]) {
        const r = honorSide(facts({ k, l, enemyTier, enemyNavy: 200_000, defending, loot: defending ? 0 : 1_000_000 }));
        expect(r.raw).toBeLessThanOrEqual(1375 * k);
        if (defending) expect(r.raw).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('common pool and unordered pair budget primitives', () => {
  it('both directions and sides consume one cumulative cap; negative scores never refill it', () => {
    expect(honorPairCredit(0, 100_000_000, 100_000_000)).toEqual({ rawAfter: 200_000_000, a: 50_000_000, b: 50_000_000 });
    expect(honorPairCredit(200_000_000, -12_000_000, 0)).toEqual({ rawAfter: 200_000_000, a: -12_000_000, b: 0 });
    expect(honorPairCredit(200_000_000, 100_000_000, 0).a).toBe(20_000_000);
  });
  it('subdivision cannot increase total pair credit', () => {
    let before = 0, total = 0;
    for (let i = 0; i < 100; i++) {
      const r = honorPairCredit(before, 1_000_000, 0); before = r.rawAfter; total += r.a;
    }
    expect(total).toBe(honorPairCredit(0, 100_000_000, 0).a);
  });
  it('merges owner waves before integer allocation and conserves signed pools', () => {
    const rows = [{ actor: 'B', weight: 1 }, { actor: 'A', weight: 1 }, { actor: 'A', weight: 1 }];
    expect(honorSplit(-10, rows)).toEqual([{ actor: 'A', weight: 2, points: -7 }, { actor: 'B', weight: 1, points: -3 }]);
    expect(honorSplit(1, rows).reduce((n, r) => n + r.points, 0)).toBe(1);
    expect(() => honorSplit(1, [{ actor: 'A', weight: 0 }])).toThrow();
  });
  it('rejects unsafe pair totals before losing precision', () => {
    expect(() => honorPairCredit(Number.MAX_SAFE_INTEGER, 1, 0)).toThrow();
  });
  it('active shield weight cannot dominate the military side or earn without protection', () => {
    expect(honorShieldWeight({ armedValue: 100, investment: 1_000, capacity: 100, normalAbsorbed: 100 })).toBe(100);
    expect(honorShieldWeight({ armedValue: 100, investment: 100, capacity: 100, normalAbsorbed: 50 })).toBe(50);
    expect(honorShieldWeight({ armedValue: 0, investment: 100, capacity: 100, normalAbsorbed: 100 })).toBe(0);
    expect(honorShieldWeight({ armedValue: 100, investment: 100, capacity: 0, normalAbsorbed: 0 })).toBe(0);
  });
});
