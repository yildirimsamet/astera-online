import { describe, expect, it } from 'vitest';
import { honorBenefits, honorConvoyResources, honorRepairResources, honorTradeResources,
  type HonorBenefitThresholds } from '../src/honorBenefits.js';
import { repairPct, shipHpRepairCost, shipHpRepairMinutes } from '../src/index.js';

const thresholds: HonorBenefitThresholds = { positive: [25_000_000, 75_000_000], negative: [25_000_000, 100_000_000] };
const pile = { alloy: 1000, crystal: 500, deuterium: 100 };

describe('parameterised Honor economic effects', () => {
  it.each([
    [-100_000_001, -2, 10, -30, 14], [-100_000_000, -2, 10, -30, 14],
    [-99_999_999, -1, 5, -15, 7], [-25_000_000, -1, 5, -15, 7],
    [-24_999_999, 0, 0, 0, 0], [0, 0, 0, 0, 0], [24_999_999, 0, 0, 0, 0],
    [25_000_000, 1, -5, 15, 0], [74_999_999, 1, -5, 15, 0], [75_000_000, 2, -10, 30, 0],
  ])('maps micro-Honor %s to inclusive fixed tier %s', (score, tier, repairPct, convoyPct, tradePct) => {
    expect(honorBenefits(score, thresholds)).toEqual({ tier, repairPct, convoyPct, tradePct });
  });

  it('has no economic effects without a frozen enabled policy, including negative scores', () => {
    expect(honorBenefits(-999_000_000, null)).toEqual({ tier: 0, repairPct: 0, convoyPct: 0, tradePct: 0 });
  });

  it('rejects invalid scores and nonascending, zero or unsafe thresholds', () => {
    for (const score of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => honorBenefits(score, thresholds)).toThrow();
    for (const positive of [[0, 75_000_000], [75_000_000, 25_000_000], [25_000_000, 25_000_000], [1.5, 2]] as const) {
      expect(() => honorBenefits(0, { ...thresholds, positive })).toThrow();
    }
    expect(() => honorBenefits(0, { ...thresholds, negative: [0, 1] })).toThrow();
  });

  it('prices only the repair resources and rounds the actual bill once upward', () => {
    const benefit = honorBenefits(75_000_000, thresholds);
    expect(honorRepairResources(pile, benefit)).toEqual({ alloy: 900, crystal: 450, deuterium: 90 });
    expect(honorRepairResources({ alloy: 1, crystal: 0, deuterium: 0 }, benefit)).toEqual({ alloy: 1, crystal: 0, deuterium: 0 });
    expect(honorRepairResources(pile, honorBenefits(-25_000_000, thresholds))).toEqual({ alloy: 1050, crystal: 525, deuterium: 105 });
  });

  it.each([0, 1, 2, 3, 4])('applies Honor after the existing Industrial %s share without changing research or duration', (level) => {
    const tech = { INDUSTRIAL: level };
    const pct = repairPct(tech);
    const lots = [{ hull: 'BALLISTA' as const, count: 3, damageBp: 6400, remainderBp: .25 }];
    const base = shipHpRepairCost(lots, pct);
    const time = shipHpRepairMinutes(lots, 4, tech, pct);
    const discount = honorRepairResources(base, honorBenefits(75_000_000, thresholds));
    const surcharge = honorRepairResources(base, honorBenefits(-100_000_000, thresholds));
    for (const good of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(discount[good]).toBe(Math.ceil(base[good] * 9 / 10));
      expect(surcharge[good]).toBe(Math.ceil(base[good] * 11 / 10));
    }
    expect(shipHpRepairMinutes(lots, 4, tech, pct)).toBe(time);
    expect(repairPct(tech)).toBe(pct);
  });

  it('caps the resource bonus by cargo and still penalises a full hold; never modifies a ship prize', () => {
    const benefit = honorBenefits(75_000_000, thresholds);
    expect(honorConvoyResources(pile, 10000, benefit)).toEqual({ alloy: 1300, crystal: 650, deuterium: 130 });
    expect(honorConvoyResources(pile, 1600, benefit)).toEqual(pile);
    expect(honorConvoyResources(pile, 0, benefit)).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(honorConvoyResources(pile, 10000, honorBenefits(-100_000_000, thresholds))).toEqual({ alloy: 700, crystal: 350, deuterium: 70 });
    expect(honorConvoyResources(pile, 800, honorBenefits(-100_000_000, thresholds))).toEqual({ alloy: 350, crystal: 175, deuterium: 35 });
    expect(honorConvoyResources({ alloy: 10, crystal: 7, deuterium: 3 }, 7, honorBenefits(0, thresholds)))
      .toEqual({ alloy: 3, crystal: 2, deuterium: 1 });
  });

  it('shows gross, net and exact commission without charging twice or inventing fractional resources', () => {
    const fee = honorBenefits(-100_000_000, thresholds);
    expect(honorTradeResources(pile, fee)).toEqual({ net: { alloy: 860, crystal: 430, deuterium: 86 },
      commission: { alloy: 140, crystal: 70, deuterium: 14 } });
    expect(honorTradeResources(pile, honorBenefits(0, thresholds))).toEqual({ net: pile,
      commission: { alloy: 0, crystal: 0, deuterium: 0 } });
    expect(honorTradeResources({ alloy: 1, crystal: 0, deuterium: 0 }, fee))
      .toEqual({ net: { alloy: 0, crystal: 0, deuterium: 0 }, commission: { alloy: 1, crystal: 0, deuterium: 0 } });
  });

  it('never removes a baseline resource when a positive convoy bonus meets a full hold', () => {
    const base = { alloy: 4, crystal: 1, deuterium: 0 };
    expect(honorConvoyResources(base, 5, honorBenefits(75_000_000, thresholds))).toEqual(base);
    expect(honorConvoyResources({ alloy: Number.MAX_SAFE_INTEGER, crystal: 0, deuterium: 0 }, Number.MAX_SAFE_INTEGER,
      honorBenefits(75_000_000, thresholds))).toEqual({ alloy: Number.MAX_SAFE_INTEGER, crystal: 0, deuterium: 0 });
  });

  it('keeps each convoy resource monotone as Honor improves, including small mixed piles at the cargo limit', () => {
    const tiers = [-100_000_000, -25_000_000, 0, 25_000_000, 75_000_000].map(score => honorBenefits(score, thresholds));
    for (let alloy = 0; alloy <= 4; alloy++) for (let crystal = 0; crystal <= 4; crystal++) for (let deuterium = 0; deuterium <= 4; deuterium++) {
      for (let cargo = 0; cargo <= 15; cargo++) {
        let previous = { alloy: 0, crystal: 0, deuterium: 0 };
        for (const tier of tiers) {
          const reward = honorConvoyResources({ alloy, crystal, deuterium }, cargo, tier);
          for (const good of ['alloy', 'crystal', 'deuterium'] as const) expect(reward[good], JSON.stringify({ alloy, crystal, deuterium, cargo, tier })).toBeGreaterThanOrEqual(previous[good]);
          expect(reward.alloy + reward.crystal + reward.deuterium).toBeLessThanOrEqual(cargo);
          previous = reward;
        }
      }
    }
  });

  it('splitting a small trade or repair cannot avoid its fee or create extra discount', () => {
    const negative = honorBenefits(-25_000_000, thresholds), positive = honorBenefits(75_000_000, thresholds);
    for (let n = 2; n <= 50; n++) for (let left = 1; left < n; left++) {
      const resource = (alloy: number) => ({ alloy, crystal: 0, deuterium: 0 });
      const split = honorTradeResources(resource(left), negative).net.alloy + honorTradeResources(resource(n - left), negative).net.alloy;
      expect(split).toBeLessThanOrEqual(honorTradeResources(resource(n), negative).net.alloy);
      const splitRepair = honorRepairResources(resource(left), positive).alloy + honorRepairResources(resource(n - left), positive).alloy;
      expect(splitRepair).toBeGreaterThanOrEqual(honorRepairResources(resource(n), positive).alloy);
    }
  });

  it('refuses invalid resources and unsafe resulting resource amounts', () => {
    const benefit = honorBenefits(-100_000_000, thresholds);
    expect(() => honorRepairResources({ ...pile, alloy: -1 }, benefit)).toThrow();
    expect(() => honorTradeResources({ ...pile, crystal: .5 }, benefit)).toThrow();
    expect(() => honorConvoyResources(pile, -1, benefit)).toThrow();
    expect(() => honorRepairResources({ alloy: Number.MAX_SAFE_INTEGER, crystal: 0, deuterium: 0 }, benefit)).toThrow();
  });
});
