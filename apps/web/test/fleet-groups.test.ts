import { HULLS, MOBILE_HULLS, type MobileHullId } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { FLEET_FAMILY_ORDER, familyGroups } from '../src/lib/roster.js';

/**
 * ONE GROUPING, READ BY EVERY SURFACE THAT LISTS SHIPS. Owner instruction.
 *
 * The catalogue on the fleet tab and the picker a fleet is committed on are the
 * same question asked twice — which of these hulls do I want — and they answered
 * it in two shapes: bands by family on one, a flat tier list on the other. A
 * player who learnt "Offensive, Defensive, Special, Cargo" from the shipyard had
 * to re-learn the roster at the one moment the choice is irreversible.
 *
 * The order is authored HERE and nowhere else, so the two surfaces cannot drift.
 */
describe('the roster families every ship list is grouped by', () => {
  it('runs Offensive, Defensive, Special, Cargo', () => {
    expect(FLEET_FAMILY_ORDER).toEqual(['OFFENSIVE', 'DEFENSIVE', 'SPECIALIST', 'CARGO']);
  });

  it('places every mobile hull in exactly one family', () => {
    const placed = familyGroups(MOBILE_HULLS).flatMap((group) => group.hulls);
    expect([...placed].sort()).toEqual([...MOBILE_HULLS].sort());
  });

  it('keeps rows tier-ascending inside a family, so a tactic reads cheap to dear', () => {
    for (const { hulls } of familyGroups(MOBILE_HULLS)) {
      const tiers = hulls.map((id) => HULLS[id].tier ?? 0);
      expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    }
  });

  /** A picker offers what is standing on the world; an absent family has no band. */
  it('drops a family nothing in the selection belongs to', () => {
    const groups = familyGroups(['DART', 'COURIER'] as MobileHullId[]);
    expect(groups.map((group) => group.family)).toEqual(['OFFENSIVE', 'CARGO']);
    expect(groups.map((group) => group.hulls)).toEqual([['DART'], ['COURIER']]);
  });

  it('is empty for an empty selection rather than four empty bands', () => {
    expect(familyGroups([])).toEqual([]);
  });
});
