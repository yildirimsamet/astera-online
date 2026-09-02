import { describe, expect, it } from 'vitest';
import { HULLS, MOBILE_HULLS, GROUND_HULLS } from '../src/hulls.js';
import { ECONOMY_TEMPO, scalePrice } from '../src/tempo.js';
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
 * Rampart as unfixable.
 */
const power = (id: HullId): number =>
  (HULLS[id].atk * HULLS[id].hp * 1e6) / (value(id) * value(id));

describe('Crystal-bearing hull prices', () => {
  const baselineCrystal = {
    PIKE: 90,
    RAMPART: 140,
    WARDEN: 110,
    COURIER: 150,
    VIPER: 130,
    TALON: 230,
    STRONGHOLD: 450,
    SENTINEL: 420,
    WAYFARER: 300,
    TEMPEST: 450,
    BALLISTA: 700,
    LEVIATHAN: 1150,
    PRAETORIAN: 900,
    ATLAS: 950,
    NULLIFIER: 800,
    CATACLYSM: 1700,
    CITADEL: 2100,
    BASTION: 800,
    THORN: 200,
    PROSPECTOR: 200,
  } as const;

  it('raises the Crystal build cost of every hull that uses Crystal by 15%', () => {
    for (const [id, baseline] of Object.entries(baselineCrystal) as [keyof typeof baselineCrystal, number][]) {
      expect(HULLS[id].crystal, id).toBe(
        scalePrice(baseline, ECONOMY_TEMPO.hullCrystalPrice),
      );
    }
  });

  it('does not add Crystal to a hull that did not use it', () => {
    expect(HULLS.DART.crystal).toBe(0);
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
      ['CATACLYSM', 'CITADEL'],
    ] as const;
    const averages = idsByTier.map((ids) =>
      ids.reduce((sum, id) => sum + power(id), 0) / ids.length,
    );
    for (let tier = 1; tier < averages.length; tier++) {
      const gain = averages[tier]! / averages[tier - 1]!;
      expect(gain, `tier ${String(tier + 1)} efficiency gain`).toBeGreaterThan(1.03);
      expect(gain, `tier ${String(tier + 1)} efficiency gain`).toBeLessThan(1.10);
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
    const tierFour = ['CATACLYSM', 'CITADEL'] as const;
    const average = (ids: readonly HullId[]) =>
      ids.reduce((sum, id) => sum + power(id), 0) / ids.length;
    const gap = average(tierFour) / average(tierOne);
    expect(gap).toBeGreaterThan(1.15);
    expect(gap).toBeLessThan(1.25);
  });

  /**
   * Ground hulls are paid 1.6x for never leaving: they cannot loot, cannot take
   * Dominion, and can only ever be part of a decision made at home.
   */
  it('pays the ground guns for being unable to leave', () => {
    for (const id of GROUND_HULLS) {
      expect(power(id), id).toBeGreaterThan(power('WARDEN'));
      expect(power(id), id).toBeLessThan(power('DART') * 2);
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
  it('keeps the Courier faster and the Wayfarer fatter', () => {
    expect(HULLS.COURIER.speed).toBeGreaterThan(HULLS.WAYFARER.speed);
    expect(HULLS.WAYFARER.cargo).toBeGreaterThan(HULLS.COURIER.cargo * 3);
    expect(HULLS.ATLAS.cargo).toBeGreaterThan(HULLS.WAYFARER.cargo * 2);
    expect(HULLS.WAYFARER.speed).toBeGreaterThan(HULLS.ATLAS.speed);
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
    expect(value('DART')).toBeLessThan(value('PIKE'));
    expect(value('PIKE')).toBeLessThan(value('RAMPART'));
  });
});
