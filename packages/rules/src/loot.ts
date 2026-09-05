import { ABUSE, COMBAT } from './constants.js';
import type { Grade, Resources } from './types.js';

export const gradeMultiplier = (grade: Grade): number =>
  grade === 'DECISIVE'
    ? COMBAT.lootDecisive
    : grade === 'PARTIAL'
      ? COMBAT.lootPartial
      : 0;

/** Compatibility boundary for JSON rows written before D92. */
export const deuteriumOf = (resources: Partial<Resources>): number => {
  const value = resources.deuterium;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export interface Loot extends Resources {
  /** The part taken out of STORAGE — after the vault floor. */
  fromStock: Resources;
  /** The part taken out of the uncollected works. D16. */
  fromBuffer: Resources;
}

export const NO_LOOT: Loot = {
  alloy: 0,
  crystal: 0,
  deuterium: 0,
  fromStock: { alloy: 0, crystal: 0, deuterium: 0 },
  fromBuffer: { alloy: 0, crystal: 0, deuterium: 0 },
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
  const stockD = Math.max(0, stock.deuterium) * mult;
  const bufferA = Math.max(0, buffer.alloy) * mult * share;
  const bufferC = Math.max(0, buffer.crystal) * mult * share;
  const bufferD = Math.max(0, buffer.deuterium) * mult * share;

  const total = stockA + stockC + stockD + bufferA + bufferC + bufferD;
  if (total <= 0) return NO_LOOT;

  // One scale factor across all four piles, so a cargo shortfall costs each of
  // them the same proportion rather than emptying whichever is read first.
  const factor = total <= cargo ? 1 : cargo / total;
  const fromStock = {
    alloy: Math.floor(stockA * factor),
    crystal: Math.floor(stockC * factor),
    deuterium: Math.floor(stockD * factor),
  };
  const fromBuffer = {
    alloy: Math.floor(bufferA * factor),
    crystal: Math.floor(bufferC * factor),
    deuterium: Math.floor(bufferD * factor),
  };

  return {
    alloy: fromStock.alloy + fromBuffer.alloy,
    crystal: fromStock.crystal + fromBuffer.crystal,
    deuterium: fromStock.deuterium + fromBuffer.deuterium,
    fromStock,
    fromBuffer,
  };
}

/**
 * WHAT A RAID COULD ACTUALLY TAKE FROM THIS WORLD, before anyone's hold.
 *
 * Owner report: *"gezegende 50k kaynak gözüküyor ama dalıyom 300 alloy alıyorum.
 * Böyle saçmalık olmaz."* A probe reported `alloy + crystal` — the whole pile —
 * and THREE rules stand between that figure and what a fleet flies home with:
 * the vault floor is untouchable, the grade takes a share rather than the
 * remainder, and uncollected ore is exposed at half again (D16). Reported total
 * and delivered haul were never the same quantity, and a number that cannot be
 * compared to the outcome it predicts is the Clarity failure `interface.md` opens
 * with.
 *
 * CARGO IS DELIBERATELY NOT A PARAMETER. A hold is a fact about the ATTACKER and
 * their research; it cannot belong to a reading of somebody else's world, and a
 * probe that folded it in would report a different world to two commanders. The
 * hold is the launch sheet's half of the arithmetic and is already drawn there.
 *
 * Defined as `computeLoot` with the hold taken out of the question rather than as
 * a second copy of its arithmetic — the two must never be able to disagree, since
 * the whole point is that this figure predicts that one.
 */
export function raidableStock(
  stock: Resources,
  buffer: Resources,
  vaultFloor: Resources,
  grade: Grade,
): number {
  const loot = computeLoot(stock, buffer, vaultFloor, grade, Number.MAX_SAFE_INTEGER);
  return loot.alloy + loot.crystal + loot.deuterium;
}

/**
 * THE BAND REFUSES IN TWO DIRECTIONS AND SAYS WHICH. D168.
 *
 * `TIER_BAND` is a target too far ABOVE the attacker, `TIER_BAND_WEAK` one too far
 * below. They are separate codes rather than one with a parameter because the
 * player-facing sentence is the whole point of the distinction: telling somebody
 * who aimed at a beginner that the beginner outweighs them is a lie, and sends
 * them to fix the wrong thing.
 */
export type AttackRefusal = 'BASH_LIMIT' | 'SELF' | 'TIER_BAND' | 'TIER_BAND_WEAK';

export interface AttackCheck {
  ok: boolean;
  reason?: AttackRefusal;
}

export interface AttackParty {
  playerId: string;
  /**
   * THE TALLEST COMMAND CORE THIS COMMANDER HOLDS, ACROSS EVERY WORLD. D168.
   *
   * Not the launching world's Core and not the target world's — the peak of the
   * whole holding, because the band is a statement about a PERSON's development
   * and a commander with a capital at tier 5 does not become a fair fight for a
   * beginner by attacking out of, or being attacked at, a one-week-old colony.
   *
   * The name is deliberate. It was `coreLevel`, and a caller that hands this the
   * planet in front of it instead of the commander behind it produces a rule that
   * is silently wrong rather than a type error.
   */
  peakCoreLevel: number;
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
 * THE BAND, AND THE ONLY STATEMENT OF IT. D168.
 *
 * Two commanders may fight when their development tiers are at most
 * `ABUSE.tierBand` apart — inclusive of their own tier, so tier 3 reaches 2, 3 and
 * 4. Both arguments are PEAK Core levels (`AttackParty.peakCoreLevel`), never a
 * single world's.
 *
 * It is exported rather than inlined into `canAttack` because the gate is not the
 * only caller that needs the answer: the server's own commanders filter their
 * target list with it (`raidCandidates`), and a client that offers a raid the
 * server would refuse is D124's "a rule the player cannot see" all over again. Two
 * copies of this arithmetic is how the disc and the gate start disagreeing.
 */
export const withinTierBand = (peakCoreA: number, peakCoreB: number): boolean =>
  Math.abs(coreTier(peakCoreA) - coreTier(peakCoreB)) <= ABUSE.tierBand;

/**
 * THE DEVELOPMENT BAND CAME BACK, NARROWER AND ON THE COMMANDER. D168.
 *
 * Owner instruction: *"Sadece en fazla 1 level üstüne veya altına savaşabilirsin.
 * Gezegen'den çıkan filoya bakılmayacak. User bazında bakılacak."* So the ±2 band
 * D127 retired returns at ±1, and what it measures moved from the two WORLDS in
 * the launch to the two COMMANDERS: each side's tallest Core, wherever it stands.
 *
 * WHY IT MOVED OFF THE PLANET. A planet-measured band is bought off with a colony:
 * settle a fresh world, leave its Core at 1, and a finished commander has a legal
 * launch pad aimed at every beginner in reach — while the beginner, reading a tier
 * 1 world, sees a fair fight. The commander is the thing being matched, so the
 * commander is the thing measured.
 *
 * WHAT D127 SAID AGAINST THIS, AND WHAT IS DIFFERENT. D127 removed the band
 * because development had become private, and a rule you cannot check before
 * committing a fleet is "an error message, not a rule". That objection is
 * unchanged and is now a COST this rule pays: see the note in `mission.ts` about
 * refusing before anything is spent, and D168 in `decisions.md` for the surface
 * work the band still needs. What it buys back is the protection D127 handed
 * entirely to fog and `bashLimit` — the fog stops a raider FINDING a beginner, it
 * does nothing once one is found.
 *
 * THE REASONS ARE ORDERED, and the permanent ones come first. `SELF` is about
 * who you are, the two `TIER_BAND` codes are about who they are, and
 * `BASH_LIMIT` is about
 * a twelve-hour window: telling a player to wait out a window that will not make
 * the fight legal sends them away and back again for the same refusal.
 *
 * Recorded as D14, rewritten by D49, removed by D127, restored by D168. The
 * casual-farming risk in `balance.md` is carried by this band, the bash limit and
 * the vault floor.
 */
export function canAttack(
  attacker: AttackParty,
  defender: AttackParty,
  recentHits: number,
): AttackCheck {
  if (attacker.playerId === defender.playerId) return { ok: false, reason: 'SELF' };

  if (!withinTierBand(attacker.peakCoreLevel, defender.peakCoreLevel)) {
    const theirs = coreTier(defender.peakCoreLevel);
    const mine = coreTier(attacker.peakCoreLevel);
    return { ok: false, reason: theirs > mine ? 'TIER_BAND' : 'TIER_BAND_WEAK' };
  }

  if (recentHits >= ABUSE.bashLimit) return { ok: false, reason: 'BASH_LIMIT' };

  return { ok: true };
}

/**
 * THE HISTORY OF THIS RULE, because it has been reversed twice and both sides of
 * the argument are still live. Anyone about to move it again needs all four.
 *
 * D14 — three rules and no anti-cheat system: core gameplay outranks
 * abuse-hardening in MVP, and on a 200-player shard social visibility catches more
 * than code would. THERE IS NO NEWCOMER GRACE; a four-hour shield on every fresh
 * account was the fourth rule until the owner removed it, because a world where a
 * new arrival is untouchable is a world where the first hours are safe, and this
 * game's first hours are supposed to teach you that they are not. What protects a
 * beginner has to scale with the SITUATION, never with how new they are.
 *
 * D49 — the band is measured in TIERS, not in wealth. It had been a wealth ratio
 * (no attacking anyone holding under 40% of what you hold) and the problem was
 * never the number, it was that nobody could see it: wealth is private, and
 * development tier was on every planet in the galaxy for free. A rule the player
 * can check BEFORE committing a fleet is one they can play around; one they
 * discover when a launch is refused is an error message.
 *
 * D127 — removed, because development stopped being public. The band could then
 * only become exactly the refusal D49 replaced a wealth ratio to avoid. It was not
 * replaced: loot is a share of raidable stock and Dominion a compression of
 * exchanged value, so a large commander raiding a tiny world gains approximately
 * nothing — and could no longer FIND one, since the fact that would let them pick
 * it was now hidden. The stated cost was that a deliberate griefer could cross the
 * whole development range unopposed, with only `bashLimit` in the way.
 *
 * D168 — restored at ±1 and on the commander, owner instruction. The griefer D127
 * priced in is the reason. D49's objection is now the open cost rather than an
 * argument against the rule: development is still private, so the check the player
 * cannot make before committing is one the surface has to hand them — see D168 in
 * `decisions.md`. The casual-farming risk in `balance.md` is carried by this band,
 * the bash limit and the vault floor.
 */
