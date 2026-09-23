import { describe, expect, it } from 'vitest';
import {
  SALVAGE,
  ABUSE,
  GROUND_HULLS,
  HULLS,
  alloyRate,
  buildingCost,
  crystalRate,
  deuteriumRate,
  hullFuelRate,
  satelliteSlots,
} from '../src/index.js';

const value = (cost: { alloy: number; crystal: number; deuterium: number }): number =>
  cost.alloy + cost.crystal * 2 + cost.deuterium * 32;

describe('owner requests from 2026-09-20', () => {
  /**
   * THE FIGURE MOVED, THE RULE DID NOT. The 2026-09-20 request was that the card quote a hand-set
   * thirst at all, rather than one derived from the hull's price — and it still does. The number
   * itself was raised to 100 on 2026-09-22 as part of the collector's recalibration, so this asks
   * the constant rather than a remembered figure. See `collector-calibration.test.ts`.
   */
  it('quotes the Garbage Collector at its hand-set deuterium thirst', () => {
    expect(hullFuelRate('GARBAGE_COLLECTOR')).toBe(SALVAGE.fuelMass / 10);
    expect(SALVAGE.fuelMass).toBe(1_000);
  });

  it('opens satellite slots only at Command Core 6, 9, 12 and 15', () => {
    expect(Array.from({ length: 17 }, (_, core) => satelliteSlots(core))).toEqual([
      0, 0, 0, 0, 0, 0,
      1, 1, 1,
      2, 2, 2,
      3, 3, 3,
      4, 4,
    ]);
  });

  it('has a stationary Lance-class answer in the ground-defence roster', () => {
    const lance = GROUND_HULLS.find((id) => HULLS[id].cls === 'LANCE');
    expect(lance).toBe('HARPOON');
    expect(HULLS.HARPOON).toMatchObject({ ground: true, speed: 0, cls: 'LANCE' });
  });

  it('uses the requested recovery window, boost and loss threshold', () => {
    expect(ABUSE.recoveryShieldHours).toBe(8);
    expect(ABUSE.recoveryProductionMult).toBe(1.5);
    expect(ABUSE.recoveryLossHours).toBe(4);
  });

  it('makes late producer gains accelerate across all three resources', () => {
    for (const rate of [alloyRate, crystalRate, deuteriumRate]) {
      const gains = [rate(14) - rate(13), rate(15) - rate(14), rate(16) - rate(15)];
      expect(gains[1]!).toBeGreaterThan(gains[0]!);
      expect(gains[2]!).toBeGreaterThan(gains[1]!);
    }
    expect(alloyRate(14)).toBeGreaterThanOrEqual(2_400);
    expect(alloyRate(15)).toBeGreaterThanOrEqual(2_750);
  });

  it('slows late upgrade-cost growth for every refinery', () => {
    for (const id of ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT'] as const) {
      for (let level = 13; level < 20; level += 1) {
        const growth = value(buildingCost(id, level)) / value(buildingCost(id, level - 1));
        expect(growth, `${id} L${String(level)} cost growth`).toBeLessThan(1.4);
      }
    }
  });
});
