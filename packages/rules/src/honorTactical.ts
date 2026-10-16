import { honorChallenge, honorInteger, honorNumber, type HonorComparison, type HonorSideResult } from './honor.js';

export interface HonorTacticalInput extends HonorComparison {
  related: boolean;
  eligible: boolean;
  weakRepeat: number;
  retaliationFifths: number;
  /** Active, usable shield removed; exclude stored charge behind CORE_OUTAGE. */
  shieldDestroyed: number;
  /** Armed ground controlled by functioning Core hardware, at frozen catalogue value. */
  groundValue: number;
  groundWasOnline: boolean;
  /** Newly added duration / a full blackout, in integer parts per million. */
  addedBlackoutPpm: number;
  loyaltyLost: number;
}

export interface HonorTacticalResult extends HonorSideResult {
  groundBand: 'NONE' | 'SMALL' | 'MEDIUM' | 'LARGE';
  /** Total real pressure; consumed retaliation is a separate field. Not ship loss or loot. */
  pressureFifths: number;
}

/**
 * Tactical effect valuation used by the explicitly versioned launch adapters.
 * Existing frozen seasons retain their original accounting policy.
 * The defender receives no debit; successful firing is not a lost military hull.
 */
export function honorTacticalSide(q: HonorTacticalInput): HonorTacticalResult {
  const comparison = honorChallenge(q);
  const ground = honorInteger(q.groundValue), duration = honorInteger(q.addedBlackoutPpm);
  const budget = honorInteger(q.retaliationFifths);
  honorInteger(q.weakRepeat);
  if (duration > 1_000_000n || !Number.isFinite(q.shieldDestroyed) || q.shieldDestroyed < 0
    || !Number.isFinite(q.loyaltyLost) || q.loyaltyLost < 0 || q.loyaltyLost > 20.010001) {
    throw new RangeError('Invalid observed tactical effect');
  }
  const zero: HonorTacticalResult = { ...comparison, raw: 0, gain: 0, lossDebit: 0, weakDebit: 0,
    retaliationSpentFifths: 0, bullying: false, groundBand: 'NONE', pressureFifths: 0 };
  if (!q.eligible) return zero;
  const band = ground < 5000n ? 0 : ground < 25000n ? 1 : ground < 100000n ? 2 : 3;
  const groundPoints = BigInt(band) * duration;
  const groundBand = groundPoints === 0n ? 'NONE' : (['NONE', 'SMALL', 'MEDIUM', 'LARGE'] as const)[band];
  // Fixed proposal coefficients: live weapon price or blackout retuning must not
  // silently change a historical tactical score. No exact ground value survives.
  const shield = BigInt(Math.floor(Math.min(500, q.shieldDestroyed) * 4000));
  const loyalty = BigInt(Math.floor(Math.min(20, q.loyaltyLost) * 200000));
  const pressure = (shield + groundPoints + loyalty) / 25n;
  if (comparison.kind === 'WEAK') {
    const used = budget < pressure ? budget : pressure;
    const debit = 50n * (pressure - used) * BigInt(2 + Math.min(q.weakRepeat, 2)) / 2n;
    return { ...zero, groundBand, pressureFifths: honorNumber(pressure), bullying: true,
      raw: honorNumber(-debit), weakDebit: honorNumber(debit), retaliationSpentFifths: honorNumber(used) };
  }
  const fresh = shield + (q.groundWasOnline ? groundPoints : 0n) + loyalty;
  const gain = q.related ? 0n : fresh * BigInt(comparison.tierNumerator) / 4n * BigInt(comparison.gainFactor) / 1_000_000n;
  return { ...zero, groundBand, pressureFifths: honorNumber(pressure), gain: honorNumber(gain), raw: honorNumber(gain) };
}
