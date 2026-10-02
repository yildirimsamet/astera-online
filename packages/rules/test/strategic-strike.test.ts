import { describe, expect, it } from 'vitest';
import {
  ANTI_STRATEGIC,
  DEATH_STAR,
  ECONOMY_ADJUSTMENT,
  FEATURE_FLAGS,
  interceptorCapacity,
  strategicStockpile,
} from '../src/index.js';

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
 * game, but the buyer takes NOTHING home: no loot, no Dominion, no world. D203
 * triples the weapon's price directly; the older damage-to-price measurements no
 * longer describe this owner-set balance.
 */
describe('the tactical EMP contract', () => {
  it('keeps the weapon enabled with no research release switch left', () => {
    expect(FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED).toBe(true);
    expect(Object.keys(FEATURE_FLAGS)).toEqual(['STRATEGIC_CRAFTING_ENABLED']);
  });

  it('disables Aegis regeneration and ground defence for exactly one hour', () => {
    expect(DEATH_STAR.empMinutes).toBe(60);
  });

  /**
   * OWNER, 2026-10-01: one weapon and two charges by default; the Stockpile makes it
   * two weapons, the Grid four charges. Defence holds more at every rung, and each
   * research changes an outcome: two weapons from two worlds beat two charges.
   */
  it('holds one weapon and two charges by default, two and four when researched', () => {
    expect(strategicStockpile(0)).toBe(1);
    expect(strategicStockpile(1)).toBe(2);
    expect(interceptorCapacity(0)).toBe(2);
    expect(interceptorCapacity(1)).toBe(4);
  });

  it('never grows past its researched ceiling', () => {
    expect(strategicStockpile(99)).toBe(2);
    expect(interceptorCapacity(99)).toBe(4);
  });

  /**
   * OWNER, 2026-10-01: *"her ölüm yıldızı vuruşunda %20 sadakat puanı düşer"*. A colony
   * at 20 or less falls to zero on the hit and secedes through the ordinary loyalty path.
   */
  it('cuts a struck colony’s loyalty by twenty points', () => {
    expect(DEATH_STAR.colonyLoyaltyLoss).toBe(20);
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
    expect(DEATH_STAR.cost).toEqual({ alloy: 50_000, crystal: 35_000, deuterium: 3_000 });
    expect(ANTI_STRATEGIC.cost).toEqual({ alloy: 21_550, crystal: 10_776, deuterium: 894 });
  });

  it('never lets stopping a strike cost more than making one', () => {
    expect(total(ANTI_STRATEGIC.cost)).toBeLessThan(total(DEATH_STAR.cost));
  });

  /**
   * OWNER, 2026-10-01: the weapon falls to 88,000 and the charge stays at 33,220, so
   * one shot is about 38% of what it stops — up from 30%, the gap the owner called
   * unfair. The narrow band allows only component rounding.
   */
  it('keeps the battery a real share of the weapon it answers', () => {
    const share = total(ANTI_STRATEGIC.cost) / total(DEATH_STAR.cost);
    expect(share).toBeGreaterThan(0.37);
    expect(share).toBeLessThan(0.39);
  });

  /**
   * ONE HOUR, owner instruction: *"ölüm yıldızı üretim süresi 1 saat olmalı"*. A
   * working-tree retune had taken it to four; the battery follows at half, because
   * the reload rule below is the interlock and not a second figure.
   */
  it('prices the reusable defence reload at half the weapon work', () => {
    // The owner's hour is the AUTHORED figure. `ECONOMY_ADJUSTMENT.buildTime` then
    // shaves 2.5% off every timer in the game, and a weapon exempt from the one
    // global dial would be the exception nobody could predict from.
    expect(DEATH_STAR.buildMinutes).toBe(60 * ECONOMY_ADJUSTMENT.buildTime);
    expect(ANTI_STRATEGIC.buildMinutes).toBe(DEATH_STAR.buildMinutes / 2);
  });
});
