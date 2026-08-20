import { describe, expect, it } from 'vitest';
import {
  ECON,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  collect,
  collectorCap,
  minutesUntilCollectorFull,
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

  /**
   * The brake is the GROWTH, not the height.
   *
   * Payback rises by `costMult / alloyMult` per level, and that ratio is the only
   * thing stopping a season running away. D17 doubled income, which halves every
   * payback and would have carried a 14-day season to Core 15-16 — far past the
   * band the combat economy was ever balanced in, where ground defence outgrows
   * any fleet that can be fielded against it. `costMult` was raised to 1.70 to put
   * the arc back where D5 designed it, and the simulator confirms it: Core 10 at
   * day 14 on all three gate seeds.
   *
   * L10 is the anchor because L10 is where a season now ENDS — that is the number
   * a player actually experiences. L15 is checked only as a runaway guard; nobody
   * reaches it, and its job is to be expensive enough that nobody tries.
   */
  it('payback lengthens with level — the brake on a runaway season', () => {
    const curve = [1, 5, 10, 15].map(paybackHours);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!).toBeGreaterThan(curve[i - 1]!);
    }
    expect(paybackHours(1)).toBeGreaterThan(4);
    expect(paybackHours(10)).toBeLessThan(30);
    expect(paybackHours(15)).toBeLessThan(80);
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
    bufferAlloy: 0,
    bufferCrystal: 0,
    shield: 0,
    lastTickMinutes: 0,
    disruptedUntilMinutes: 0,
  });

  it('accrues exactly one hour of production in one hour', () => {
    const after = advanceEconomy(fresh(), input, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(5), 4);
  });

  /**
   * D16. The single most surprising consequence of the collector, and the one a
   * future reader is most likely to mistake for a bug: an untouched planet's
   * SPENDABLE stock does not move at all.
   */
  it('puts production in the works, never straight into storage', () => {
    const after = advanceEconomy(fresh(), input, 60 * 4);
    expect(after.alloy).toBe(0);
    expect(after.crystal).toBe(0);
    expect(after.bufferAlloy).toBeGreaterThan(0);
  });

  it('clamps at the collector cap, not the storage cap', () => {
    const after = advanceEconomy(fresh(), input, 60 * 500);
    expect(after.bufferAlloy).toBe(collectorCap(alloyRate(5)));
    expect(collectorCap(alloyRate(5))).toBeLessThan(storageCap(alloyRate(5)));
  });

  it('produces nothing while disrupted', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 120 };
    expect(advanceEconomy(state, input, 120).bufferAlloy).toBe(0);
  });

  it('resumes for the minutes after disruption ends', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 60 };
    const after = advanceEconomy(state, input, 120);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(5), 4);
  });

  it('is idempotent — advancing to the same time twice changes nothing', () => {
    const once = advanceEconomy(fresh(), input, 90);
    const twice = advanceEconomy(once, input, 90);
    expect(twice.bufferAlloy).toBe(once.bufferAlloy);
  });

  it('regenerates shields during disruption — it is a separate system', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 600 };
    const after = advanceEconomy(state, { ...input, aegisLevel: 5 }, 300);
    expect(after.shield).toBeGreaterThan(0);
  });
});

/**
 * THE COLLECTOR — D16.
 *
 * The one manual step in the whole economy, so its edges matter more than most:
 * a player who taps and loses ore, or taps and gets nothing without being told
 * why, will stop tapping.
 */
describe('collecting the works', () => {
  const input = { refineryLevel: 5, extractorLevel: 4, aegisLevel: 0 };
  const fresh = () => ({
    alloy: 0,
    crystal: 0,
    bufferAlloy: 0,
    bufferCrystal: 0,
    shield: 0,
    lastTickMinutes: 0,
    disruptedUntilMinutes: 0,
  });

  it('moves the buffer into storage and empties the works', () => {
    const filled = advanceEconomy(fresh(), input, 60 * 3);
    const { state, moved } = collect(filled, input);

    expect(moved.alloy).toBeCloseTo(alloyRate(5) * 3, 4);
    expect(state.alloy).toBeCloseTo(moved.alloy, 4);
    expect(state.bufferAlloy).toBe(0);
  });

  it('restarts production that the full buffer had stopped', () => {
    const stalled = advanceEconomy(fresh(), input, 60 * 500);
    expect(stalled.bufferAlloy).toBe(collectorCap(alloyRate(5)));

    const emptied = collect(stalled, input).state;
    const later = advanceEconomy({ ...emptied, lastTickMinutes: 60 * 500 }, input, 60 * 501);
    expect(later.bufferAlloy).toBeCloseTo(alloyRate(5), 4);
  });

  it('collecting twice in a row moves nothing the second time', () => {
    const filled = advanceEconomy(fresh(), input, 60 * 3);
    const once = collect(filled, input);
    const twice = collect(once.state, input);
    expect(twice.moved).toEqual({ alloy: 0, crystal: 0 });
    expect(twice.state.alloy).toBeCloseTo(once.state.alloy, 6);
  });

  /**
   * A tap that destroys ore is a tap players learn not to press. What will not fit
   * stays where it was, and the interface says so.
   */
  it('leaves what does not fit in the works rather than destroying it', () => {
    const full = {
      ...fresh(),
      alloy: storageCap(alloyRate(5)),
      bufferAlloy: 5_000,
    };
    const { state, moved, blocked } = collect(full, input);

    expect(moved.alloy).toBe(0);
    expect(blocked.alloy).toBe(5_000);
    expect(state.bufferAlloy).toBe(5_000);
  });

  it('partially fills a nearly-full store and holds the remainder back', () => {
    const cap = storageCap(alloyRate(5));
    const state = { ...fresh(), alloy: cap - 100, bufferAlloy: 900 };
    const result = collect(state, input);

    expect(result.moved.alloy).toBe(100);
    expect(result.blocked.alloy).toBe(800);
    expect(result.state.alloy).toBe(cap);
    expect(result.state.bufferAlloy).toBe(800);
  });

  // Within a minute, not exact: the cap is rounded to a whole resource so the
  // interface has an integer to print, and the countdown divides by the unrounded
  // rate. Demanding exactness here would be demanding a fractional cap.
  it('reports how long is left before the works stop', () => {
    const rate = alloyRate(5);
    expect(minutesUntilCollectorFull(0, rate)).toBeCloseTo(ECON.collectorHours * 60, 0);
    expect(minutesUntilCollectorFull(collectorCap(rate), rate)).toBeNull();
    expect(minutesUntilCollectorFull(0, 0)).toBeNull();
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
