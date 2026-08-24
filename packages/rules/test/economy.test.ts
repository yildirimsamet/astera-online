import { describe, expect, it } from 'vitest';
import {
  DISRUPTION,
  ECON,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  collect,
  collectorCap,
  crystalRate,
  deuteriumStorageCap,
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
    // `base x L x growth^L`: level 0 produces nothing, which is correct — a planet
    // is created with the Refinery at 1 and it can never go down.
    expect(alloyRate(0)).toBe(0);
    expect(alloyRate(1)).toBeCloseTo(ECON.alloyBase * ECON.alloyMult, 5);
  });

  /**
   * THE DOPAMINE THE OPENING IS BUILT ON. The linear factor is what makes the
   * first upgrade more than double a commander's output; a pure exponential can
   * only ever add `growth - 1`.
   */
  it('more than doubles output on the first upgrade, and decays after', () => {
    expect(alloyRate(2) / alloyRate(1)).toBeGreaterThan(2);
    expect(alloyRate(18) / alloyRate(17)).toBeLessThan(1.2);
  });

  /**
   * CHARGED FROM THE FIRST RUNG. A crystal cost that starts one level late leaves
   * a fresh commander watching a resource accumulate that buys nothing — which is
   * decoration, not scarcity.
   */
  it('charges crystal from the very first upgrade', () => {
    expect(ECON.crystalCostFromLevel).toBe(0);
    expect(upgradeCost(0).crystal).toBeGreaterThan(0);
    expect(upgradeCost(5).crystal).toBeGreaterThan(upgradeCost(0).crystal);
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
    // The opening has to repay inside a session — that is the day-zero dopamine.
    expect(paybackHours(1)).toBeLessThan(1);
    // ...and the late game has to stop repaying inside a season, or it runs away.
    expect(paybackHours(10)).toBeGreaterThan(4);
    expect(paybackHours(18)).toBeGreaterThan(24);
  });

  /**
   * THE SUNSET, AND NOTHING ANNOUNCES IT. Every commander independently stops
   * building on the last day because the arithmetic stops paying, not because a
   * rule fires.
   */
  it('stops being rational near the end of a season — the sunset phase', () => {
    expect(worthInvesting(10, 300)).toBe(true);
    expect(worthInvesting(10, 6)).toBe(false);
    // Deep in the ladder it is already irrational with days left to run.
    expect(worthInvesting(18, 72)).toBe(false);
  });
});

describe('the vault invariant', () => {
  /**
   * THE RULE THAT REPLACED `vaultMult < alloyMult`.
   *
   * Both guard the same silent failure: protection that outgrows the stock it
   * protects eventually covers 100% of storage and nothing in the galaxy is
   * raidable, with no other symptom. The first draft shipped 1.50 against an
   * `alloyMult` of 1.45 and killed the whole PvP economy for a season before the
   * simulator caught it.
   *
   * Now that both the store and the floor are measured in HOURS of the same
   * production, the guard is a ratio of two constants rather than a comparison of
   * two exponentials — and it bounds the protected share for every level at once.
   */
  it('can never protect more than half a store, at any Vault level', () => {
    expect(ECON.protectedHoursPerVault / ECON.capHoursPerVault).toBeLessThan(0.5);
  });

  it('never protects more than storage can hold', () => {
    for (let vault = 0; vault <= 16; vault++) {
      for (const producing of [1, 5, 10, 15, 20]) {
        const floor = vaultProtects(vault, producing, producing);
        expect(floor.alloy).toBeLessThan(storageCap(alloyRate(producing), vault));
        expect(floor.crystal).toBeLessThan(storageCap(crystalRate(producing), vault));
      }
    }
  });

  /**
   * WHAT THE VAULT ACTUALLY BUYS, and why the ceiling is the part that matters.
   *
   * PROTECTION IS BUILT, NOT GIVEN. A commander with no Vault keeps about a sixth
   * of their store; one who has spent on it keeps a bit over a quarter. That is a
   * deliberate inversion of the old design, where a beginner was handed most of
   * their protection for free and it decayed as they grew — the beginner is now
   * covered by the tier band and the bash limit instead, and the Vault is a
   * decision rather than a gift.
   *
   * WHAT MUST NEVER MOVE is the ceiling. Both the store and the floor are hours of
   * the same production, so the share can never exceed
   * `protectedHoursPerVault / capHoursPerVault` however much is spent — which is
   * what stops a hoarder walling themselves off, the failure the old
   * `vaultMult < alloyMult` rule guarded against.
   */
  it('lets the Vault buy protection, but never more than the ceiling allows', () => {
    const floor = (v: number) => vaultProtects(v, 12, 12).alloy;
    const share = (v: number) => floor(v) / storageCap(alloyRate(12), v);

    // The building is worth levelling: the amount kept safe rises with it.
    expect(floor(16)).toBeGreaterThan(floor(0) * 2);
    // ...and so does the share, because protection is earned.
    expect(share(16)).toBeGreaterThan(share(0));
    // But never past the bound, at any level, on any world.
    for (const v of [0, 1, 4, 8, 12, 16]) {
      expect(share(v), `Vault ${String(v)}`).toBeLessThan(0.5);
    }
  });

  /**
   * The floor is priced in each resource's OWN production, so one figure sized
   * against alloy can never be charged against crystal. That was D61's bug: a flat
   * 600 covered 88% of a young planet's crystal store and 13 of 26 live raids took
   * nothing at all.
   */
  it('scales each resource against its own income', () => {
    const floor = vaultProtects(8, 12, 12);
    expect(floor.crystal / floor.alloy).toBeCloseTo(crystalRate(12) / alloyRate(12), 2);
    expect(floor.deuterium).toBe(0);
  });

  it('protects something even with no Vault built', () => {
    expect(vaultProtects(0, 1, 1).alloy).toBeGreaterThan(0);
    expect(vaultProtects(0, 1, 1).crystal).toBeGreaterThan(0);
  });
});

describe('lazy economy', () => {
  const input = { refineryLevel: 5, extractorLevel: 4, aegisLevel: 0, vaultLevel: 0 };
  const fresh = () => ({
    alloy: 0,
    crystal: 0,
    deuterium: 0,
    bufferAlloy: 0,
    bufferCrystal: 0,
    bufferDeuterium: 0,
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

  it('never produces Deuterium passively', () => {
    const after = advanceEconomy(
      { ...fresh(), deuterium: 25, bufferDeuterium: 40 },
      input,
      60 * 500,
    );
    expect(after.deuterium).toBe(25);
    expect(after.bufferDeuterium).toBe(40);
  });

  it('clamps at the collector cap, not the storage cap', () => {
    const after = advanceEconomy(fresh(), input, 60 * 500);
    expect(after.bufferAlloy).toBe(collectorCap(alloyRate(5)));
    expect(collectorCap(alloyRate(5))).toBeLessThan(storageCap(alloyRate(5), input.vaultLevel));
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
  const input = { refineryLevel: 5, extractorLevel: 4, aegisLevel: 0, vaultLevel: 0 };
  const fresh = () => ({
    alloy: 0,
    crystal: 0,
    deuterium: 0,
    bufferAlloy: 0,
    bufferCrystal: 0,
    bufferDeuterium: 0,
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
    expect(twice.moved).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(twice.state.alloy).toBeCloseTo(once.state.alloy, 6);
  });

  /**
   * A tap that destroys ore is a tap players learn not to press. What will not fit
   * stays where it was, and the interface says so.
   */
  it('leaves what does not fit in the works rather than destroying it', () => {
    const full = {
      ...fresh(),
      alloy: storageCap(alloyRate(5), input.vaultLevel),
      bufferAlloy: 5_000,
    };
    const { state, moved, blocked } = collect(full, input);

    expect(moved.alloy).toBe(0);
    expect(blocked.alloy).toBe(5_000);
    expect(state.bufferAlloy).toBe(5_000);
  });

  it('partially fills a nearly-full store and holds the remainder back', () => {
    const cap = storageCap(alloyRate(5), input.vaultLevel);
    const state = { ...fresh(), alloy: cap - 100, bufferAlloy: 900 };
    const result = collect(state, input);

    expect(result.moved.alloy).toBe(100);
    expect(result.blocked.alloy).toBe(800);
    expect(result.state.alloy).toBe(cap);
    expect(result.state.bufferAlloy).toBe(800);
  });

  it('collects Deuterium into the Extractor-derived containment cap', () => {
    const cap = deuteriumStorageCap(crystalRate(input.extractorLevel), input.vaultLevel);
    const result = collect(
      { ...fresh(), deuterium: cap - 25, bufferDeuterium: 100 },
      input,
    );

    expect(result.moved.deuterium).toBe(25);
    expect(result.blocked.deuterium).toBe(75);
    expect(result.state.deuterium).toBe(cap);
    expect(result.state.bufferDeuterium).toBe(75);
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
    expect(first).toBe(DISRUPTION.decisiveMinutes);
    // Refreshed from the second raid's own instant, not stacked onto the first.
    expect(second).toBe(Math.min(10 + DISRUPTION.maxPendingMinutes, 10 + DISRUPTION.decisiveMinutes));
    // A weaker raid never shortens what a stronger one already bought.
    expect(applyDisruption(second, 10, 'PARTIAL')).toBe(second);
  });

  it('cannot be pushed beyond the pending cap by chain-raiding', () => {
    let until = 0;
    for (let i = 0; i < 20; i++) until = applyDisruption(until, i, 'DECISIVE');
    // Nineteen raids later, the victim is still only ever this far from the clear.
    expect(until - 19).toBeLessThanOrEqual(DISRUPTION.maxPendingMinutes);
    expect(until - 19).toBe(DISRUPTION.decisiveMinutes);
  });

  it('a repelled raid disrupts nothing', () => {
    expect(applyDisruption(0, 0, 'REPELLED')).toBe(0);
  });

  it('resumes production on the exact minute the disruption ends', () => {
    const input = { refineryLevel: 5, extractorLevel: 4, aegisLevel: 0, vaultLevel: 0 };
    const state = {
      alloy: 0,
      crystal: 0,
      deuterium: 0,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      shield: 0,
      lastTickMinutes: 0,
      disruptedUntilMinutes: 15,
    };
    const atEnd = advanceEconomy(state, input, 15);
    expect(atEnd.bufferAlloy).toBe(0);
    const oneMinuteLater = advanceEconomy(atEnd, input, 16);
    expect(oneMinuteLater.bufferAlloy).toBeCloseTo(alloyRate(5) / 60, 6);
  });

  it('productiveMinutes never exceeds the span', () => {
    expect(productiveMinutes(0, 100, 0)).toBe(100);
    expect(productiveMinutes(0, 100, 40)).toBe(60);
    expect(productiveMinutes(0, 100, 500)).toBe(0);
    expect(productiveMinutes(100, 50, 0)).toBe(0);
  });
});
