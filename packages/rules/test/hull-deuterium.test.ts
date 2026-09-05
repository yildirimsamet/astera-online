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
 * Only the BUILD PRICE moved. Fuel is a separate charge (D136/D153) and
 * `FUEL.tierMass` is untouched, so what a hull costs to fly is exactly what it
 * was — this is about reaching the shipyard, not about reaching the target.
 */

/** The three the owner named. None of them may ask for deuterium at all. */
const FREE_OF_DEUTERIUM: readonly HullId[] = ['VIPER', 'WARDEN', 'COURIER'];

/** Every other hull that charges deuterium, at the figure it charged before D170. */
const HALVED: Readonly<Partial<Record<HullId, number>>> = {
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

  /** Alloy and Crystal did not move: this change is one column wide. */
  it('moves only the deuterium column', () => {
    expect(HULLS.VIPER.alloy).toBe(scalePrice(600, ECONOMY_TEMPO.hullPrice));
    expect(HULLS.COURIER.alloy).toBe(scalePrice(500, ECONOMY_TEMPO.hullPrice));
    expect(HULLS.CATACLYSM.alloy).toBe(scalePrice(4200, ECONOMY_TEMPO.hullPrice));
  });
});
