import { describe, expect, it } from 'vitest';
import {
  advanceEconomy, alloyRate, collectorCap, crystalRate, deuteriumCollectorCap, deuteriumRate,
  SILENT_SPACE, storageCap, vaultProtects,
  type PlanetEconomyInput, type PlanetEconomyState,
} from '../src/index.js';

const fresh = (): PlanetEconomyState => ({
  alloy: 1_000, crystal: 1_000, deuterium: 1_000,
  bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
  shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
});

const input: PlanetEconomyInput = {
  refineryLevel: 10, extractorLevel: 10, plantLevel: 10,
  aegisLevel: 0, vaultLevel: 5,
};

describe('Honor Tier -4 production penalty (-25%)', () => {
  it('reduces hourly production of Alloy, Crystal and Deuterium by 25%', () => {
    const base = advanceEconomy(fresh(), input, 60);
    const pen = advanceEconomy(fresh(), { ...input, honorProductionShare: -0.25 }, 60);
    expect(pen.bufferAlloy).toBeCloseTo(base.bufferAlloy * 0.75, 9);
    expect(pen.bufferCrystal).toBeCloseTo(base.bufferCrystal * 0.75, 9);
    expect(pen.bufferDeuterium).toBeCloseTo(base.bufferDeuterium * 0.75, 9);
    expect(advanceEconomy(fresh(), { ...input, honorProductionShare: 0 }, 60)).toEqual(base);
  });

  it('multiplies cleanly with clanBonus and Silent Space pace', () => {
    const base = advanceEconomy(fresh(), input, 60);
    const combined = advanceEconomy(fresh(), {
      ...input, clanBonus: 0.1, pace: SILENT_SPACE.productionPace, honorProductionShare: -0.25,
    }, 60);
    const mult = 1.1 * SILENT_SPACE.productionPace * 0.75;
    expect(combined.bufferAlloy).toBeCloseTo(base.bufferAlloy * mult, 9);
    expect(combined.bufferCrystal).toBeCloseTo(base.bufferCrystal * mult, 9);
    expect(combined.bufferDeuterium).toBeCloseTo(base.bufferDeuterium * mult, 9);
  });

  it('keeps collector caps, storage caps, vault floor, and VAULT_LEAK nominal', () => {
    const full = advanceEconomy(fresh(), { ...input, honorProductionShare: -0.25 }, 60 * 500);
    expect(full.bufferAlloy).toBeCloseTo(collectorCap(alloyRate(input.refineryLevel)), 9);
    expect(full.bufferCrystal).toBeCloseTo(collectorCap(crystalRate(input.extractorLevel)), 9);
    expect(full.bufferDeuterium).toBeCloseTo(
      deuteriumCollectorCap(deuteriumRate(input.plantLevel), crystalRate(input.extractorLevel)),
      9,
    );
    expect(storageCap(alloyRate(input.refineryLevel), input.vaultLevel)).toBeGreaterThan(0);
    expect(vaultProtects(input.vaultLevel, input.refineryLevel, input.extractorLevel, input.plantLevel).alloy).toBeGreaterThan(0);

    const leakBase = advanceEconomy(fresh(), { ...input, faults: ['VAULT_LEAK'] }, 60);
    const leakPen = advanceEconomy(fresh(), { ...input, faults: ['VAULT_LEAK'], honorProductionShare: -0.25 }, 60);
    expect(leakPen.pendingLeakAlloy).toBeCloseTo(leakBase.pendingLeakAlloy ?? 0, 9);
    expect(leakPen.pendingLeakCrystal).toBeCloseTo(leakBase.pendingLeakCrystal ?? 0, 9);
    expect(leakPen.pendingLeakDeuterium).toBeCloseTo(leakBase.pendingLeakDeuterium ?? 0, 9);
  });

  it('rejects out-of-range or non-finite honorProductionShare values', () => {
    for (const bad of [-1, -1.1, 0.01, 0.25, Number.NaN, Infinity, -Infinity]) {
      expect(() => advanceEconomy(fresh(), { ...input, honorProductionShare: bad }, 60)).toThrow(RangeError);
    }
  });
});
