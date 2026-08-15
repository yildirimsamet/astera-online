import { ABUSE, COMBAT } from './constants.js';
import type { BuildingLevels, Grade, Resources } from './types.js';

export const gradeMultiplier = (grade: Grade): number =>
  grade === 'DECISIVE'
    ? COMBAT.lootDecisive
    : grade === 'PARTIAL'
      ? COMBAT.lootPartial
      : 0;

/**
 * Cargo is filled with alloy and crystal in proportion to what is available.
 *
 * The 50% rule IS the repeat-raid decay system: successive raids take 50%, then
 * 25%, then 12.5% of the original pile. Diminishing returns arrive for free, with
 * no cooldown table and no extra state.
 */
export function computeLoot(
  stock: Resources,
  vaultFloor: number,
  grade: Grade,
  cargo: number,
): Resources {
  const mult = gradeMultiplier(grade);
  if (mult === 0 || cargo <= 0) return { alloy: 0, crystal: 0 };

  const availA = Math.max(0, stock.alloy - vaultFloor) * mult;
  const availC = Math.max(0, stock.crystal - vaultFloor) * mult;
  const total = availA + availC;
  if (total <= 0) return { alloy: 0, crystal: 0 };

  if (total <= cargo) {
    return { alloy: Math.floor(availA), crystal: Math.floor(availC) };
  }
  return {
    alloy: Math.floor(cargo * (availA / total)),
    crystal: Math.floor(cargo * (availC / total)),
  };
}

export type AttackRefusal = 'RANK_FLOOR' | 'NEWCOMER_GRACE' | 'BASH_LIMIT' | 'SELF';

export interface AttackCheck {
  ok: boolean;
  reason?: AttackRefusal;
}

export interface AttackParty {
  playerId: string;
  wealth: number;
  joinedAtMinutes?: number;
  buildings?: BuildingLevels;
}

/**
 * Four rules, no anti-cheat system. Core gameplay outranks abuse-hardening in MVP,
 * and on a 200-player shard social visibility catches more than code would.
 */
export function canAttack(
  attacker: AttackParty,
  defender: AttackParty,
  nowMinutes: number,
  recentHits: number,
): AttackCheck {
  if (attacker.playerId === defender.playerId) return { ok: false, reason: 'SELF' };

  if (defender.wealth < attacker.wealth * ABUSE.rankFloor) {
    return { ok: false, reason: 'RANK_FLOOR' };
  }

  const age = nowMinutes - (defender.joinedAtMinutes ?? 0);
  const core = defender.buildings?.CORE ?? 0;
  if (age < ABUSE.graceMinutes && core < ABUSE.graceUntilCoreLevel) {
    return { ok: false, reason: 'NEWCOMER_GRACE' };
  }

  if (recentHits >= ABUSE.bashLimit) return { ok: false, reason: 'BASH_LIMIT' };

  return { ok: true };
}
