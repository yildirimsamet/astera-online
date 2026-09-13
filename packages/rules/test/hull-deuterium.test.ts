import { describe, expect, it } from 'vitest';
import { HULLS } from '../src/hulls.js';

import type { HullId } from '../src/types.js';

/** D208 prices build isotope at A + 2C + 32D; tier 1 remains buildable without it.
 * Viper joins every other tier-2 hull on this chain (the reversal of D170).
 * Transports retain their recipes; their capacity is calibrated separately.
 */

/** The entry tier, which charges no deuterium at all. */
const FREE_OF_DEUTERIUM: readonly HullId[] = ['WARDEN', 'COURIER'];

/** Authored combat isotope invoices and the unchanged transport invoices. */
const CALIBRATED: Readonly<Partial<Record<HullId, number>>> = {
  VIPER: 2, TALON: 2, STRONGHOLD: 3, SENTINEL: 2, WAYFARER: 12,
  TEMPEST: 6, BALLISTA: 6, LEVIATHAN: 8, PRAETORIAN: 6, ATLAS: 48,
  NULLIFIER: 7, CATACLYSM: 20, CITADEL: 25,
};

/**
 * D196's three tier-4 hulls, which never had a pre-D170 figure to be halved from.
 * They are listed so the sweep below stays exhaustive — a hull that grows a
 * deuterium price without anybody noticing is exactly what it exists to catch.
 */
const ADDED_AT_D196: readonly HullId[] = ['CORSAIR', 'PALADIN', 'ARGOSY'];

describe('the deuterium a hull costs to build', () => {
  for (const id of FREE_OF_DEUTERIUM) {
    it(`${id} asks for none at all`, () => {
      expect(HULLS[id].deuterium).toBe(0);
    });
  }

  for (const [id, before] of Object.entries(CALIBRATED) as [HullId, number][]) {
    it(`${id} charges the monthly tier recipe`, () => {
      expect(HULLS[id].deuterium).toBe(before);
    });
  }

  /** Nothing else grew a deuterium price while the rest were being cut. */
  it('leaves no hull charging deuterium outside the two lists', () => {
    const charging = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].deuterium > 0)
      .sort();
    expect(charging).toEqual([...Object.keys(CALIBRATED), ...ADDED_AT_D196].sort());
  });

  /**
   * THE TIER THE CHAIN STARTS AT, ASSERTED AS A ROW RATHER THAN AS ONE HULL.
   *
   * This is the claim the owner actually made — not "the Viper costs 25" but "a
   * tier-2 hull costs deuterium, and one of them did not". Written against the
   * table so a future hull added at this tier cannot quietly arrive free.
   */
  it('charges every tier-2 hull for deuterium, with no exception left', () => {
    const freeAtTierTwo = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].tier === 2 && HULLS[id].deuterium === 0);
    expect(freeAtTierTwo).toEqual([]);
  });

  /** And the entry tier still charges none, which is the half of D170 that stands. */
  it('leaves the entry tier free of it', () => {
    const chargingAtTierOne = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].tier === 1 && HULLS[id].deuterium > 0);
    expect(chargingAtTierOne).toEqual([]);
  });

  /** Alloy and Crystal did not move: this change is one column wide. */
  it('links deuterium to the monthly resource recipes', () => {
    expect(HULLS.VIPER.alloy).toBe(750);
    expect(HULLS.COURIER.alloy).toBe(600);
    expect(HULLS.CATACLYSM.alloy).toBe(4500);
  });
});
