import { describe, expect, it } from 'vitest';
import {
  NEWCOMER_HOUR, UNKNOWN_SIGNAL, advanceEconomy, alloyRate, collectorCap, crystalRate, deuteriumRate, newcomerBoostUntil,
  newcomerExtraHours,
} from '../src/index.js';

/**
 * KURULUŞ SAATİ (plan 2026-11-20 §5.1). A first game's first hour in the main galaxy makes five times
 * the alloy and crystal, on the wall clock from the landing. Deuterium is not boosted (owner).
 */
describe('the newcomer hour', () => {
  it('is one wall-clock hour of five-fold alloy and crystal', () => {
    expect(NEWCOMER_HOUR).toEqual({ minutes: 60, productionBonus: 4 });
  });

  it('opens at the landing of a first game only', () => {
    const landed = Date.parse('2026-11-20T10:00:00.000Z');
    expect(newcomerBoostUntil(landed, true)).toBe(Date.parse('2026-11-20T11:00:00.000Z'));
    expect(newcomerBoostUntil(landed, false)).toBeNull();
  });

  it.each([
    // from, to, disruptedUntil, until, extra hours (bonus 4 on productive minutes inside the window)
    [0, 60, 0, 60, 4],
    [0, 120, 0, 60, 4],
    [30, 120, 0, 60, 2],
    [0, 60, 0, 59.99, 4 * 59.99 / 60],
    [60, 120, 0, 60, 0],
    [0, 60, 30, 60, 2],
    [0, 60, 0, null, 0],
    [0, 60, 0, Number.NaN, 0],
  ])('pays the bonus on productive minutes before the window ends (%s → %s, disrupted %s, until %s)', (from, to, disrupted, until, extra) => {
    expect(newcomerExtraHours(from, to, disrupted, until)).toBeCloseTo(extra, 9);
  });
});

describe('the newcomer hour in the shared economy', () => {
  const input = { refineryLevel: 2, extractorLevel: 2, plantLevel: 1, aegisLevel: 1, vaultLevel: 1 };
  const fresh = () => ({
    alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
    shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  });

  it('makes five times the alloy and crystal inside the hour, and ordinary deuterium', () => {
    const after = advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: 60 }, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(2) * 5, 6);
    expect(after.bufferCrystal).toBeCloseTo(crystalRate(2) * 5, 6);
    expect(after.bufferDeuterium).toBeCloseTo(deuteriumRate(1), 6);
  });

  it('runs at the ordinary rate once the hour is over, across one long tick', () => {
    const after = advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: 60 }, 180);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(2) * (3 + 4), 6);
  });

  it('adds to the signal\'s energy bonus, which alone also reaches deuterium', () => {
    const after = advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: 60, signalBoostUntilMinutes: 60 }, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(2) * (5 + UNKNOWN_SIGNAL.energyProductionBonus), 6);
    expect(after.bufferDeuterium).toBeCloseTo(deuteriumRate(1) * (1 + UNKNOWN_SIGNAL.energyProductionBonus), 6);
  });

  it('fills the same collectors faster and never makes them bigger', () => {
    const after = advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: 30_000 }, 30_000);
    expect(after.bufferAlloy).toBe(collectorCap(alloyRate(2)));
    expect(after.bufferCrystal).toBe(collectorCap(crystalRate(2)));
  });

  it('leaves every world without the window exactly as it was', () => {
    expect(advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: null }, 90)).toEqual(advanceEconomy(fresh(), input, 90));
  });

  it('pays the same in one tick as in many', () => {
    const whole = advanceEconomy(fresh(), { ...input, newcomerBoostUntilMinutes: 60 }, 100);
    const pieces = [17, 44, 60, 73, 100].reduce((state, minute) => advanceEconomy(state, { ...input, newcomerBoostUntilMinutes: 60 }, minute), fresh());
    expect(pieces.bufferAlloy).toBeCloseTo(whole.bufferAlloy, 6);
    expect(pieces.bufferCrystal).toBeCloseTo(whole.bufferCrystal, 6);
  });
});
