import { investedInBuilding, satelliteEntries } from './economy.js';
import { fleetValue } from './hulls.js';
import type { Holdings, Ledger } from './types.js';
import type { CombatResult } from './combat.js';

/**
 * WEALTH — everything you own, at what it cost.
 *
 * Displayed, never ranked. It was the working ladder through Phase A and the
 * simulator killed it: pure builders finished a season with 2.1x the net worth of
 * raiders and no loot percentage changed it, because wealth ladders reward
 * accumulation and accumulation is dominated by simply being present.
 */
export function wealth(h: Holdings): number {
  let v = 0;
  for (const level of Object.values(h.buildings)) v += investedInBuilding(level);
  for (const [, level] of satelliteEntries(h.satellites)) v += investedInBuilding(level);
  v += fleetValue(h.fleet);
  v += fleetValue(h.ground);
  v += h.alloy + h.crystal;
  return Math.round(v);
}

/**
 * DOMINION — the season ladder.
 *
 * Everything you have taken from other players, minus everything they have taken
 * from you. Exactly zero-sum across the galaxy; only combat generates it; it
 * rewards winning fights EFFICIENTLY, which is precisely what scouting buys.
 *
 * It also scores defence — repelling a raid destroys the attacker's ships, which
 * is Dominion for the defender. A turtle who is never attacked scores exactly
 * zero, so no anti-turtle machinery is needed anywhere else in the design.
 */
export const dominion = (l: Ledger): number => Math.round(l.taken - l.lost);

export const emptyLedger = (): Ledger => ({ taken: 0, lost: 0 });

/**
 * Book both sides of a resolved battle. The two deltas sum to exactly zero.
 *
 * Mutates in place — callers hold the rows under a lock already.
 */
export function bookBattle(
  attacker: Ledger,
  defender: Ledger,
  lootValue: number,
  result: CombatResult,
): void {
  const gained = lootValue + result.defenderLossValue;
  attacker.taken += gained;
  attacker.lost += result.attackerLossValue;
  defender.taken += result.attackerLossValue;
  defender.lost += gained;
}

/** Ladder display value. Wealth uses the same divisor so the two read comparably. */
export const points = (raw: number): number => Math.round(raw / 100);
