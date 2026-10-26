import { describe, expect, it } from 'vitest';
import { COMBAT } from '../packages/rules/src/constants.js';
import { fleetCount } from '../packages/rules/src/hulls.js';
import { matchup, powerUnits } from '../packages/rules/src/matchupPower.js';
import { SCENARIOS, STRONG_LOSS_MIN, keptTarget, measure, ratioOf, strongAt, strongLossFloor, tierOf, withExponent, withWindows } from './combat-v3-calibration.js';

describe('combat v3 calibration targets (owner 2026-10-25)', () => {
  it('keeps the owner’s table: 1:1 by tier, then the weak share by ratio, never below the tier’s even share (K6)', () => {
    expect([0, 1, 2, 3].map(tier => keptTarget(tier, 1))).toEqual([.10, .15, .20, .25]);
    expect([0, 1, 2, 3].map(tier => keptTarget(tier, 1.2))).toEqual([.20, .20, .20, .25]);
    expect([1.4, 1.6, 1.8, 2, 2.5, 3].map(ratio => keptTarget(0, ratio))).toEqual([.25, .30, .40, .50, .60, .70]);
    expect(STRONG_LOSS_MIN).toEqual({ 1.2: .80, 1.4: .65, 1.6: .50, 1.8: .40, 2: .30 });
  });

  it('carries the stronger side’s falling loss on past 1:2 instead of dropping off a cliff', () => {
    const floors = [1.2, 1.4, 1.6, 1.8, 2, 2.5, 3].map(strongLossFloor);
    for (let i = 1; i < floors.length; i++) expect(floors[i]!).toBeLessThan(floors[i - 1]!);
    expect(strongLossFloor(2.5)).toBeGreaterThan(0);
    expect(strongLossFloor(1)).toBeUndefined();
  });
});

describe('scenario suite', () => {
  it('puts every weak side inside its declared tier, few and many ships, mixed and countered fleets in each', () => {
    for (const s of SCENARIOS) {
      const m = matchup({ units: powerUnits(s.weak, { tech: s.weakTech }) }, { units: powerUnits(s.weak, { tech: s.weakTech }) });
      expect(tierOf(m.attacker.power), s.name).toBe(s.tier);
    }
    for (const tier of [0, 1, 2, 3]) {
      const rows = SCENARIOS.filter(s => s.tier === tier);
      expect(rows.length).toBeGreaterThanOrEqual(7);
      const counts = rows.map(s => fleetCount(s.weak));
      expect(Math.max(...counts) / Math.min(...counts), `tier ${String(tier)} count spread`).toBeGreaterThanOrEqual(4);
      expect(rows.some(s => Object.keys(s.weak).length >= 3)).toBe(true);
    }
  });

  it('builds the strong side at the asked matchup ratio', () => {
    for (const s of SCENARIOS) for (const ratio of [1, 1.4, 2, 3]) {
      const actual = ratioOf(s, strongAt(s, ratio));
      // Few-ship sides only step by whole hulls.
      expect(Math.abs(actual / ratio - 1), `${s.name} at ${String(ratio)}`).toBeLessThanOrEqual(fleetCount(s.weak) < 20 ? .1 : .03);
    }
  });
});

describe('measurement', () => {
  const s = SCENARIOS[0]!;
  it('reports shares kept and lost, the same for the same seeds', () => {
    const a = measure(s, strongAt(s, 1.6), [1, 2, 3]);
    expect(a).toEqual(measure(s, strongAt(s, 1.6), [1, 2, 3]));
    for (const value of [a.weakKept, a.strongLost, a.strongKept]) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
    expect(a.rounds).toBeGreaterThan(0); expect(a.rounds).toBeLessThanOrEqual(COMBAT.rounds);
  });

  it('swaps the retreat table only inside the call, even when it throws', () => {
    const before = COMBAT.retreatWindows;
    const never = COMBAT.retreatWindows.map(row => row.map(() => ({ threshold: .01, chance: .01 })));
    expect(withWindows(never, () => COMBAT.retreatWindows)).toBe(never);
    expect(() => withWindows(never, () => { throw new Error('x'); })).toThrow('x');
    expect(COMBAT.retreatWindows).toBe(before);
  });

  it('files the stronger side down at one exponent only inside the call', () => {
    const before = COMBAT.handicap;
    expect(withExponent(1.5, () => COMBAT.handicap.exponents.every(e => e === 1.5))).toBe(true);
    expect(() => withExponent(1.5, () => { throw new Error('x'); })).toThrow('x');
    expect(COMBAT.handicap).toBe(before);
  });

  it('makes the stronger side lose more the larger the exponent: the premise of the exponent search', () => {
    const strong = strongAt(s, 1.6), seeds = [1, 2, 3, 4, 5, 6];
    expect(withExponent(2, () => measure(s, strong, seeds)).strongLost).toBeGreaterThan(withExponent(1, () => measure(s, strong, seeds)).strongLost);
  });

  it('keeps more of the weak side the wider its window', () => {
    const strong = strongAt(s, 2), seeds = [1, 2, 3, 4, 5, 6];
    const shut = withWindows(COMBAT.retreatWindows.map(row => row.map(() => ({ threshold: .01, chance: .01 }))), () => measure(s, strong, seeds));
    const open = withWindows(COMBAT.retreatWindows.map(row => row.map(() => ({ threshold: 1, chance: .8 }))), () => measure(s, strong, seeds));
    expect(open.weakKept).toBeGreaterThan(shut.weakKept);
  });
});
