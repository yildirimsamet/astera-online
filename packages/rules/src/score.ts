import { instrumentEntries, investedInBuilding, investedInInstrument, investedInSatellite } from './economy.js';
import { fleetValue } from './hulls.js';
import { BUILDING_IDS, type Holdings, type Ledger } from './types.js';
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
  for (const type of BUILDING_IDS) v += investedInBuilding(h.buildings[type], type);
  // Priced with the instrument's own multiplier (D22) — a Telescope is three
  // times a building at the same level and must be valued at what it cost.
  for (const [id, level] of instrumentEntries(h.instruments)) v += investedInInstrument(id, level);
  // A satellite is one purchase at one price (D25).
  for (const id of h.satellites) v += investedInSatellite(id);
  v += fleetValue(h.fleet);
  v += fleetValue(h.ground);
  v += h.alloy + h.crystal + h.deuterium;
  return Math.round(v);
}

/**
 * DOMINION — the season ladder.
 *
 * The sum of your bounded positive battle transfers minus your bounded negative
 * transfers. Exactly zero-sum across the galaxy; only combat generates it; it
 * rewards winning fights EFFICIENTLY, which is precisely what scouting buys.
 *
 * It also scores defence — repelling a raid destroys the attacker's ships, which
 * is Dominion for the defender. A turtle who is never attacked scores exactly
 * zero, so no anti-turtle machinery is needed anywhere else in the design.
 */
export const dominion = (l: Ledger): number => Math.round(l.taken - l.lost);

export const emptyLedger = (): Ledger => ({ taken: 0, lost: 0 });

/**
 * The scale and hard asymptote of one battle's Dominion transfer. D2.
 *
 * This is deliberately a smooth bound rather than a clamp: small exchanges stay
 * close to their economic value while progressively larger fleets buy less
 * ladder leverage. A finite battle can never move more than this amount.
 */
export const DOMINION_TRANSFER_SCALE = 10_000;

/** The attacker's unbounded economic result before it is converted to Dominion. */
export function rawBattleDominion(lootValue: number, result: CombatResult): number {
  return lootValue + result.defenderLossValue - result.attackerLossValue;
}

/** Convert an economic battle result into the signed, bounded ladder transfer. */
export function dominionTransfer(raw: number): number {
  if (raw === 0) return 0;

  // Round the magnitude and restore the sign. Math.round is not odd at negative
  // half-integers; doing this explicitly preserves exact zero-sum bookkeeping.
  const magnitude = Math.round(
    DOMINION_TRANSFER_SCALE * Math.tanh(Math.abs(raw) / DOMINION_TRANSFER_SCALE),
  );
  return raw < 0 ? -magnitude : magnitude;
}

/**
 * Book both sides of a resolved battle and return the attacker's signed transfer.
 * The two ledger deltas sum to exactly zero.
 *
 * Mutates in place — callers hold the rows under a lock already.
 */
export function bookBattle(
  attacker: Ledger,
  defender: Ledger,
  lootValue: number,
  result: CombatResult,
): number {
  const transfer = dominionTransfer(rawBattleDominion(lootValue, result));
  if (transfer > 0) {
    attacker.taken += transfer;
    defender.lost += transfer;
  } else if (transfer < 0) {
    const magnitude = -transfer;
    attacker.lost += magnitude;
    defender.taken += magnitude;
  }
  return transfer;
}

/** Ladder display value. Wealth uses the same divisor so the two read comparably. */
export const points = (raw: number): number => Math.round(raw / 100);
