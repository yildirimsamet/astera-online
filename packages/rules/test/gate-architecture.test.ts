import { describe, expect, it } from 'vitest';
import { HULLS, MOBILE_HULLS } from '../src/hulls.js';
import { DOCTRINE_OF_FAMILY, DOCTRINE_OPENS_AT, hullDoctrine } from '../src/index.js';
import type { Hull } from '../src/types.js';

/**
 * THREE GATES, EACH ANSWERING A DIFFERENT QUESTION. Plan §15.5b, item 2B.2.
 *
 *   · the SHIPYARD is the physical gate — can this world build something this big at all;
 *   · STARSHIP_ENGINEERING is the permission — is this commander allowed to build starships of
 *     this class;
 *   · a DOCTRINE is the role — one role-relevant ladder, at level 2, opens the hull.
 *
 * Tier 4 did not obey this. A Citadel wanted Engineering 2 AND Armour 4 AND Power 2 — three
 * ladders, one of them at a rung deep enough to be a project of its own — so "unlock the tier-4
 * wall" was really "buy most of the research tree", and the measured package put a quarter of the
 * whole fleet path in research (`navy-package`: 25.3% at T4, doctrine alone 15.7%).
 *
 * DOCTRINE IS NOT MADE OPTIONAL, and the plan is explicit about why: *"evrensel karma rostere
 * iter ve alt-teknolojili T4'ü 'hazır' gibi gösterir."* One requirement stays. Levels 3–5 become
 * what they were always meant to be — specialisation a commander chooses, not a toll they pay.
 */

const mobile = (): Hull[] => MOBILE_HULLS.map((id) => HULLS[id]);
const requirement = (hull: Hull, project: string): number | undefined =>
  hull.requiredResearch.find((r) => r.project === project)?.level;

describe('the Shipyard is the physical tier gate', () => {
  /**
   * THE GATE RISES WITH THE TIER, and from tier 3 up every hull of a tier shares one gate.
   *
   * Tier 1 is deliberately not held to the second half: a commander starts with no Shipyard at
   * all and builds the first one for the Courier, so the opening tier legitimately spans levels
   * 0 and 1. That is the tutorial, not a gap in the architecture.
   */
  it('raises the Shipyard gate with the tier, one gate per tier from three up', () => {
    const byTier = new Map<number, Set<number>>();
    for (const hull of mobile()) {
      if (hull.tier === null) continue;
      byTier.set(hull.tier, (byTier.get(hull.tier) ?? new Set()).add(hull.minShipyard));
    }
    const tiers = [...byTier.keys()].sort((a, b) => a - b);
    for (const tier of tiers) {
      if (tier >= 3) expect([...byTier.get(tier)!], `tier ${String(tier)}`).toHaveLength(1);
    }
    for (let i = 1; i < tiers.length; i++) {
      const lower = Math.min(...byTier.get(tiers[i - 1]!)!);
      const upper = Math.min(...byTier.get(tiers[i]!)!);
      expect(upper, `tier ${String(tiers[i]!)}`).toBeGreaterThan(lower);
    }
  });
});

describe('Starship Engineering is the permission to build a starship', () => {
  it('is asked of every hull above tier 2, and of none below', () => {
    for (const hull of mobile()) {
      const level = requirement(hull, 'STARSHIP_ENGINEERING');
      if ((hull.tier ?? 0) >= 3) expect(level, hull.id).toBeGreaterThanOrEqual(1);
      else expect(level, hull.id).toBeUndefined();
    }
  });

  it('asks for a deeper permission at a deeper tier', () => {
    expect(requirement(HULLS.CATACLYSM, 'STARSHIP_ENGINEERING'))
      .toBeGreaterThan(requirement(HULLS.BALLISTA, 'STARSHIP_ENGINEERING')!);
  });
});

describe('one role-relevant doctrine opens a hull', () => {
  /** The role each family is defined by. A Fortress wants armour; a Raider wants power. */
  it('maps every combat and cargo family to exactly one ladder', () => {
    expect(DOCTRINE_OF_FAMILY.OFFENSIVE).toBe('SHIP_POWER');
    expect(DOCTRINE_OF_FAMILY.DEFENSIVE).toBe('SHIP_ARMOR');
    expect(DOCTRINE_OF_FAMILY.CARGO).toBe('SHIP_PROPULSION');
  });

  it('asks for exactly one doctrine, and asks for it at the opening rung', () => {
    for (const hull of mobile()) {
      if ((hull.tier ?? 0) < 3) continue;
      if (hull.family === 'SPECIALIST' || hull.family === 'PRESERVED') continue;
      const doctrines = hull.requiredResearch.filter((r) => r.project !== 'STARSHIP_ENGINEERING');
      expect(doctrines, hull.id).toHaveLength(1);
      expect(doctrines[0]!.project, hull.id).toBe(DOCTRINE_OF_FAMILY[hull.family]);
      expect(doctrines[0]!.level, hull.id).toBe(DOCTRINE_OPENS_AT);
    }
  });

  /**
   * THE HALF THE PLAN REFUSES TO GIVE UP. Making doctrine optional pushes everyone to one
   * universal mixed roster and lets an under-teched commander field a tier-4 wall as though it
   * were ready. Exactly one requirement is the floor, and it is a floor.
   */
  it('never lets a hull above tier 2 be built with no doctrine at all', () => {
    for (const hull of mobile()) {
      if ((hull.tier ?? 0) < 3 || hull.family === 'SPECIALIST') continue;
      expect(hullDoctrine(hull.id), hull.id).not.toBeNull();
    }
  });

  /**
   * LEVELS 3–5 ARE SPECIALISATION, NOT A TOLL. Nothing in the catalogue may require a doctrine
   * above the opening rung; a commander who wants Armour 4 buys it because it makes their wall
   * harder, not because a hull refuses to exist without it.
   */
  it('requires no doctrine above the opening rung, anywhere', () => {
    for (const hull of mobile()) {
      for (const row of hull.requiredResearch) {
        if (row.project === 'STARSHIP_ENGINEERING') continue;
        expect(row.level, `${hull.id} ${row.project}`).toBeLessThanOrEqual(DOCTRINE_OPENS_AT);
      }
    }
  });

  /** The specialists are the stated exception: their permission IS the weapon they carry. */
  it('leaves the specialists to their own permission', () => {
    expect(hullDoctrine('NULLIFIER')).toBe('GRAVITIC_CHARGES');
    expect(hullDoctrine('GARBAGE_COLLECTOR')).toBeNull();
  });
});

describe('what the redesign must not have moved', () => {
  it('leaves every hull still buildable by somebody', () => {
    for (const hull of mobile()) expect(hull.minShipyard).toBeGreaterThanOrEqual(0);
  });

  /**
   * THE GATE IS RESEARCH AND SHIPYARD; IT NEVER TOUCHED A PRICE.
   *
   * Stated as the LADDER rather than as four remembered figures — a snapshot here would go red
   * the next time a hull is rebalanced and say "the gates broke", which is the failure this
   * repository has already been caught by twice.
   */
  it('leaves the price ladder rising with the tier, inside every family', () => {
    for (const family of ['OFFENSIVE', 'DEFENSIVE', 'CARGO'] as const) {
      const rows = mobile()
        .filter((h) => h.family === family && h.tier !== null)
        .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
      expect(rows.length, family).toBeGreaterThan(2);
      for (let i = 1; i < rows.length; i++) {
        if (rows[i]!.tier === rows[i - 1]!.tier) continue;
        expect(rows[i]!.alloy, `${family} ${rows[i]!.id}`).toBeGreaterThan(rows[i - 1]!.alloy);
      }
    }
  });
});
