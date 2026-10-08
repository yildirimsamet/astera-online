import { describe, expect, it } from 'vitest';
import {
  SHIELD,
  SILENT_SPACE,
  advanceEconomy,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumCollectorCap,
  deuteriumRate,
  shieldHp,
} from '../src/index.js';

/**
 * SILENT SPACE RUNS THE WORKS AT HALF SPEED. D212, owner rule 2026-10-07.
 *
 * The pace slows what the works PRODUCE per hour and nothing else: the collector and
 * the store keep their size, so a commander who returns to the main galaxy is never
 * clamped down to a smaller vessel.
 */
describe('the lazy tick at the Silent Space pace', () => {
  const input = {
    refineryLevel: 5,
    extractorLevel: 4,
    plantLevel: 3,
    aegisLevel: 2,
    vaultLevel: 0,
  };
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
  const pace = SILENT_SPACE.productionPace;

  it('fills the works at half the rate', () => {
    const slow = advanceEconomy(fresh(), { ...input, pace }, 60);
    expect(slow.bufferAlloy).toBeCloseTo(alloyRate(5) * 0.5, 6);
    expect(slow.bufferCrystal).toBeCloseTo(crystalRate(4) * 0.5, 6);
    expect(slow.bufferDeuterium).toBeCloseTo(deuteriumRate(3) * 0.5, 6);
  });

  it('reads exactly as before at the ordinary pace', () => {
    expect(advanceEconomy(fresh(), { ...input, pace: 1 }, 60)).toEqual(advanceEconomy(fresh(), input, 60));
  });

  it('keeps the same collector ceilings', () => {
    const full = advanceEconomy(fresh(), { ...input, pace }, 60 * 500);
    expect(full.bufferAlloy).toBe(collectorCap(alloyRate(5)));
    expect(full.bufferCrystal).toBe(collectorCap(crystalRate(4)));
    expect(full.bufferDeuterium).toBe(deuteriumCollectorCap(deuteriumRate(3), crystalRate(4)));
  });

  it('stacks with the recovery boost by multiplication', () => {
    const both = advanceEconomy(fresh(), { ...input, pace, recoveryBoostUntilMinutes: 360 }, 60);
    expect(both.bufferAlloy).toBeCloseTo(alloyRate(5) * 1.5 * 0.5, 6);
  });

  it('leaves shield regeneration on wall time', () => {
    const slow = advanceEconomy(fresh(), { ...input, pace }, 60);
    expect(slow.shield).toBeCloseTo(shieldHp(2) * SHIELD.regenPerHour, 6);
  });

  it('refuses a pace that would invent or reverse production', () => {
    for (const bad of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY]) {
      expect(() => advanceEconomy(fresh(), { ...input, pace: bad }, 60)).toThrow(RangeError);
    }
  });
});
