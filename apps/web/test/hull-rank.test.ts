import { describe, expect, it } from 'vitest';
import { FLEET_V2_HULLS, HULLS, MOBILE_HULLS } from '@astera/rules';
import { rankLayout, rankRow, STAR } from '../src/galaxy/rank.js';

/**
 * WHAT A CRAFT IS, AND HOW GOOD IT IS, UNDER THE CRAFT. Owner instruction.
 *
 * D124: a rule the player cannot SEE is not a usable rule, and the two facts that
 * decide whether a formation on the disc is a threat — what tier its hulls are and
 * what they are FOR — were legible nowhere in the galaxy. A silhouette at map
 * scale is a shape; the badge is the reading.
 *
 * A ROW, READ LEFT TO RIGHT: the role glyph, then one star per tier. Both halves
 * come from the hull table, never from art, so a rebalanced catalogue moves the
 * badge with it.
 */
describe('the rank a hull wears in the galaxy', () => {
  it('reads the tier as stars and the family as its glyph', () => {
    expect(rankRow('DART')).toEqual(['sword', STAR]);
    expect(rankRow('STRONGHOLD')).toEqual(['shield', STAR, STAR]);
    expect(rankRow('ATLAS')).toEqual(['crate', STAR, STAR, STAR]);
    expect(rankRow('CATACLYSM')).toEqual(['sword', STAR, STAR, STAR, STAR]);
  });

  /**
   * The Nullifier is the only SPECIALIST, and it is a shield-breaker that flies at
   * somebody. Sword: the question the glyph answers is "is this coming for me",
   * and a fourth symbol for a cast of one would be a legend to memorise.
   */
  it('draws the shield-breaker as an offensive craft', () => {
    expect(rankRow('NULLIFIER')).toEqual(['sword', STAR, STAR, STAR]);
  });

  /**
   * The probe, the drill and the two ground guns carry no tier — they are outside
   * Fleet V2 progression entirely (D148) — so there is no rank to state and the
   * owner's exclusion needs no second list to fall out of step with.
   */
  it('gives no badge to anything outside the tier ladder', () => {
    expect(rankRow('PROSPECTOR')).toEqual([]);
    expect(rankRow('BASTION')).toEqual([]);
    expect(rankRow('THORN')).toEqual([]);
  });

  it('states a row for every hull that flies with a tier, and only those', () => {
    for (const hull of MOBILE_HULLS) {
      const row = rankRow(hull);
      const tier = HULLS[hull].tier;
      if (tier === null) {
        expect(row).toEqual([]);
        continue;
      }
      expect(row).toHaveLength(tier + 1);
      expect(row.filter((glyph) => glyph === STAR)).toHaveLength(tier);
      expect(row[0]).not.toBe(STAR);
    }
  });

  it('covers the whole Fleet V2 catalogue with no hull left unbadged', () => {
    for (const hull of FLEET_V2_HULLS) expect(rankRow(hull).length).toBeGreaterThan(0);
  });
});

describe('how a badge is laid out under a craft', () => {
  it('centres the row on the craft and keeps the glyph on the left', () => {
    const marks = rankLayout(rankRow('CATACLYSM'), 2);
    expect(marks.map((m) => m.glyph)).toEqual(['sword', STAR, STAR, STAR, STAR]);
    expect(marks.map((m) => m.x)).toEqual([-4, -2, 0, 2, 4]);
    expect(marks[0]!.x).toBeLessThan(marks[1]!.x);
  });

  it('hangs a short row and a long one under the same point', () => {
    const centre = (hull: 'DART' | 'CATACLYSM') => {
      const marks = rankLayout(rankRow(hull), 2);
      return (marks[0]!.x + marks[marks.length - 1]!.x) / 2;
    };
    expect(centre('DART')).toBe(0);
    expect(centre('CATACLYSM')).toBe(0);
  });

  it('draws nothing at all for a hull with no rank', () => {
    expect(rankLayout(rankRow('PROSPECTOR'), 2)).toEqual([]);
  });
});
