import { instrumentEntries, investedInBuilding, investedInInstrument, investedInSatellite } from './economy.js';
import { fleetValue } from './hulls.js';
import { MULTI_WORLD } from './constants.js';
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
 * The sum of your positive battle transfers minus your negative transfers.
 * Exactly zero-sum across a scored battle and its season cycle; only player combat
 * generates it; it
 * rewards winning fights EFFICIENTLY, which is precisely what scouting buys.
 *
 * It also scores defence — repelling a raid destroys the attacker's ships, which
 * is Dominion for the defender. A turtle who is never attacked scores exactly
 * zero, so no anti-turtle machinery is needed anywhere else in the design.
 */
export const dominion = (l: Ledger): number => safeSum(
  'Dominion ledger',
  nonNegativeSafeInteger(l.taken, 'Dominion taken ledger'),
  -nonNegativeSafeInteger(l.lost, 'Dominion lost ledger'),
);

export const emptyLedger = (): Ledger => ({ taken: 0, lost: 0 });

/**
 * The retired pre-v7 scale and hard asymptote. Kept only to settle an older
 * ruleset without repricing a live cycle or its historical reports. D2.
 */
export const DOMINION_TRANSFER_SCALE = 10_000;

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value: number, label: string): number {
  safeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
  return value;
}

function safeSum(label: string, ...values: number[]): number {
  for (const value of values) safeInteger(value, label);
  const exact = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (exact < BigInt(Number.MIN_SAFE_INTEGER) || exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
  return Number(exact);
}

/** The attacker's unbounded raw-resource result before it is converted to Dominion. */
export function rawBattleDominion(lootValue: number, result: CombatResult): number {
  return safeSum(
    'Battle Dominion exchange',
    nonNegativeSafeInteger(lootValue, 'Battle Dominion loot'),
    nonNegativeSafeInteger(result.defenderLossValue, 'Defender permanent loss'),
    -nonNegativeSafeInteger(result.attackerLossValue, 'Attacker permanent loss'),
  );
}

/** Convert a realised exchange into the rule frozen onto its season. */
export function dominionTransfer(
  raw: number,
  rulesetVersion: number = MULTI_WORLD.rulesetVersion,
): number {
  safeInteger(raw, 'Battle Dominion exchange');
  safeInteger(rulesetVersion, 'Dominion ruleset version');
  if (rulesetVersion <= 0) {
    throw new RangeError('Dominion ruleset version must be a positive safe integer');
  }
  if (raw === 0) return 0;

  if (rulesetVersion >= MULTI_WORLD.dominionLinearRulesetVersion) return raw;

  // Legacy seasons used the smooth 10,000 asymptote. Restore the sign after
  // rounding so the historical branch remains exactly odd and zero-sum.
  const magnitude = Math.round(
    DOMINION_TRANSFER_SCALE * Math.tanh(Math.abs(raw) / DOMINION_TRANSFER_SCALE),
  );
  return raw < 0 ? -magnitude : magnitude;
}

export interface BattleDominionBreakdown {
  rulesetVersion: number;
  lootValue: number;
  attackerLossValue: number;
  defenderPermanentLossValue: number;
  rawExchange: number;
  transfer: number;
}

/** Every persisted input and output needed to audit one score movement. */
export function battleDominion(
  lootValue: number,
  result: CombatResult,
  rulesetVersion: number = MULTI_WORLD.rulesetVersion,
): BattleDominionBreakdown {
  const rawExchange = rawBattleDominion(lootValue, result);
  return {
    rulesetVersion,
    lootValue: nonNegativeSafeInteger(lootValue, 'Battle Dominion loot'),
    attackerLossValue: nonNegativeSafeInteger(
      result.attackerLossValue,
      'Attacker permanent loss',
    ),
    defenderPermanentLossValue: nonNegativeSafeInteger(
      result.defenderLossValue,
      'Defender permanent loss',
    ),
    rawExchange,
    transfer: dominionTransfer(rawExchange, rulesetVersion),
  };
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
  rulesetVersion: number = MULTI_WORLD.rulesetVersion,
): number {
  const transfer = battleDominion(lootValue, result, rulesetVersion).transfer;
  if (transfer > 0) {
    const attackerTaken = safeSum('Attacker Dominion ledger', attacker.taken, transfer);
    const defenderLost = safeSum('Defender Dominion ledger', defender.lost, transfer);
    attacker.taken = attackerTaken;
    defender.lost = defenderLost;
  } else if (transfer < 0) {
    const magnitude = -transfer;
    const attackerLost = safeSum('Attacker Dominion ledger', attacker.lost, magnitude);
    const defenderTaken = safeSum('Defender Dominion ledger', defender.taken, magnitude);
    attacker.lost = attackerLost;
    defender.taken = defenderTaken;
  }
  return transfer;
}

/** Ladder display value. Wealth uses the same divisor so the two read comparably. */
export const points = (raw: number): number => Math.round(raw / 100);
