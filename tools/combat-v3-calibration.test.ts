import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBAT } from '../packages/rules/src/constants.js';
import { fleetCount } from '../packages/rules/src/hulls.js';
import { matchup, powerUnits } from '../packages/rules/src/matchupPower.js';
import { EVIDENCE, SCENARIOS, STRONG_LOSS_MIN, keptTarget, measure, ratioOf, strongAt, strongLossFloor, strongOverWeak, tierOf, withExponent, withWindows } from './combat-v3-calibration.js';

describe('combat v3 calibration targets (owner 2026-10-25)', () => {
  it('keeps the owner’s table: 1:1 by tier, then the weak share by ratio, never below the tier’s even share (K6)', () => {
    expect([0, 1, 2, 3].map(tier => keptTarget(tier, 1))).toEqual([.10, .15, .20, .25]);
    expect([0, 1, 2, 3].map(tier => keptTarget(tier, 1.2))).toEqual([.20, .20, .20, .25]);
    expect([1.4, 1.6, 1.8, 2, 2.5, 3].map(ratio => keptTarget(0, ratio))).toEqual([.25, .30, .40, .50, .60, .70]);
    expect(STRONG_LOSS_MIN).toEqual({ 1.2: .54, 1.4: .39, 1.6: .30, 1.8: .22, 2: .13 });
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

describe('the shipped calibration (owner 2026-10-26)', () => {
  interface Row { tier: number; ratio: number; threshold: number; chance: number }
  interface Check { scenario: string; ratio: number; weakKept: number; strongLost: number }
  const read = () => JSON.parse(readFileSync(EVIDENCE, 'utf8')) as { handicap: typeof COMBAT.handicap; table: Row[]; validation: Check[] };

  it('is the table the engine ships', () => {
    const evidence = read();
    expect(evidence.handicap).toEqual({ ratios: [...COMBAT.handicap.ratios], exponents: [...COMBAT.handicap.exponents] });
    for (const row of evidence.table) {
      expect(COMBAT.retreatWindows[row.tier]![COMBAT.retreatRatios.indexOf(row.ratio)], `T${String(row.tier)} 1:${String(row.ratio)}`)
        .toEqual({ threshold: row.threshold, chance: row.chance });
    }
  });

  it('measures the stronger side’s loss against the weaker one’s, in the weaker fleet’s units', () => {
    expect(strongOverWeak({ ratio: 2, weakKept: .5, strongLost: .25 })).toBeCloseTo(1, 10);
    expect(strongOverWeak({ ratio: 3, weakKept: .7, strongLost: .05 })).toBeCloseTo(.5, 10);
    expect(strongOverWeak({ ratio: 2, weakKept: 1, strongLost: 0 })).toBe(0);
  });

  it('never lets the weaker side out-trade the stronger one, in any scenario, at any gap from 1:1.2', () => {
    const checked = read().validation.filter(v => v.ratio >= 1.2);
    expect(checked.length).toBeGreaterThan(200);
    for (const v of checked) expect(strongOverWeak(v), `${v.scenario} at 1:${String(v.ratio)}`).toBeLessThanOrEqual(1);
  });

  it('shows the player what was measured: the table is the held-out average within a few points', () => {
    const anchors = COMBAT.outcomeTargets.ratios;
    anchors.forEach((ratio, i) => {
      const near = read().validation.filter(v => Math.abs(v.ratio - ratio) < .05);
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(near.length, `1:${String(ratio)}`).toBeGreaterThanOrEqual(25);
      expect(Math.abs(mean(near.map(v => v.strongLost)) - COMBAT.outcomeTargets.strongLost[i]!), `strong 1:${String(ratio)}`).toBeLessThanOrEqual(.03);
      expect(Math.abs(mean(near.map(v => v.weakKept)) - COMBAT.outcomeTargets.weakKept[i]!), `weak 1:${String(ratio)}`).toBeLessThanOrEqual(.04);
    });
  });
});
