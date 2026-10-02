import { clanAidTravelMinutes } from './clan.js';
import { MULTI_WORLD } from './constants.js';
import { hangarCapacity } from './economy.js';
import { fleetEscapeApplies } from './escape.js';
import { missionFuel } from './fuel.js';
import type { Fleet } from './types.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the pure half. Owner decisions, 2026-10-01
 * (`docs/clan-defense-support-plan.md`).
 *
 * A clanmate parks a wave of their own ships at another member's world; the wave
 * stands in that world's defending line until it is recalled, sent back, or its
 * twelve hours run out. Everything here is arithmetic the server, the client and a
 * bot can all reproduce: whether the season has the rule, what a world's posture
 * permits, what a wave burns and how fast it flies, and how much room a world keeps
 * for guests.
 */

export const CLAN_SUPPORT = {
  /** A stationed wave goes home on its own after this long (owner, "max 12 saat"). */
  stationHours: 12,
  /**
   * THE MOST A LINE'S SUPPORT CAN MULTIPLY THE HOST'S DOMINION. Owner, 2026-10-02: one per
   * clan seat — the same ceiling the joint war's head count has, so the two directions of
   * the correction stay symmetric.
   */
  maxDominionFactor: 5,
} as const;

/** Whether a season was dealt the clan defence support. Never inside a running one. */
export const clanDefenseApplies = (rulesetVersion: number): boolean =>
  rulesetVersion >= MULTI_WORLD.clanDefenseRulesetVersion;

/**
 * THE DEFENCE POSTURE OF ONE WORLD — two toggles, never both on.
 *
 *   ESCAPE  — the tactical retreat may lift the ships; no clan support may land.
 *   SUPPORT — clanmates may station waves here; the ships never lift.
 *   HOLD    — neither: the line always fights.
 *
 * One stored value rather than two booleans, so "both on" is unrepresentable rather
 * than merely refused.
 */
export const DEFENCE_POSTURES = ['ESCAPE', 'SUPPORT', 'HOLD'] as const;
export type DefencePosture = typeof DEFENCE_POSTURES[number];

export interface PostureToggles {
  escape: boolean;
  support: boolean;
}

export function postureFromToggles(toggles: PostureToggles): DefencePosture {
  if (toggles.escape && toggles.support) {
    throw new RangeError('the retreat and clan support cannot both be on');
  }
  if (toggles.escape) return 'ESCAPE';
  if (toggles.support) return 'SUPPORT';
  return 'HOLD';
}

export function togglesOf(posture: DefencePosture): PostureToggles {
  return { escape: posture === 'ESCAPE', support: posture === 'SUPPORT' };
}

/**
 * WHETHER THIS WORLD'S LINE MAY LIFT OFF. A season dealt before clan defence keeps
 * the automatic retreat it was dealt — the stored posture is never read there. From
 * ruleset 15 only an ESCAPE world runs.
 */
export function escapeAllowed(rulesetVersion: number, posture: DefencePosture): boolean {
  if (!fleetEscapeApplies(rulesetVersion)) return false;
  if (!clanDefenseApplies(rulesetVersion)) return true;
  return posture === 'ESCAPE';
}

/** Out and back, paid once at dispatch — the round trip clan aid already charges. */
export const supportFuel = (fleet: Fleet, distance: number): number =>
  missionFuel(fleet, distance, 2);

/** The clan logistics lane: the same ×1.10 a clan aid convoy flies at. */
export const supportTravelMinutes = (ordinaryTravelMinutes: number): number =>
  clanAidTravelMinutes(ordinaryTravelMinutes);

export interface SupportBayRoom {
  total: number;
  used: number;
  free: number;
}

/**
 * THE GUEST BAY: exactly the host world's own Hangar room, in the same bulk. Owner
 * decision K1 — no new building; raising the Hangar raises both.
 */
export function supportBayRoom(hangarLevel: number, used: number): SupportBayRoom {
  const total = hangarCapacity(hangarLevel);
  return { total, used, free: Math.max(0, total - used) };
}

/** An exact rational ≥ 1: the factor a supported line multiplies the host's Dominion by. */
export interface SupportFactor {
  num: number;
  den: number;
}

const assertPower = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
};

/**
 * HOW MUCH THE SUPPORT WEIGHS AGAINST THE HOST. Owner decision, 2026-10-02.
 *
 * `D = line power ÷ host power` — `1 + support ÷ host` — at most ×5. A little support
 * moves the host's Dominion a little; support as strong as the host doubles it; a host
 * with nothing of its own standing is at the ceiling. A wave that brought nothing that
 * fires (transports) leaves D at 1, so a token wave cannot change the stakes.
 *
 * Power is `combatValue` at the start of the fight: the host's ships AND the ground guns
 * that fire (owner), every supporter's ships. Kept as a fraction so nothing rounds before
 * the one truncation `adjustDefendedDominion` makes.
 */
export function supportFactor(input: { hostPower: number; supportPower: number }): SupportFactor {
  assertPower(input.hostPower, 'host power');
  assertPower(input.supportPower, 'support power');
  const max = CLAN_SUPPORT.maxDominionFactor;
  if (input.supportPower === 0) return { num: 1, den: 1 };
  if (input.hostPower === 0) return { num: max, den: 1 };
  const line = input.hostPower + input.supportPower;
  if (!Number.isSafeInteger(line) || line >= max * input.hostPower) return { num: max, den: 1 };
  return { num: line, den: input.hostPower };
}

export const factorValue = (factor: SupportFactor): number => factor.num / factor.den;

/**
 * THE TRANSFER A SUPPORTED LINE MOVES. Owner decision, 2026-10-02.
 *
 * `base` is the attackers' side of the ordinary exchange (positive: they took Dominion and
 * the host lost it). Against a line the support multiplied by D, a host who loses loses ×D
 * and a host who wins gains ÷D; a joint war's attackers keep their head count A on the
 * other side, so the rule is the head-count correction with D read from power:
 *
 *   base > 0  →  base × D ÷ A        base < 0  →  base × A ÷ D
 *
 * Exact integer arithmetic, truncated toward zero once — the same discipline as
 * `adjustJointDominion`, which this equals whenever D is a whole number. The supporters'
 * own Dominion never moves; the host carries the whole defending side.
 */
export function adjustDefendedDominion(base: number, attackers: number, factor: SupportFactor): number {
  if (!Number.isSafeInteger(base)) throw new RangeError('the base transfer must be a safe integer');
  if (!Number.isSafeInteger(attackers) || attackers < 1) {
    throw new RangeError('a battle needs at least one attacking commander');
  }
  if (!Number.isSafeInteger(factor.num) || !Number.isSafeInteger(factor.den) || factor.den < 1 || factor.num < factor.den) {
    throw new RangeError('a support factor is a whole fraction of at least one');
  }
  if (base === 0 || attackers * factor.den === factor.num) return base;
  const exact = base > 0
    ? (BigInt(base) * BigInt(factor.num)) / (BigInt(attackers) * BigInt(factor.den))
    : (BigInt(base) * BigInt(attackers) * BigInt(factor.den)) / BigInt(factor.num);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER) || exact < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('the defended Dominion transfer left the safe integer range');
  }
  return Number(exact);
}

/**
 * WHAT A SUPPORTED LINE MOVES, ALL OF IT. Owner decision (b), 2026-10-02.
 *
 * `base` is the ordinary exchange over the whole line (loot + every defender's permanent
 * loss − the attackers'), and `supportLoss` the part of it that was the supporters' ships.
 * The factor prices the advantage of the HOST'S fight — its loot, its own losses, the
 * attackers' losses the line inflicted — and nothing else: a supporter's lost ship is
 * written at its value, never multiplied by D and never divided by it. The attacker is
 * still paid for everything destroyed; the host, the only defender whose ledger moves,
 * pays for its guests' losses once, not D times.
 *
 *   transfer = adjustDefendedDominion(base − supportLoss, attackers, D) + supportLoss
 */
export function defendedTransfer(
  base: number,
  supportLoss: number,
  attackers: number,
  factor: SupportFactor,
): number {
  if (!Number.isSafeInteger(supportLoss) || supportLoss < 0) {
    throw new RangeError('the supporters’ loss must be a non-negative safe integer');
  }
  const transfer = adjustDefendedDominion(base - supportLoss, attackers, factor) + supportLoss;
  if (!Number.isSafeInteger(transfer)) {
    throw new RangeError('the defended Dominion transfer left the safe integer range');
  }
  return transfer;
}
