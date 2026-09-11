import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS, HULLS, SUPPORT_HULLS, hullFuelMass, shipMinutes, type HullId,
} from '../src/index.js';

const val = (id: HullId): number => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;
const minutes = (id: HullId): number => shipMinutes(
  { alloy: HULLS[id].alloy, crystal: HULLS[id].crystal, deuterium: HULLS[id].deuterium },
  Math.max(1, HULLS[id].minShipyard), {},
);
/** The three dedicated transports, tier-ascending. The Prospector is not one. */
const LINE = SUPPORT_HULLS.filter((id) => HULLS[id].profile === 'TRANSPORT')
  .sort((a, b) => (HULLS[a].tier ?? 0) - (HULLS[b].tier ?? 0));

/**
 * A TRANSPORT MUST CARRY MORE THAN IT COSTS. D195b, owner instruction (option B).
 *
 * Measured before the change: the ladder was 700 / 2,200 / 6,000 against prices of
 * 750 / 1,912 / 4,648, so the COURIER carried 933 units of ore per 1,000 spent — the
 * only hull in the game worth less full than empty. The direction of the ladder was
 * right and its entry rung was underwater, which is the same defect the fuel ladder
 * had one floor up: a first rung that punishes the player for taking it.
 *
 * The second reading is what set the size. Against a matched target at four
 * development stages, `computeLoot` came home holding 877 of 880, 2,736 of 2,740,
 * 8,217 of 8,220 and 21,037 of 21,040 — the HOLD is the binding constraint on every
 * raid in the game, at every stage, to the last unit. The vault floor does not bind,
 * the battle grade does not bind. So the fraction of a target's exposed wealth that
 * a raid takes home is a direct statement of this ladder and nothing else, and it
 * sat flat at 6-10% however far either commander had developed.
 */
describe('what a transport carries', () => {
  it('carries more than it cost, at every rung', () => {
    for (const id of LINE) {
      expect(HULLS[id].cargo / val(id), id).toBeGreaterThan(1.2);
    }
  });

  it('improves that trade with every tier', () => {
    for (let i = 1; i < LINE.length; i += 1) {
      expect(HULLS[LINE[i]!].cargo / val(LINE[i]!), LINE[i])
        .toBeGreaterThan(HULLS[LINE[i - 1]!].cargo / val(LINE[i - 1]!));
    }
  });

  it('improves the fuel and the yard time with it', () => {
    for (let i = 1; i < LINE.length; i += 1) {
      const before = LINE[i - 1]!, after = LINE[i]!;
      expect(HULLS[after].cargo / hullFuelMass(after), after)
        .toBeGreaterThan(HULLS[before].cargo / hullFuelMass(before));
      expect(HULLS[after].cargo / minutes(after), after)
        .toBeGreaterThan(HULLS[before].cargo / minutes(before));
    }
  });

  /**
   * AND A WARSHIP STILL CANNOT REPLACE ONE. The combat holds D195 added are a floor
   * under a raid's worth, never a substitute for logistics — if a Citadel ever
   * carried ore as cheaply as an Atlas, the transport would stop being a decision.
   */
  it('stays far cheaper per unit carried than any warship', () => {
    const bestWarship = Math.max(...COMBAT_HULLS.map((id) => HULLS[id].cargo / val(id)));
    const worstTransport = Math.min(...LINE.map((id) => HULLS[id].cargo / val(id)));
    expect(worstTransport / bestWarship).toBeGreaterThan(5);
  });

  it('never lets a warship hold approach a transport hold', () => {
    const smallestTransport = Math.min(...LINE.map((id) => HULLS[id].cargo));
    for (const id of COMBAT_HULLS) {
      expect(HULLS[id].cargo * 2, id).toBeLessThan(smallestTransport);
    }
  });
});
