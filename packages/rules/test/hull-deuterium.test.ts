import { describe, expect, it } from 'vitest';
import { HULLS } from '../src/hulls.js';

import type { HullId } from '../src/types.js';

/**
 * WHAT A HULL COSTS IN DETERIUM, HALVED, AND THREE MADE FREE OF IT. D170.
 *
 * Deuterium is the one resource a young commander cannot make until they have
 * bought the research and stood the plant, and every hull that asked for it was a
 * door held shut behind that chain. The owner cut every figure in half and took it
 * off three hulls entirely — the entry-tier escort, the entry-tier transport and
 * the tier-2 skirmisher — so the opening of the game is buildable out of the two
 * resources a world produces on its own from minute one.
 *
 * THE VIPER IS BACK ON THE LADDER. Later owner instruction, reversing exactly one
 * third of D170: *"level 2 gemilerden craft yaparken sadece engerek deuterium
 * istemiyor, bu yanlış."* D170's exemption was written as "the entry tier plus the
 * tier-2 skirmisher", and that last clause is what broke the reading — TIER 2 is
 * where the deuterium chain is supposed to start, so one free hull sitting beside
 * four that charge does not read as generosity, it reads as an oversight.
 *
 * The entry tier keeps its exemption in full: Warden and Courier are tier 1, and
 * tier 1 charges no deuterium at all. The opening of the game is untouched.
 *
 * Only the BUILD PRICE moved. Fuel is a separate charge (D136/D153) and
 * `FUEL.tierMass` is untouched, so what a hull costs to fly is exactly what it
 * was — this is about reaching the shipyard, not about reaching the target.
 */

/** The entry tier, which charges no deuterium at all. */
const FREE_OF_DEUTERIUM: readonly HullId[] = ['WARDEN', 'COURIER'];

/** Every other hull that charges deuterium, at the figure it charged before D170. */
const HALVED: Readonly<Partial<Record<HullId, number>>> = {"VIPER": 8, "TALON": 8, "STRONGHOLD": 10, "SENTINEL": 8, "WAYFARER": 12, "TEMPEST": 24, "BALLISTA": 24, "LEVIATHAN": 30, "PRAETORIAN": 24, "ATLAS": 48, "NULLIFIER": 28, "CATACLYSM": 80, "CITADEL": 100};

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

  for (const [id, before] of Object.entries(HALVED) as [HullId, number][]) {
    it(`${id} charges the monthly tier recipe`, () => {
      expect(HULLS[id].deuterium).toBe(before);
    });
  }

  /** Nothing else grew a deuterium price while the rest were being cut. */
  it('leaves no hull charging deuterium outside the two lists', () => {
    const charging = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].deuterium > 0)
      .sort();
    expect(charging).toEqual([...Object.keys(HALVED), ...ADDED_AT_D196].sort());
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
