import { computeLoot, NO_LOOT, type Loot } from './loot.js';
import type { Grade, Resources } from './types.js';

const empty = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const keys = ['alloy', 'crystal', 'deuterium'] as const;

/** All arrivals together may load at most the original decisive budget. */
export function remainingPirateLoot(hoard: Resources, paid: Resources): Resources {
  for (const ledger of [hoard, paid]) for (const key of keys) {
    if (!Number.isFinite(ledger[key]) || ledger[key] < 0) throw new RangeError('bad pirate resource ledger');
  }
  const budget = computeLoot(hoard, empty(), empty(), 'DECISIVE', Number.MAX_SAFE_INTEGER);
  return {
    alloy: Math.max(0, budget.alloy - paid.alloy),
    crystal: Math.max(0, budget.crystal - paid.crystal),
    deuterium: Math.max(0, budget.deuterium - paid.deuterium),
  };
}

/** Preserve the first grade payment, then limit every later claim BEFORE cargo allocation. */
export function claimPirateLoot(hoard: Resources, paid: Resources, grade: Grade, cargo: number): Loot {
  if (!Number.isFinite(cargo) || cargo < 0) throw new RangeError('bad pirate cargo');
  const remaining = remainingPirateLoot(hoard, paid);
  // computeLoot rounds AFTER filling holds; retain its first-claim proportions.
  if (paid.alloy === 0 && paid.crystal === 0 && paid.deuterium === 0) {
    return computeLoot(hoard, empty(), empty(), grade, cargo);
  }
  const wanted = computeLoot(hoard, empty(), empty(), grade, Number.MAX_SAFE_INTEGER);
  const eligible = {
    alloy: Math.min(remaining.alloy, wanted.alloy),
    crystal: Math.min(remaining.crystal, wanted.crystal),
    deuterium: Math.min(remaining.deuterium, wanted.deuterium),
  };
  const total = eligible.alloy + eligible.crystal + eligible.deuterium;
  if (total <= 0 || cargo <= 0) return NO_LOOT;
  const factor = Math.min(1, cargo / total);
  const fromStock = {
    alloy: Math.floor(eligible.alloy * factor),
    crystal: Math.floor(eligible.crystal * factor),
    deuterium: Math.floor(eligible.deuterium * factor),
  };
  return { ...fromStock, fromStock, fromBuffer: empty() };
}
