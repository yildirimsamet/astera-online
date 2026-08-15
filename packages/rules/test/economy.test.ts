import { describe, expect, it } from 'vitest';
import {
  ECON,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  paybackHours,
  productiveMinutes,
  storageCap,
  upgradeCost,
  vaultProtects,
  worthInvesting,
} from '../src/index.js';

describe('production and cost curves', () => {
  it('production grows with level', () => {
    expect(alloyRate(10)).toBeGreaterThan(alloyRate(5));
    expect(alloyRate(0)).toBeCloseTo(ECON.alloyBase, 5);
  });

  it('charges crystal only from the gate level', () => {
    expect(upgradeCost(0).crystal).toBe(0);
    expect(upgradeCost(ECON.crystalCostFromLevel - 1).crystal).toBe(0);
    expect(upgradeCost(ECON.crystalCostFromLevel).crystal).toBeGreaterThan(0);
  });

  it('payback lengthens with level — the brake on a runaway season', () => {
    const curve = [1, 5, 10, 15].map(paybackHours);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!).toBeGreaterThan(curve[i - 1]!);
    }
    expect(paybackHours(1)).toBeGreaterThan(6);
    expect(paybackHours(15)).toBeLessThan(48);
  });

  it('stops being rational near the end of a season — the sunset phase', () => {
    expect(worthInvesting(10, 300)).toBe(true);
    expect(worthInvesting(10, 12)).toBe(false);
  });
});

describe('the vault invariant', () => {
  it('vaultMult stays below alloyMult', () => {
    expect(ECON.vaultMult).toBeLessThan(ECON.alloyMult);
  });

  /**
   * REGRESSION: the first draft shipped vaultMult 1.50 against alloyMult 1.45.
   * Protection compounded faster than the stock it protected, so from level 3 the
   * vault covered 208-301% of storage and nothing in the galaxy was raidable for
   * an entire season — silently, with no other symptom.
   */
  it('never protects more than storage can hold', () => {
    for (let level = 0; level <= 20; level++) {
      const cap = storageCap(alloyRate(level));
      expect(vaultProtects(level)).toBeLessThan(cap);
    }
  });

  it('protects a shrinking share as a player grows', () => {
    const share = (l: number) => vaultProtects(l) / storageCap(alloyRate(l));
    expect(share(10)).toBeLessThan(share(3));
    expect(share(16)).toBeLessThan(share(10));
  });

  it('protects something even with no Vault built', () => {
    expect(vaultProtects(0)).toBeGreaterThan(0);
  });
});

describe('lazy economy', () => {
  const input = { refineryLevel: 5, extractorLevel: 4, aegisLevel: 0 };
  const fresh = () => ({
    alloy: 0,
    crystal: 0,
    shield: 0,
    lastTickMinutes: 0,
    disruptedUntilMinutes: 0,
  });

  it('accrues exactly one hour of production in one hour', () => {
    const after = advanceEconomy(fresh(), input, 60);
    expect(after.alloy).toBeCloseTo(alloyRate(5), 4);
  });

  it('clamps at the storage cap', () => {
    const after = advanceEconomy(fresh(), input, 60 * 500);
    expect(after.alloy).toBe(storageCap(alloyRate(5)));
  });

  it('produces nothing while disrupted', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 120 };
    expect(advanceEconomy(state, input, 120).alloy).toBe(0);
  });

  it('resumes for the minutes after disruption ends', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 60 };
    const after = advanceEconomy(state, input, 120);
    expect(after.alloy).toBeCloseTo(alloyRate(5), 4);
  });

  it('is idempotent — advancing to the same time twice changes nothing', () => {
    const once = advanceEconomy(fresh(), input, 90);
    const twice = advanceEconomy(once, input, 90);
    expect(twice.alloy).toBe(once.alloy);
  });

  it('regenerates shields during disruption — it is a separate system', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 600 };
    const after = advanceEconomy(state, { ...input, aegisLevel: 5 }, 300);
    expect(after.shield).toBeGreaterThan(0);
  });
});

describe('disruption', () => {
  it('refreshes rather than stacking', () => {
    const first = applyDisruption(0, 0, 'DECISIVE');
    const second = applyDisruption(first, 10, 'DECISIVE');
    expect(second).toBeLessThanOrEqual(10 + 240);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('cannot be pushed beyond the pending cap by chain-raiding', () => {
    let until = 0;
    for (let i = 0; i < 20; i++) until = applyDisruption(until, i, 'DECISIVE');
    expect(until - 19).toBeLessThanOrEqual(240);
  });

  it('a repelled raid disrupts nothing', () => {
    expect(applyDisruption(0, 0, 'REPELLED')).toBe(0);
  });

  it('productiveMinutes never exceeds the span', () => {
    expect(productiveMinutes(0, 100, 0)).toBe(100);
    expect(productiveMinutes(0, 100, 40)).toBe(60);
    expect(productiveMinutes(0, 100, 500)).toBe(0);
    expect(productiveMinutes(100, 50, 0)).toBe(0);
  });
});
