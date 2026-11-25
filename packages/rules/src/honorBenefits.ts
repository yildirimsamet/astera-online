import { honorInteger, honorNumber } from './honor.js';
import type { Resources } from './types.js';

/** Thresholds are frozen per enabled program; this module never enables one. */
export interface HonorBenefitThresholds {
  readonly positive: readonly [number, number];
  readonly negative: readonly [number, number] | readonly [number, number, number, number];
}
export const HONOR_BENEFIT_PROGRAM_V1 = 1;
export const HONOR_BENEFIT_PROGRAM_VERSION = 2;
export const HONOR_BENEFIT_THRESHOLDS_V1: HonorBenefitThresholds = {
  positive: [25_000_000, 75_000_000], negative: [25_000_000, 100_000_000],
};
export const HONOR_BENEFIT_THRESHOLDS_V2: HonorBenefitThresholds = {
  positive: [25_000_000, 75_000_000], negative: [25_000_000, 50_000_000, 150_000_000, 200_000_000],
};
export type HonorBenefitTier = -4 | -3 | -2 | -1 | 0 | 1 | 2;
export const HONOR_BENEFIT_RATES = {
  '-4': { tier: -4, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 25, productionPct: -25 },
  '-3': { tier: -3, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 25, productionPct: 0 },
  '-2': { tier: -2, repairPct: 10, convoyPct: -30, tradePct: 14, fuelPct: 0, productionPct: 0 },
  '-1': { tier: -1, repairPct: 5, convoyPct: -15, tradePct: 7, fuelPct: 0, productionPct: 0 },
  '0': { tier: 0, repairPct: 0, convoyPct: 0, tradePct: 0, fuelPct: 0, productionPct: 0 },
  '1': { tier: 1, repairPct: -5, convoyPct: 15, tradePct: 0, fuelPct: 0, productionPct: 0 },
  '2': { tier: 2, repairPct: -10, convoyPct: 30, tradePct: 0, fuelPct: 0, productionPct: 0 },
} as const;
export type HonorBenefits = (typeof HONOR_BENEFIT_RATES)[keyof typeof HONOR_BENEFIT_RATES];

export function honorBenefits(score: number, thresholds: HonorBenefitThresholds | null): HonorBenefits {
  honorInteger(score, true);
  if (thresholds === null) return { ...HONOR_BENEFIT_RATES[0] };
  for (const list of [thresholds.positive, thresholds.negative]) {
    if (honorInteger(list[0]) === 0n) {
      throw new RangeError('Honor thresholds must be positive and ascending');
    }
    for (let i = 1; i < list.length; i++) {
      if (honorInteger(list[i]!) <= BigInt(list[i - 1]!)) {
        throw new RangeError('Honor thresholds must be positive and ascending');
      }
    }
  }
  const neg = thresholds.negative;
  const tier: HonorBenefitTier = score >= thresholds.positive[1] ? 2 : score >= thresholds.positive[0] ? 1
    : neg.length === 4 && score <= -neg[3] ? -4
    : neg.length === 4 && score <= -neg[2] ? -3
    : score <= -neg[1] ? -2 : score <= -neg[0] ? -1 : 0;
  return { ...HONOR_BENEFIT_RATES[tier] };
}

export function honorFuelCost(
  baseFuel: number,
  benefits: { fuelPct: number } | null | undefined,
): number {
  const fuel = honorInteger(baseFuel);
  const pct = benefits?.fuelPct ?? 0;
  if (pct === 0 || fuel === 0n) return honorNumber(fuel);
  return honorNumber((fuel * honorInteger(100 + pct) + 99n) / 100n);
}

export function honorLaunchFuel(
  plainFuel: number,
  benefits: { fuelPct: number } | null | undefined,
  admiralFuelMult = 1,
): number {
  honorInteger(plainFuel);
  if (!(admiralFuelMult > 0 && Number.isFinite(admiralFuelMult))) {
    throw new RangeError('Invalid admiral fuel multiplier');
  }
  const afterAdmiral = admiralFuelMult === 1 ? plainFuel : Math.ceil(plainFuel * admiralFuelMult);
  return honorFuelCost(afterAdmiral, benefits);
}

const goods = ['alloy', 'crystal', 'deuterium'] as const;
function scale(resources: Resources, percent: number, ceil = false): Resources {
  const numerator = honorInteger(percent);
  const component = (amount: number) => honorNumber((honorInteger(amount) * numerator + (ceil ? 99n : 0n)) / 100n);
  return { alloy: component(resources.alloy), crystal: component(resources.crystal), deuterium: component(resources.deuterium) };
}

/** The paid bill is authoritative for cancellation refunds; duration is independent. */
export function honorRepairResources(base: Resources, benefits: Pick<HonorBenefits, 'repairPct'>): Resources {
  return scale(base, 100 + benefits.repairPct, true);
}

function cargoClamp(resources: Resources, cargo: number): Resources {
  const cap = honorInteger(cargo);
  const total = goods.reduce((sum, good) => sum + honorInteger(resources[good]), 0n);
  if (total <= cap) return { ...resources };
  const component = (amount: number) => honorNumber(BigInt(amount) * cap / total);
  return { alloy: component(resources.alloy), crystal: component(resources.crystal), deuterium: component(resources.deuterium) };
}

/** Preserve the baseline, then fit only the bonus into the remaining hold.
 * One exact ratio keeps every resource monotone as Honor improves. Full holds
 * still pay a penalty. Ship chances and tier use separate rules. */
export function honorConvoyResources(base: Resources, cargo: number, benefits: Pick<HonorBenefits, 'convoyPct'>): Resources {
  const baseline = cargoClamp(base, cargo);
  if (benefits.convoyPct <= 0) return scale(baseline, 100 + benefits.convoyPct);
  const total = goods.reduce((sum, good) => sum + BigInt(baseline[good]), 0n);
  if (total === 0n) return baseline;
  const requested = total * honorInteger(benefits.convoyPct);
  const available = (honorInteger(cargo) - total) * 100n;
  const numerator = requested < available ? requested : available;
  const component = (amount: number) => honorNumber(BigInt(amount) + BigInt(amount) * numerator / (100n * total));
  return { alloy: component(baseline.alloy), crystal: component(baseline.crystal), deuterium: component(baseline.deuterium) };
}

/** Floor the net once: dividing a deal never avoids commission. A zero-net
 * proposal must be shown/refused by the caller before paying or dispatching. */
export function honorTradeResources(gross: Resources, benefits: Pick<HonorBenefits, 'tradePct'>): { net: Resources; commission: Resources } {
  const net = scale(gross, 100 - benefits.tradePct);
  return { net, commission: { alloy: gross.alloy - net.alloy, crystal: gross.crystal - net.crystal,
    deuterium: gross.deuterium - net.deuterium } };
}
