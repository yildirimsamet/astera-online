import { describe, expect, it } from 'vitest';
import { HULLS, MOBILE_HULLS, GROUND_HULLS } from '../src/hulls.js';
import type { HullId } from '../src/types.js';

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
  HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;

/**
 * Equal-budget power. With damage spread across a force rather than focused, what
 * a fixed budget buys goes as `atk x hp / value^2` — NOT as attack per resource,
 * which is the quantity `docs/balance.md` used and the reason it recorded the
 * Bulwark as unfixable.
 */
const power = (id: HullId): number =>
  (HULLS[id].atk * HULLS[id].hp * 1e6) / (value(id) * value(id));

describe('the hull table is priced on equal-budget power', () => {
  /**
   * THE BUG THIS EXISTS TO STOP COMING BACK. At 4.2 attack per 1,000 resources
   * against a Wasp's 26.9, the shipped Bulwark lost every equal-budget matchup in
   * the game including against the Lance it counters — so nobody built the top of
   * the tree and the counter cycle had a dead corner.
   */
  it('makes each tech tier worth buying, in order', () => {
    expect(power('LANCE')).toBeGreaterThan(power('WASP'));
    expect(power('BULWARK')).toBeGreaterThan(power('LANCE'));
  });

  /**
   * ...but only just. A tier buys about 15%; the counter cycle buys 156%
   * (1.6 against 0.625). **Information has to beat tech, by construction** — that
   * is the claim the whole design rests on, and a wide tier gap would quietly
   * replace it with "whoever unlocked the most".
   */
  it('keeps the tier gap far below the counter cycle', () => {
    const gap = power('BULWARK') / power('WASP');
    expect(gap).toBeGreaterThan(1.1);
    expect(gap).toBeLessThan(1.6);
  });

  /**
   * Ground hulls are paid 1.6x for never leaving: they cannot loot, cannot take
   * Dominion, and can only ever be part of a decision made at home.
   */
  it('pays the ground guns for being unable to leave', () => {
    for (const id of GROUND_HULLS) {
      expect(power(id), id).toBeGreaterThan(power('BULWARK'));
      expect(power(id), id).toBeLessThan(power('WASP') * 2);
    }
  });

  /** The two ground guns sit in opposite classes, so defence is a CHOICE. D27. */
  it('keeps the two ground guns in opposite counter classes', () => {
    expect(HULLS.THORN.cls).not.toBe(HULLS.BASTION.cls);
    expect(HULLS.THORN.minShipyard).toBe(0);
  });

  /** Support hulls deal nothing and sell cargo instead. */
  it('sells cargo rather than damage on the support hulls', () => {
    for (const id of ['HAULER', 'RUNNER', 'PROSPECTOR'] as const) {
      expect(HULLS[id].atk, id).toBe(0);
      expect(HULLS[id].cargo, id).toBeGreaterThan(0);
    }
    const perResource = (id: HullId) => HULLS[id].cargo / value(id);
    expect(perResource('HAULER')).toBeGreaterThan(perResource('RUNNER') * 3);
    expect(perResource('RUNNER')).toBeGreaterThan(perResource('WASP'));
  });

  /**
   * A Runner shortens exposure; it never replaces a Hauler. D94. It carries less
   * per resource and makes up for it by arriving sooner.
   */
  it('keeps the Runner faster and the Hauler fatter', () => {
    expect(HULLS.RUNNER.speed).toBeGreaterThan(HULLS.HAULER.speed);
    expect(HULLS.HAULER.cargo).toBeGreaterThan(HULLS.RUNNER.cargo * 4);
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
   * Wasp is the fastest thing in an attack fleet and a Bulwark the slowest, which
   * is what lets a commander buy surprise with speed and lets a radar telegraph a
   * slow one.
   */
  it('keeps the attack fleet ordered fastest-cheapest to slowest-dearest', () => {
    const flying = MOBILE_HULLS.filter((id) => HULLS[id].atk > 0);
    for (const id of flying) {
      expect(HULLS[id].speed, id).toBeGreaterThan(0);
    }
    expect(HULLS.WASP.speed).toBeGreaterThan(HULLS.LANCE.speed);
    expect(HULLS.LANCE.speed).toBeGreaterThan(HULLS.BULWARK.speed);
    expect(value('WASP')).toBeLessThan(value('LANCE'));
    expect(value('LANCE')).toBeLessThan(value('BULWARK'));
  });
});
