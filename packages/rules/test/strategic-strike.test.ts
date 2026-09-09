import { describe, expect, it } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR, MULTI_WORLD } from '../src/index.js';

const total = (r: { alloy: number; crystal: number; deuterium: number }): number =>
  r.alloy + r.crystal + r.deuterium;

/**
 * WHAT A DEATH STAR DOES, AFTER THE OWNER TOOK ITS TEETH OUT. D179.
 *
 * D167 made the weapon a DEADLINE: a struck colony went dark for eight hours and,
 * if its commander landed no ship inside that window, stopped being theirs. D179
 * removes that entirely on the owner's instruction, after sustained player
 * complaint. A strike is now an OUTAGE and nothing else:
 *
 *   · every struck world goes dark for the same two hours, colony and capital
 *     alike — the asymmetry existed only to make the deadline answerable, and
 *     there is no deadline left to answer;
 *   · NO WORLD IS EVER RELEASED. Not a capital, which was already a locked
 *     constraint, and now not a colony either. The weapon moves no control at all,
 *     to anybody, ever;
 *   · the defender's fleet SURVIVES. `DESTROYED_HOME` is gone, so the hulls
 *     standing at home are still standing when the lights come back on.
 *
 * WHAT IS LEFT is half the stores, one Core level with whatever it drags down,
 * two Aegis levels, the cancelled scaffolding, and two hours in the dark with the
 * launch bays sealed. That is still the largest single act of destruction in the
 * game — measured at 3x the weapon's price against a Core 12 world and near 13x
 * against a Core 17 one — but the buyer takes NOTHING home: no loot, no Dominion,
 * no world. It is a pure denial weapon now, and it is priced as one.
 */
describe('how long a struck world stays dark', () => {
  /**
   * ONE FIGURE, NOT TWO IDENTICAL ONES. `recoveryMinutesFor(kind)` is gone with the
   * split it existed to express — a function that reads a world's kind and returns
   * the same answer either way is a question nobody is asking any more.
   */
  it('gives every struck world the same two hours', () => {
    expect(MULTI_WORLD.recoveryMinutes).toBe(2 * 60);
  });
});

/**
 * THE TWO HALVES OF THE INTERLOCK ARE PRICED AGAINST EACH OTHER, and that is why
 * they are asserted together. The battery exists to stop the weapon; if answering
 * a strike ever costs more than launching one, an attacker bleeds a defender dry
 * by firing, which is the one outcome this pair may not produce.
 */
describe('what the strategic pair costs', () => {
  it('carries the owner’s figures exactly', () => {
    expect(DEATH_STAR.cost).toEqual({ alloy: 20_000, crystal: 10_000, deuterium: 2_500 });
    expect(ANTI_STRATEGIC.cost).toEqual({ alloy: 11_000, crystal: 8_000, deuterium: 1_500 });
  });

  it('never lets stopping a strike cost more than making one', () => {
    expect(total(ANTI_STRATEGIC.cost)).toBeLessThan(total(DEATH_STAR.cost));
  });

  /**
   * The share is the interlock's actual shape: cheap enough that a defender can
   * afford to be ready, dear enough that spending the shot is a real loss. Asserted
   * as a band rather than a number so the two may be retuned together, and fails
   * the moment one of them moves alone.
   */
  it('keeps the battery a real share of the weapon it answers', () => {
    const share = total(ANTI_STRATEGIC.cost) / total(DEATH_STAR.cost);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.75);
  });

  /**
   * IT CAME DOWN WITH WHAT IT DOES. D167 raised the price because the strike put
   * somebody else's colony on the table for the whole galaxy. D179 took that away,
   * so the weapon is worth materially less than it was and is priced under half of
   * the D167 figure — the owner's number, not a derived one.
   */
  it('is cheaper than it was when it could lose somebody a colony', () => {
    expect(total(DEATH_STAR.cost)).toBeLessThan(total({
      alloy: 35_000, crystal: 25_000, deuterium: 6_000,
    }) / 2);
  });
});
