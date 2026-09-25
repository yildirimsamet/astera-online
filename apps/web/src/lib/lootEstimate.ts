import { COMBAT } from '@astera/rules';

interface Band { low: number; high: number }

export interface LootEstimate {
  /** What a decisive win could lift with an unlimited hold: the probe's band itself. */
  decisive: Band;
  /** The same pile at a partial win (`lootPartial / lootDecisive` of it). */
  partial: Band;
  /** The deuterium inside the decisive band, where the probe read it. */
  deuterium: Band | null;
  /**
   * Alloy and crystal together: the pile less its deuterium. Both bands are fuzzed, so the
   * rest is widest-honest (low pile less high deuterium, high pile less low). Null where
   * the deuterium was never read, because then the pile cannot be split.
   */
  metal: Band | null;
  /** What the wing at home can carry. */
  cargo: number;
  /** What a decisive win would actually bring home: the band, capped by the hold. */
  carried: Band;
  /** The hold, not the win, is the wall: even the low end of the pile will not fit. */
  cargoShort: boolean;
}

/**
 * THE HAUL, AGAINST THE HOLD. Spec E2.
 *
 * The probe's `stock` band already IS "stock × computeLoot × vaultProtects": the server
 * runs `computeLoot` against the target's own vault floor at DECISIVE with an unlimited
 * hold and fuzzes the result (`services/intel.ts`), because the hold is a fact about the
 * attacker and a probe that folded it in would report a different world to two
 * commanders. So nothing about the target is guessed here; the one thing added is the
 * hold, which is what turns a pile into an expectation.
 *
 * Null without a probe: nobody has looked, and an estimate of nothing reads as "empty".
 */
export function lootEstimate(
  report: { stock: Band; deuteriumStock: Band | null } | undefined,
  cargo: number,
): LootEstimate | null {
  if (!report) return null;
  const share = COMBAT.lootPartial / COMBAT.lootDecisive;
  const hold = Math.max(0, cargo);
  return {
    decisive: { low: report.stock.low, high: report.stock.high },
    partial: { low: Math.floor(report.stock.low * share), high: Math.floor(report.stock.high * share) },
    deuterium: report.deuteriumStock ? { low: report.deuteriumStock.low, high: report.deuteriumStock.high } : null,
    metal: report.deuteriumStock
      ? {
        low: Math.max(0, report.stock.low - report.deuteriumStock.high),
        high: Math.max(0, report.stock.high - report.deuteriumStock.low),
      }
      : null,
    cargo: hold,
    carried: { low: Math.min(hold, report.stock.low), high: Math.min(hold, report.stock.high) },
    cargoShort: hold < report.stock.low,
  };
}
