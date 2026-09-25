import { describe, expect, it } from 'vitest';
import { COMBAT } from '@astera/rules';
import { lootEstimate } from '../src/lib/lootEstimate.js';

/**
 * THE HAUL, AGAINST THE HOLD. Spec E2: "Ganimet tahmini (stok bandı × computeLoot ×
 * vaultProtects, kargonla karşılaştırmalı)".
 *
 * The probe's `stock` band already IS that product — the server runs `computeLoot`
 * with the target's own `vaultProtects` at DECISIVE with an unlimited hold, then
 * fuzzes it (`services/intel.ts`). So the estimate is that band, the partial share
 * of it, and the one fact about the attacker the probe leaves out: the hold.
 */
describe('the loot estimate', () => {
  const report = { stock: { low: 18_000, high: 24_000 }, deuteriumStock: { low: 1_000, high: 2_000 } };

  it('is the probe band at a decisive win, and its partial share', () => {
    const estimate = lootEstimate(report, 30_000)!;
    expect(estimate.decisive).toEqual({ low: 18_000, high: 24_000 });
    const share = COMBAT.lootPartial / COMBAT.lootDecisive;
    expect(estimate.partial).toEqual({ low: Math.floor(18_000 * share), high: Math.floor(24_000 * share) });
    expect(estimate.deuterium).toEqual({ low: 1_000, high: 2_000 });
  });

  it('says so when the hold, not the win, is the wall', () => {
    const short = lootEstimate(report, 5_100)!;
    expect(short.cargo).toBe(5_100);
    expect(short.cargoShort).toBe(true);
    // What would actually come home is capped by the hold.
    expect(short.carried).toEqual({ low: 5_100, high: 5_100 });

    const roomy = lootEstimate(report, 30_000)!;
    expect(roomy.cargoShort).toBe(false);
    expect(roomy.carried).toEqual({ low: 18_000, high: 24_000 });
  });

  it('knows nothing without a probe, and carries nothing without a hold', () => {
    expect(lootEstimate(undefined, 30_000)).toBeNull();
    const empty = lootEstimate(report, 0)!;
    expect(empty.cargoShort).toBe(true);
    expect(empty.carried).toEqual({ low: 0, high: 0 });
  });

  it('keeps an unread deuterium share unread', () => {
    expect(lootEstimate({ ...report, deuteriumStock: null }, 30_000)!.deuterium).toBeNull();
  });

  /**
   * THE MOCK'S ROWS ARE PER RESOURCE, AND THE PROBE READS TWO PILES: the whole haul and
   * the deuterium in it. Alloy and crystal together are the rest — and since both bands
   * are fuzzed, the rest is widest-honest: the low pile less the high deuterium, the high
   * pile less the low. Never below zero; unknown where the deuterium was never read.
   */
  it('reads alloy and crystal together as the pile less its deuterium', () => {
    expect(lootEstimate(report, 30_000)!.metal).toEqual({ low: 16_000, high: 23_000 });
    expect(lootEstimate({ stock: { low: 500, high: 900 }, deuteriumStock: { low: 400, high: 800 } }, 0)!.metal)
      .toEqual({ low: 0, high: 500 });
    expect(lootEstimate({ ...report, deuteriumStock: null }, 30_000)!.metal).toBeNull();
  });
});
