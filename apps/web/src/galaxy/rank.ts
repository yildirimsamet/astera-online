import { HULLS, type HullFamily, type HullId } from '@astera/rules';

/**
 * THE RANK A CRAFT WEARS UNDER IT, IN THE GALAXY. Owner instruction.
 *
 * A formation on the disc is a silhouette at a hundred metres. The pips above it
 * say HOW MANY, and until now nothing said WHAT — so the two facts that actually
 * decide whether an approaching wing is a problem, its tier and what it is for,
 * were readable only by opening a panel and naming the hull. D124: a rule the
 * player cannot see is not a usable rule.
 *
 * ONE ROW, READ LEFT TO RIGHT: the role glyph, then one star per tier — a sword
 * and four stars is a Cataclysm, a crate and one star is a Courier. Stars because
 * a tier is a RANK and every game the owner named uses stars for one; the glyph on
 * the left because "is this coming for me" is the faster question and the eye
 * reaches the left of a row first.
 *
 * BOTH HALVES COME OFF THE HULL TABLE, never off art or a hand-kept list. A
 * rebalanced catalogue moves the badge with it, and the exclusions the owner asked
 * for — the probe and the drill — fall out of `tier: null` rather than out of a
 * second list that can drift from the first.
 */

/** The mark for one tier rung. Its own constant so callers never type a string. */
export const STAR = 'star';

export type RankGlyph = 'sword' | 'shield' | 'crate' | typeof STAR;

/**
 * Which mark stands for a family.
 *
 * SPECIALIST IS A SWORD, and the Nullifier is the whole of that family: a
 * shield-breaker that flies at somebody. The glyph answers "is this coming for
 * me", and a fourth symbol invented for a cast of one would be a legend to
 * memorise rather than a picture to read.
 *
 * PRESERVED — the ground guns and the drill — has no mark, because nothing in it
 * is on the tier ladder and a badge on it would be inventing a rank.
 */
const FAMILY_GLYPH: Record<HullFamily, RankGlyph | null> = {
  OFFENSIVE: 'sword',
  DEFENSIVE: 'shield',
  CARGO: 'crate',
  SPECIALIST: 'sword',
  PRESERVED: null,
};

/**
 * The badge for one hull, or an empty row for anything that wears none.
 *
 * Empty rather than null so a caller can lay it out without a branch, and so
 * "this craft has no rank" is one thing rather than two.
 */
export function rankRow(hull: HullId): readonly RankGlyph[] {
  const spec = HULLS[hull];
  const glyph = FAMILY_GLYPH[spec.family];
  if (spec.tier === null || glyph === null) return [];
  return [glyph, ...Array.from({ length: spec.tier }, () => STAR as RankGlyph)];
}

/** One mark of a badge, and where it sits along the row's own axis. */
export interface RankMark {
  glyph: RankGlyph;
  /** Offset from the badge's centre, in the same units `size` is given in. */
  x: number;
}

/**
 * Lay a badge out as one centred row.
 *
 * CENTRED ON THE CRAFT, not started at it: the row grows in both directions as a
 * hull climbs the ladder, so a Cataclysm's five marks and a Dart's two hang under
 * the same point and a formation of mixed tiers reads as one line of badges rather
 * than as a ragged left edge.
 *
 * The glyph is index 0 and therefore always the leftmost mark — the owner's
 * instruction, and the reason `rankRow` puts it first rather than leaving the
 * order to whoever draws it.
 */
export function rankLayout(row: readonly RankGlyph[], size: number): RankMark[] {
  const width = size * (row.length - 1);
  return row.map((glyph, i) => ({ glyph, x: i * size - width / 2 }));
}
