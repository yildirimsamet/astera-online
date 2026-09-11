import { describe, expect, it } from 'vitest';
import {
  RESEARCH_TECH,
  TRANSFER_CARGO_HULLS,
  cargoMult,
  fleetCargo,
  transferCargoCapacity,
} from '../src/index.js';

/**
 * CARGO HOLDS LIFTS EVERY HOLD, NOT JUST A RAID'S. D180 — owner instruction.
 *
 * The project used to move exactly one number: `fleetCargo`, the loot ceiling a
 * raid comes home under. `transferCargoCapacity` — the dedicated transports moving
 * ore between a commander's own worlds, and the figure a trade convoy is sized by —
 * took no part in it, deliberately, on the reasoning that "what a raid carries
 * away" and "what a logistics run can move" are two different questions.
 *
 * THEY ARE ONE QUESTION TO THE PLAYER, and that is why this changed. A commander
 * who buys a project called Cargo Holds and watches their Atlas carry exactly what
 * it carried yesterday has not learned a subtlety about raid economics; they have
 * learned the game lied to them. The separation was legible in the code and
 * invisible on the screen, which is the wrong way round.
 *
 * SO ONE MULTIPLIER, READ FROM ONE PLACE. `cargoMult` is the whole of the effect,
 * and both capacities apply it identically — floor after the multiply, so the two
 * can never round apart.
 */
const BASE = { COURIER: 4, ATLAS: 2 } as const;

describe('what the Cargo Holds ladder lifts', () => {
  it('lifts a transport convoy by exactly the raid multiplier', () => {
    for (let level = 0; level <= RESEARCH_TECH.cargoLadder.length; level += 1) {
      const tech = { CARGO_HOLDS: level };
      expect(transferCargoCapacity(BASE, tech))
        .toBe(Math.floor(transferCargoCapacity(BASE, {}) * cargoMult(tech)));
    }
  });

  it('actually grows the hold, rather than quietly returning the base figure', () => {
    const top = { CARGO_HOLDS: RESEARCH_TECH.cargoLadder.length };
    expect(transferCargoCapacity(BASE, top))
      .toBeGreaterThan(transferCargoCapacity(BASE, {}));
  });

  /**
   * THE TWO CAPACITIES STILL ASK DIFFERENT QUESTIONS. What changed is the ladder
   * they share, not the rosters they count: a raid's ceiling counts every hull that
   * flies, and a logistics run counts the three dedicated transports. A Dart moves
   * the first and not the second, and that is still the whole distinction.
   *
   * THE SECOND ASSERTION USED TO SAY THE OPPOSITE, and it passed for one reason:
   * `profileHull` overwrote every warship's authored hold with zero, so a Dart moved
   * NEITHER figure and the distinction this test is named for could not be observed.
   * D195 gave the warships their holds back, which is what makes the sentence above
   * true for the first time. Same design, an assertion that now measures it.
   */
  it('still counts only the dedicated transports', () => {
    const withEscort = { ...BASE, DART: 20 };
    const tech = { CARGO_HOLDS: 2 };
    expect(transferCargoCapacity(withEscort, tech)).toBe(transferCargoCapacity(BASE, tech));
    expect(fleetCargo(withEscort, tech)).toBeGreaterThan(fleetCargo(BASE, tech));
  });

  it('counts every transport in the list and nothing else', () => {
    const tech = { CARGO_HOLDS: 3 };
    const each = TRANSFER_CARGO_HULLS
      .reduce((sum, id) => sum + transferCargoCapacity({ [id]: 1 }, tech), 0);
    expect(each).toBeGreaterThan(0);
    expect(transferCargoCapacity({ BASTION: 5, DART: 5 }, tech)).toBe(0);
  });
});
