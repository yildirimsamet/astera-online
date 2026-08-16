import { ABUSE, COMBAT } from './constants.js';
import type { Grade, Resources } from './types.js';

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

export type AttackRefusal = 'RANK_FLOOR' | 'BASH_LIMIT' | 'SELF';

export interface AttackCheck {
  ok: boolean;
  reason?: AttackRefusal;
}

export interface AttackParty {
  playerId: string;
  wealth: number;
}

/**
 * Three rules, no anti-cheat system. Core gameplay outranks abuse-hardening in
 * MVP, and on a 200-player shard social visibility catches more than code would.
 *
 * THERE IS NO NEWCOMER GRACE. A four-hour shield on every fresh account was the
 * fourth rule until the owner removed it: a world where a new arrival is
 * untouchable is a world where the first hours are safe, and this game's first
 * hours are supposed to be the ones that teach you that they are not. The rank
 * floor still stops a whale farming a beginner, and the bash limit still stops
 * anyone being hit repeatedly, so the two protections that scale with the
 * SITUATION remain — what is gone is the one that was granted for merely being
 * new.
 *
 * Recorded as D14 in `decisions.md`. The casual-farming risk in `balance.md` is
 * now carried entirely by the rank floor and the vault floor.
 */
export function canAttack(
  attacker: AttackParty,
  defender: AttackParty,
  recentHits: number,
): AttackCheck {
  if (attacker.playerId === defender.playerId) return { ok: false, reason: 'SELF' };

  if (defender.wealth < attacker.wealth * ABUSE.rankFloor) {
    return { ok: false, reason: 'RANK_FLOOR' };
  }

  if (recentHits >= ABUSE.bashLimit) return { ok: false, reason: 'BASH_LIMIT' };

  return { ok: true };
}
