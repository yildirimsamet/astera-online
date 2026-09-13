import { describe, expect, it } from 'vitest';
import { HULLS, MOBILE_HULLS, GROUND_HULLS, combatValue, fleetValue } from '../src/hulls.js';
import { COMBAT } from '../src/constants.js';
import type { HullId } from '../src/types.js';
import { resourceValue } from '../src/valuation.js';

/**
 * WHAT THE HULL TABLE IS PRICED ON. Economy v2.
 *
 * This file used to freeze every hull statistic as a literal so that D82's crystal
 * surcharge could be proved to have moved one column and nothing else. That guard
 * has done its job and the table has been re-derived from scratch since, so
 * freezing the old numbers would only assert that the rewrite did not happen.
 *
 * What replaces it is the RULE the new table was built from, which is the thing a
 * future change can actually get wrong.
 */

const value = (id: HullId): number =>
  resourceValue(HULLS[id]);

/**
 * Equal-budget power. With damage spread across a force rather than focused, what
 * a fixed budget buys goes as `atk x hp / value^2` — NOT as attack per resource,
 * which is the quantity `docs/balance.md` used and the reason it recorded the
 * Rampart as unfixable.
 */
const power = (id: HullId): number =>
  (HULLS[id].atk * HULLS[id].hp * 1e6) / (value(id) * value(id));

describe('monthly crystal recipes', () => {
  it('charges crystal on every ship, including the opening Dart', () => {
    expect(HULLS.DART.crystal).toBe(78);
    expect(HULLS.COURIER.crystal).toBe(195);
    expect(HULLS.ATLAS.crystal).toBe(1300);
    for (const hull of Object.values(HULLS)) expect(hull.crystal).toBeGreaterThan(0);
  });
});

describe('the hull table is priced on equal-budget power', () => {
  /**
   * THE BUG THIS EXISTS TO STOP COMING BACK. At 4.2 attack per 1,000 resources
   * against a Dart's 26.9, the shipped Rampart lost every equal-budget matchup in
   * the game including against the Pike it counters — so nobody built the top of
   * the tree and the counter cycle had a dead corner.
   */
  it('makes each progression tier modestly more efficient on average', () => {
    const idsByTier = [
      ['DART', 'PIKE', 'RAMPART', 'WARDEN'],
      ['VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL'],
      ['TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN'],
      ['CORSAIR', 'CATACLYSM', 'CITADEL', 'PALADIN'],
    ] as const;
    const averages = idsByTier.map((ids) =>
      ids.reduce((sum, id) => sum + power(id), 0) / ids.length,
    );
    for (let tier = 1; tier < averages.length; tier++) {
      const gain = averages[tier]! / averages[tier - 1]!;
      expect(gain, `tier ${String(tier + 1)} efficiency gain`).toBeGreaterThan(1.03);
      /*
        1.13, NOT 1.10, AND D170 IS WHY — read this before treating it as slack.

        Halving every deuterium price did not cut the tiers evenly: deuterium is a
        larger share of a heavy hull's bill than of a light one's, and three of
        tier 1's four hulls never charged any, so tier 2 got the deepest discount
        of the four. The band moved because the PRICES moved, which is the one
        reason a measured band may move at all.

        What it is still holding is the shape: a tier is a modest edge, not a
        different game. If a future change wants it back under 1.10 the lever is
        Alloy and Crystal on the tier-2 hulls, never this number.
      */
      expect(gain, `tier ${String(tier + 1)} efficiency gain`).toBeLessThan(1.13);
    }
  });

  /**
   * ...but only just. A tier buys about 15%; the counter cycle buys 156%
   * (1.6 against 0.625). **Information has to beat tech, by construction** — that
   * is the claim the whole design rests on, and a wide tier gap would quietly
   * replace it with "whoever unlocked the most".
   */
  it('keeps the tier gap far below the counter cycle', () => {
    const tierOne = ['DART', 'PIKE', 'RAMPART', 'WARDEN'] as const;
    const tierFour = ['CORSAIR', 'CATACLYSM', 'CITADEL', 'PALADIN'] as const;
    const average = (ids: readonly HullId[]) =>
      ids.reduce((sum, id) => sum + power(id), 0) / ids.length;
    const gap = average(tierFour) / average(tierOne);
    expect(gap).toBeGreaterThan(1.15);
    // 1.26 after D170's deuterium cut — see the note on the tier gain above. The
    // claim this guards is unchanged and still enormous: 1.26 against the counter
    // cycle's 2.56, so knowing what your opponent flies is worth ten tiers.
    expect(gap).toBeLessThan(1.27);
    expect(COMBAT.strongMult / COMBAT.weakMult).toBeGreaterThan(gap * 2);
  });

  /**
   * Ground hulls are paid for never leaving: they cannot loot, cannot take
   * Dominion, and can only ever be part of a decision made at home. The owner's
   * 30% ship-price experiment deliberately excludes emplacements, so their live
   * efficiency edge over the now-dearer Dart is a little above 2x.
   */
  it('pays the ground guns for being unable to leave', () => {
    for (const id of GROUND_HULLS) {
      expect(power(id), id).toBeGreaterThan(power('WARDEN'));
      expect(power(id), id).toBeLessThan(power('DART') * 2.1);
    }
  });

  /** The two ground guns sit in opposite classes, so defence is a CHOICE. D27. */
  it('keeps the two ground guns in opposite counter classes', () => {
    expect(HULLS.THORN.cls).not.toBe(HULLS.BASTION.cls);
    expect(HULLS.THORN.minShipyard).toBe(0);
  });

  /** Support hulls deal nothing and sell cargo instead. */
  it('sells cargo rather than damage on the support hulls', () => {
    for (const id of ['COURIER', 'WAYFARER', 'ATLAS', 'PROSPECTOR'] as const) {
      expect(HULLS[id].atk, id).toBe(0);
      expect(HULLS[id].cargo, id).toBeGreaterThan(0);
    }
    const perResource = (id: HullId) => HULLS[id].cargo / value(id);
    expect(perResource('WAYFARER')).toBeGreaterThan(perResource('COURIER'));
    expect(perResource('ATLAS')).toBeGreaterThan(perResource('WAYFARER'));
    expect(perResource('COURIER')).toBeGreaterThan(perResource('DART'));
  });

  /**
   * A Courier shortens exposure; it never replaces a Wayfarer. D94. It carries less
   * per resource and makes up for it by arriving sooner.
   */
  /**
   * THIS ASSERTED THE OPPOSITE OF ITS OWN TITLE. D186.
   *
   * It read `COURIER.speed === WAYFARER.speed` under the words "keeps the Courier
   * faster" — written to lock in a profile that had flattened the cargo ladder to
   * one figure. A test bent to fit a defect is worse than no test: it reports the
   * defect as the contract. The hold ladder is the contract, and it is what this
   * now says.
   */
  it('keeps the Courier faster and the Wayfarer fatter', () => {
    expect(HULLS.COURIER.speed).toBeGreaterThan(HULLS.WAYFARER.speed);
    expect(HULLS.WAYFARER.speed).toBeGreaterThan(HULLS.ATLAS.speed);
    expect(HULLS.WAYFARER.cargo).toBeGreaterThan(HULLS.COURIER.cargo * 3);
    expect(HULLS.ATLAS.cargo).toBeGreaterThan(HULLS.WAYFARER.cargo * 2);
  });

  /** Every price is a whole resource, and nothing is free. */
  it('prices every hull in whole units, and none at nothing', () => {
    for (const id of Object.keys(HULLS) as HullId[]) {
      expect(Number.isInteger(HULLS[id].alloy), id).toBe(true);
      expect(Number.isInteger(HULLS[id].crystal), id).toBe(true);
      expect(Number.isInteger(HULLS[id].deuterium), id).toBe(true);
      expect(value(id), id).toBeGreaterThan(0);
    }
  });

  /**
   * Speed is what the raid tempo is made of, so the ordering is load-bearing: a
   * Dart is the fastest thing in an attack fleet and a Rampart the slowest, which
   * is what lets a commander buy surprise with speed and lets a radar telegraph a
   * slow one.
   */
  it('keeps the attack fleet ordered fastest-cheapest to slowest-dearest', () => {
    const flying = MOBILE_HULLS.filter((id) => HULLS[id].atk > 0);
    for (const id of flying) {
      expect(HULLS[id].speed, id).toBeGreaterThan(0);
    }
    expect(HULLS.DART.speed).toBeGreaterThan(HULLS.PIKE.speed);
    expect(HULLS.PIKE.speed).toBeGreaterThan(HULLS.RAMPART.speed);
    expect(value('DART')).toBe(value('PIKE'));
    expect(value('PIKE')).toBeLessThan(value('RAMPART'));
  });

  /**
   * THE ESCORT TRADES PART OF THE FORTRESS HULL FOR SPEED. D206, owner instruction:
   * *"Evet escort hızlanmalı"*. Both are Bulwark class, and the profile read the
   * trip off the CLASS alone, so every Escort flew exactly as slowly as the Fortress
   * of its tier while being the smaller hull — the trade the roster was authored
   * around had no speed half. The hold tilts the other way with the same trip.
   */
  it('flies every Escort faster than its tier\'s Fortress and below its Raider', () => {
    const at = (profile: string, tier: number) =>
      MOBILE_HULLS.map((id) => HULLS[id]).find((h) => h.profile === profile && h.tier === tier)!;
    for (const tier of [1, 2, 3, 4]) {
      const escort = at('ESCORT', tier), fortress = at('FORTRESS', tier), raider = at('RAIDER', tier);
      expect(escort.speed, escort.id).toBeGreaterThan(fortress.speed);
      expect(escort.speed, escort.id).toBeLessThan(raider.speed);
      expect(escort.cargo, escort.id).toBeLessThan(fortress.cargo);
    }
  });
});

/**
 * WHAT A FLEET IS WORTH IN A FIGHT, WHICH IS NOT WHAT IT COST. D183, owner report:
 * *"Yük gemisi ekliyorum gücüm artıyor ama yük gemilerinin saldırısı 0. Saçma
 * değil mi?"*
 *
 * `fleetValue` is resources sunk in, and it is exactly right for what it grades —
 * a battle's exchange, Dominion, a debris field. It is the wrong number on the
 * launch sheet's own comparison, because an Atlas is 3,050 of it and fires nothing:
 * a commander packing cargo for the loot watched the bar labelled "what you are
 * sending" grow while the force they were sending stood still.
 *
 * ATTACK IS THE TEST, and it is the player's own words. A hull that cannot fire is
 * not part of the force being compared — the two ground guns are (they fire), the
 * transports and the Prospector are not (they do not). It stays priced in RESOURCES
 * rather than in attack, because the other side of that comparison is a probe's
 * defence band and both sides have to be the same quantity to be a comparison at
 * all.
 */
describe('the force in a fleet, as opposed to the money in it', () => {
  it('counts every hull that can fire, at what it cost', () => {
    expect(combatValue({ DART: 1 })).toBe(fleetValue({ DART: 1 }));
    expect(combatValue({ BASTION: 1 })).toBe(fleetValue({ BASTION: 1 }));
    expect(combatValue({ THORN: 2 })).toBe(fleetValue({ THORN: 2 }));
  });

  it('counts nothing for a hull that cannot fire', () => {
    for (const id of ['COURIER', 'WAYFARER', 'ATLAS', 'PROSPECTOR'] as const) {
      expect(HULLS[id].atk, id).toBe(0);
      expect(combatValue({ [id]: 3 }), id).toBe(0);
    }
  });

  it('adds a transport to a wing without moving the force it represents', () => {
    const wing = { DART: 10, VIPER: 4 } as const;
    expect(combatValue({ ...wing, ATLAS: 2 })).toBe(combatValue(wing));
    // And `fleetValue` still moves, because the resources really did leave.
    expect(fleetValue({ ...wing, ATLAS: 2 })).toBeGreaterThan(fleetValue(wing));
  });

  it('is empty rather than negative or NaN on an empty fleet', () => {
    expect(combatValue({})).toBe(0);
  });
});
