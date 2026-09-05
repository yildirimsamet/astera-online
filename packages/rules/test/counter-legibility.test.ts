import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT,
  COMBAT_CLASSES,
  COUNTERS,
  HULLS,
  classShares,
  counteredBy,
  counterMult,
  counters,
  dominantClass,
  fleetValue,
  type Fleet,
  type HullClass,
} from '../src/index.js';

/**
 * THE COUNTER CYCLE, AS SOMETHING A SCREEN CAN DRAW. D124.
 *
 * `counterMult` has always been able to answer one pairwise question, which is
 * everything the resolver needs and nothing a card can render: a hull sheet cannot
 * ask "what am I strong against" by probing a function with all four classes and
 * hoping the answer is stable. So the relation is published as DATA here.
 *
 * The load-bearing tests are the two agreement blocks. A UI that draws a cycle the
 * resolver does not honour is worse than one that draws nothing — it teaches a rule
 * the game will then break, on the screen where fleets are committed. Every helper
 * below is therefore checked against `counterMult` itself over the real hull table,
 * so the two can never be tuned apart.
 */

const CLASS_OF = (id: (typeof ALL_HULLS)[number]): HullClass => HULLS[id].cls;

describe('the cycle as data', () => {
  it('names exactly the three classes that fight', () => {
    expect([...COMBAT_CLASSES].sort()).toEqual(['BULWARK', 'LANCE', 'SKIRMISHER']);
    // SUPPORT is prey, not a rung. It must never appear as one.
    expect(COMBAT_CLASSES).not.toContain('SUPPORT');
  });

  it('closes after three steps and never points at itself', () => {
    for (const cls of COMBAT_CLASSES) {
      expect(COUNTERS[cls]).not.toBe(cls);
      expect(COUNTERS[COUNTERS[COUNTERS[cls]]]).toBe(cls);
    }
  });

  it('is a cycle, not a hierarchy: every class is countered by exactly one other', () => {
    const targeted = COMBAT_CLASSES.map((cls) => COUNTERS[cls]);
    expect([...targeted].sort()).toEqual([...COMBAT_CLASSES].sort());
  });
});

describe('counters / counteredBy agree with the resolver', () => {
  it('a class is strong against the one it counters', () => {
    for (const cls of COMBAT_CLASSES) {
      const prey = counters(cls);
      expect(prey).not.toBeNull();
      expect(counterMult(cls, prey!)).toBe(COMBAT.strongMult);
    }
  });

  it('a class is weak against the one that counters it', () => {
    for (const cls of COMBAT_CLASSES) {
      const predator = counteredBy(cls);
      expect(predator).not.toBeNull();
      expect(counterMult(cls, predator!)).toBe(COMBAT.weakMult);
      // ...and the relation is symmetric in the way the cycle claims.
      expect(counterMult(predator!, cls)).toBe(COMBAT.strongMult);
    }
  });

  /**
   * THE ONE THAT MATTERS. Over the real table, for every ordered pair of hulls,
   * a chip drawn from `counters`/`counteredBy` must predict the exact multiplier
   * the resolver will apply. This is what stops the two drifting.
   */
  it('predicts the multiplier for every ordered pair in the hull table', () => {
    for (const a of ALL_HULLS) {
      for (const d of ALL_HULLS) {
        const atk = CLASS_OF(a);
        const def = CLASS_OF(d);
        const drawn =
          atk === 'SUPPORT'
            ? 0
            : def === 'SUPPORT'
              ? COMBAT.strongMult
              : counters(atk) === def
                ? COMBAT.strongMult
                : counteredBy(atk) === def
                  ? COMBAT.weakMult
                  : 1;
        expect(drawn, `${a} (${atk}) vs ${d} (${def})`).toBe(counterMult(atk, def));
      }
    }
  });

  it('places SUPPORT outside the cycle rather than inventing a rung for it', () => {
    expect(counters('SUPPORT')).toBeNull();
    expect(counteredBy('SUPPORT')).toBeNull();
  });
});

describe('classShares', () => {
  /**
   * SHARE OF VALUE, NOT OF HP OR OF COUNT — and the choice is load-bearing.
   *
   * The one axis a commander can already read on both sides is `fleetValue`: it is
   * what a probe's defence band reports and what a battle grades on. Splitting the
   * same axis by class means the two bars on the launch sheet are the same
   * quantity, so the comparison is arithmetic the player could check by hand.
   * An HP share would be a second, invisible currency on the same screen.
   */
  it('is empty for an empty fleet', () => {
    const shares = classShares({});
    for (const cls of ['SKIRMISHER', 'BULWARK', 'LANCE', 'SUPPORT'] as const) {
      expect(shares[cls]).toBe(0);
    }
  });

  it('gives a single-class fleet the whole share', () => {
    expect(classShares({ DART: 7 }).SKIRMISHER).toBe(1);
    expect(classShares({ DART: 7 }).LANCE).toBe(0);
  });

  it('splits by value and sums to one', () => {
    const fleet: Fleet = { DART: 10, PIKE: 4, RAMPART: 2, COURIER: 1 };
    const shares = classShares(fleet);
    const total = Object.values(shares).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(shares.SKIRMISHER).toBeCloseTo(
      fleetValue({ DART: 10 }) / fleetValue(fleet),
      10,
    );
    expect(shares.SUPPORT).toBeCloseTo(fleetValue({ COURIER: 1 }) / fleetValue(fleet), 10);
  });

  /**
   * A probe's defence band is `fleetValue` over everything standing on the world,
   * and the two ground guns sit in OPPOSITE classes on purpose (D27). A share that
   * dropped them would describe a different wall than the one being flown at.
   */
  it('counts the ground guns, in their own opposed classes', () => {
    expect(classShares({ THORN: 5 }).SKIRMISHER).toBe(1);
    expect(classShares({ BASTION: 5 }).BULWARK).toBe(1);
  });
});

describe('dominantClass', () => {
  it('names the class holding the most value', () => {
    expect(dominantClass({ RAMPART: 10, DART: 1 })).toBe('BULWARK');
    expect(dominantClass({ DART: 400, RAMPART: 1 })).toBe('SKIRMISHER');
  });

  it('has no answer for an empty fleet', () => {
    expect(dominantClass({})).toBeNull();
  });

  /**
   * AN EXACT TIE HAS NO DOMINANT CLASS, and saying so is the point. The caller
   * renders "mostly Bulwark" off this; on a balanced wall there is no such fact and
   * inventing one would be the interface asserting a reading nobody took.
   */
  it('refuses to break an exact tie', () => {
    const bulwark = fleetValue({ RAMPART: 1 });
    const skirmisher = fleetValue({ THORN: 1 });
    // Build an exact tie out of the two real prices.
    const fleet: Fleet = { RAMPART: skirmisher, THORN: bulwark };
    expect(fleetValue({ RAMPART: fleet.RAMPART })).toBe(fleetValue({ THORN: fleet.THORN }));
    expect(dominantClass(fleet)).toBeNull();
  });
});
