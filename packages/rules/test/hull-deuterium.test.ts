import { describe, expect, it } from 'vitest';
import { HULLS } from '../src/hulls.js';
import { ECONOMY_TEMPO, scalePrice } from '../src/tempo.js';
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
const HALVED: Readonly<Partial<Record<HullId, number>>> = {
  /*
    Reinstated rather than restored: the Viper never carried a pre-D170 figure to
    halve, so 50 is derived from the ladder around it. Tier 3 prices its raider at
    80 against its lance's 140, and the tier-2 lance is the Talon at 80 — so the
    tier-2 raider is 80 x (80/140), which rounds onto 50 and halves to 25.
  */
  VIPER: 50,
  TALON: 80,
  STRONGHOLD: 80,
  SENTINEL: 150,
  WAYFARER: 200,
  TEMPEST: 160,
  BALLISTA: 280,
  LEVIATHAN: 280,
  PRAETORIAN: 300,
  ATLAS: 400,
  NULLIFIER: 280,
  CATACLYSM: 650,
  CITADEL: 600,
};

describe('the deuterium a hull costs to build', () => {
  for (const id of FREE_OF_DEUTERIUM) {
    it(`${id} asks for none at all`, () => {
      expect(HULLS[id].deuterium).toBe(0);
    });
  }

  for (const [id, before] of Object.entries(HALVED) as [HullId, number][]) {
    it(`${id} asks for half of what it did`, () => {
      expect(HULLS[id].deuterium).toBe(scalePrice(before / 2, ECONOMY_TEMPO.hullPrice));
    });
  }

  /** Nothing else grew a deuterium price while the rest were being cut. */
  it('leaves no hull charging deuterium outside the two lists', () => {
    const charging = (Object.keys(HULLS) as HullId[])
      .filter((id) => HULLS[id].deuterium > 0)
      .sort();
    expect(charging).toEqual(Object.keys(HALVED).sort());
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
  it('moves only the deuterium column', () => {
    expect(HULLS.VIPER.alloy).toBe(scalePrice(600, ECONOMY_TEMPO.hullPrice));
    expect(HULLS.COURIER.alloy).toBe(scalePrice(500, ECONOMY_TEMPO.hullPrice));
    expect(HULLS.CATACLYSM.alloy).toBe(scalePrice(4200, ECONOMY_TEMPO.hullPrice));
  });
});
