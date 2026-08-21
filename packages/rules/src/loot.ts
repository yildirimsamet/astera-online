import { ABUSE, COMBAT } from './constants.js';
import type { Grade, Resources } from './types.js';

export const gradeMultiplier = (grade: Grade): number =>
  grade === 'DECISIVE'
    ? COMBAT.lootDecisive
    : grade === 'PARTIAL'
      ? COMBAT.lootPartial
      : 0;

export interface Loot extends Resources {
  /** The part taken out of STORAGE — after the vault floor. */
  fromStock: Resources;
  /** The part taken out of the uncollected works. D16. */
  fromBuffer: Resources;
}

export const NO_LOOT: Loot = {
  alloy: 0,
  crystal: 0,
  fromStock: { alloy: 0, crystal: 0 },
  fromBuffer: { alloy: 0, crystal: 0 },
};

/**
 * Cargo is filled with alloy and crystal in proportion to what is available.
 *
 * The 50% rule IS the repeat-raid decay system: successive raids take 50%, then
 * 25%, then 12.5% of the original pile. Diminishing returns arrive for free, with
 * no cooldown table and no extra state.
 *
 * TWO PILES, TWO RATES (D16). Ore in storage is exposed in full, less the vault
 * floor. Ore still sitting uncollected in the works is exposed at
 * `COMBAT.lootBufferShare` and the vault does not cover it at all — the vault
 * protects a store, and this has not reached the store yet. Leaving production
 * uncollected is therefore partial cover and never safety, which is exactly the
 * decision the collector is there to create.
 *
 * The split is reported, not just the total, because the caller has to deduct from
 * two different columns and a single number cannot tell it how.
 */
export function computeLoot(
  stock: Resources,
  buffer: Resources,
  /**
   * A PAIR, NOT A NUMBER. D61. The two floors differ because the two economies
   * do — see `vaultProtects`. Taking a number here is what let one figure sized
   * for alloy be charged against crystal for four phases.
   */
  vaultFloor: Resources,
  grade: Grade,
  cargo: number,
): Loot {
  const mult = gradeMultiplier(grade);
  if (mult === 0 || cargo <= 0) return NO_LOOT;

  const share = COMBAT.lootBufferShare;
  const stockA = Math.max(0, stock.alloy - vaultFloor.alloy) * mult;
  const stockC = Math.max(0, stock.crystal - vaultFloor.crystal) * mult;
  const bufferA = Math.max(0, buffer.alloy) * mult * share;
  const bufferC = Math.max(0, buffer.crystal) * mult * share;

  const total = stockA + stockC + bufferA + bufferC;
  if (total <= 0) return NO_LOOT;

  // One scale factor across all four piles, so a cargo shortfall costs each of
  // them the same proportion rather than emptying whichever is read first.
  const factor = total <= cargo ? 1 : cargo / total;
  const fromStock = {
    alloy: Math.floor(stockA * factor),
    crystal: Math.floor(stockC * factor),
  };
  const fromBuffer = {
    alloy: Math.floor(bufferA * factor),
    crystal: Math.floor(bufferC * factor),
  };

  return {
    alloy: fromStock.alloy + fromBuffer.alloy,
    crystal: fromStock.crystal + fromBuffer.crystal,
    fromStock,
    fromBuffer,
  };
}

export type AttackRefusal = 'TIER_BAND' | 'BASH_LIMIT' | 'SELF';

export interface AttackCheck {
  ok: boolean;
  reason?: AttackRefusal;
}

export interface AttackParty {
  playerId: string;
  /** Command Core level. The public tier is derived from it — see `coreTier`. */
  coreLevel: number;
}

/**
 * A PLANET'S DEVELOPMENT TIER — the one size figure the whole galaxy can read.
 *
 * Core level is exposed as a coarse tier and never as the exact number: that a
 * world is big is public, and knowing precisely how big is what a probe is for.
 * The disc draws its silhouette off this (D34), every dossier states it, and
 * since D49 it is also what decides who may fight whom.
 *
 * It lives HERE, in the rules, rather than in the route that publishes it. It was
 * a private helper in `routes/galaxy.ts`, which was fine while the tier was only
 * a label — it stopped being fine the moment a launch could be refused by it,
 * because the server, the simulator and the client must all agree to the level on
 * what tier a planet is in.
 */
export const coreTier = (coreLevel: number): number => Math.max(1, Math.ceil(coreLevel / 3));

/**
 * Whether two development TIERS are close enough to fight. D49.
 *
 * Takes tiers rather than levels because that is all the client ever has: a
 * planet publishes `coreTier` and never its exact Core level (see `coreTier`),
 * so the surface that has to say "you may not attack this" cannot reach for
 * `withinTierBand` below.
 */
export const tiersWithinBand = (a: number, b: number): boolean =>
  Math.abs(a - b) <= ABUSE.tierBand;

/** The same rule, from two Core levels. What the server has, and uses. */
export const withinTierBand = (attackerCore: number, defenderCore: number): boolean =>
  tiersWithinBand(coreTier(attackerCore), coreTier(defenderCore));

/** The tiers a planet at this Core level may attack, inclusive. For the interface. */
export const reachableTiers = (coreLevel: number): { low: number; high: number } => {
  const tier = coreTier(coreLevel);
  return { low: Math.max(1, tier - ABUSE.tierBand), high: tier + ABUSE.tierBand };
};

/**
 * Three rules, no anti-cheat system. Core gameplay outranks abuse-hardening in
 * MVP, and on a 200-player shard social visibility catches more than code would.
 *
 * THERE IS NO NEWCOMER GRACE. A four-hour shield on every fresh account was the
 * fourth rule until the owner removed it: a world where a new arrival is
 * untouchable is a world where the first hours are safe, and this game's first
 * hours are supposed to be the ones that teach you that they are not. The tier
 * band still stops a whale farming a beginner, and the bash limit still stops
 * anyone being hit repeatedly, so the two protections that scale with the
 * SITUATION remain — what is gone is the one that was granted for merely being
 * new.
 *
 * THE BAND IS MEASURED IN TIERS, NOT IN WEALTH. D49, owner's decision. It was a
 * Wealth ratio — no attacking anyone holding under 40% of what you hold — and the
 * problem with that was never the number, it was that nobody could see it. Wealth
 * is private; development tier is on every planet in the galaxy for free. A rule
 * the player can check BEFORE committing a fleet is a rule they can play around;
 * one they discover when a launch is refused is an error message.
 *
 * Recorded as D14 in `decisions.md`, rewritten by D49. The casual-farming risk in
 * `balance.md` is now carried by the tier band, the bash limit and the vault floor.
 */
export function canAttack(
  attacker: AttackParty,
  defender: AttackParty,
  recentHits: number,
): AttackCheck {
  if (attacker.playerId === defender.playerId) return { ok: false, reason: 'SELF' };

  if (!withinTierBand(attacker.coreLevel, defender.coreLevel)) {
    return { ok: false, reason: 'TIER_BAND' };
  }

  if (recentHits >= ABUSE.bashLimit) return { ok: false, reason: 'BASH_LIMIT' };

  return { ok: true };
}
