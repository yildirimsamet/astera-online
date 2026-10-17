import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_SIGNAL, advanceEconomy, alloyRate, collectorCap, crystalRate,
  deuteriumCollectorCap, deuteriumRate, productionHours,
} from '../src/index.js';

describe('unknown signal production hours', () => {
  it('grants a +100% signal bonus and adds recovery for a combined 2.5x', () => {
    expect(UNKNOWN_SIGNAL.energyProductionBonus).toBe(1);
    expect(UNKNOWN_SIGNAL.energyHours).toEqual([1, 2, 3, 4]);
    expect(productionHours(0, 60, 0, null, 60)).toBe(2);
    expect(productionHours(0, 60, 0, 60, null)).toBe(1.5);
    expect(productionHours(0, 60, 0, 60, 60)).toBe(2.5);
  });

  it.each([
    [0, 120, 0, 60, 120, 4.5],
    [0, 120, 0, 120, 60, 4],
    [0, 120, 0, null, 60, 3],
    [60, 120, 0, 90, 90, 1.75],
    [0, 120, 30, 60, 90, 2.75],
    [0, 120, 60, 30, 45, 1],
    [0, 120, 120, 180, 180, 0],
    [60, 120, 0, 60, 60, 1],
    [60, 60, 0, 120, 120, 0],
    [120, 60, 0, 180, 180, 0],
  ])('integrates productive windows (%s, %s, %s, %s, %s)', (from, to, disruption, recovery, signal, hours) => {
    expect(productionHours(from, to, disruption, recovery, signal)).toBe(hours);
  });

  it.each([null, Number.NaN, Infinity, -Infinity])('ignores an invalid signal deadline %s independently of recovery', signal => {
    expect(productionHours(0, 60, 0, null, signal)).toBe(1);
    expect(productionHours(0, 60, 0, 60, signal)).toBe(1.5);
  });

  it.each([null, Number.NaN, Infinity, -Infinity])('keeps signal production when recovery is absent or invalid: %s', recovery => {
    expect(productionHours(0, 60, 0, recovery, 60)).toBe(2);
  });

  it('is independent of lazy tick boundaries at both boost deadlines', () => {
    const whole = productionHours(0, 180, 30, 120, 90);
    const pieces = [[0, 30], [30, 60], [60, 90], [90, 120], [120, 180]] as const;
    expect(pieces.reduce((sum, [from, to]) => sum + productionHours(from, to, 30, 120, 90), 0))
      .toBeCloseTo(whole, 10);
  });
});

describe('unknown signal boost in the shared economy', () => {
  const input = { refineryLevel: 5, extractorLevel: 4, plantLevel: 3, aegisLevel: 2, vaultLevel: 0 };
  const fresh = () => ({
    alloy: 12, crystal: 7, deuterium: 3,
    bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
    shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  });

  it.each([null, 60])('pays the signal bonus on all three resources with recovery %s', recovery => {
    const factor = recovery === null ? 2 : 2.5;
    const after = advanceEconomy(fresh(), {
      ...input, recoveryBoostUntilMinutes: recovery, signalBoostUntilMinutes: 60,
    }, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(5) * factor, 6);
    expect(after.bufferCrystal).toBeCloseTo(crystalRate(4) * factor, 6);
    expect(after.bufferDeuterium).toBeCloseTo(deuteriumRate(3) * factor, 6);
    expect([after.alloy, after.crystal, after.deuterium]).toEqual([12, 7, 3]);
    expect(after.shield).toBe(advanceEconomy(fresh(), input, 60).shield);
  });

  it('preserves old economy inputs exactly', () => {
    const recovery = { ...input, recoveryBoostUntilMinutes: 60 };
    expect(advanceEconomy(fresh(), { ...recovery, signalBoostUntilMinutes: null }, 60))
      .toEqual(advanceEconomy(fresh(), recovery, 60));
  });

  it('fills the same collectors rather than enlarging them', () => {
    const after = advanceEconomy(fresh(), {
      ...input, recoveryBoostUntilMinutes: 30_000, signalBoostUntilMinutes: 30_000,
    }, 30_000);
    expect(after.bufferAlloy).toBe(collectorCap(alloyRate(5)));
    expect(after.bufferCrystal).toBe(collectorCap(crystalRate(4)));
    expect(after.bufferDeuterium).toBe(deuteriumCollectorCap(deuteriumRate(3), crystalRate(4)));
  });

  it('only pays for productive minutes before the signal expires', () => {
    const after = advanceEconomy({ ...fresh(), disruptedUntilMinutes: 30 }, {
      ...input, signalBoostUntilMinutes: 90, recoveryBoostUntilMinutes: 60,
    }, 120);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(5) * 2.75, 6);
  });

  it('preserves the signal window when advancing through the production tempo cutover', () => {
    const boosted = {
      ...input, signalBoostUntilMinutes: 90, recoveryBoostUntilMinutes: 120,
      productionTempoStartsAtMinutes: 30,
    };
    const split = advanceEconomy(advanceEconomy(fresh(), boosted, 30), boosted, 120);
    expect(advanceEconomy(fresh(), boosted, 120)).toEqual(split);
  });
});
