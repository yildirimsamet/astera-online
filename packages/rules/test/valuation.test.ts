import { describe, expect, it } from 'vitest';
import { RESOURCE_VALUE, resourceValue } from '../src/valuation.js';
import { GALAXY_EVENTS, HULLS, TRADE, fleetValue, galaxyEventConfigForRuleset, quoteTrade, tradeShipSpec } from '../src/index.js';

describe('the owner-selected 32:16:1 resource value', () => {
  it('values each component and mixed invoices in alloy equivalents', () => {
    expect(RESOURCE_VALUE).toEqual({ alloy: 1, crystal: 2, deuterium: 32 });
    expect(resourceValue({ alloy: 32, crystal: 0, deuterium: 0 })).toBe(32);
    expect(resourceValue({ alloy: 0, crystal: 16, deuterium: 0 })).toBe(32);
    expect(resourceValue({ alloy: 0, crystal: 0, deuterium: 1 })).toBe(32);
    expect(resourceValue({ alloy: 100, crystal: 50, deuterium: 4 })).toBe(328);
    expect(resourceValue({ alloy: 0, crystal: 0, deuterium: 0 })).toBe(0);
  });

  it('uses the same value for new merchant occurrences and hull calibration', () => {
    expect(TRADE.rate).toEqual(RESOURCE_VALUE);
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.version).toBe(5);
    for (const give of [{ alloy: 32, crystal: 0, deuterium: 0 }, { alloy: 0, crystal: 16, deuterium: 0 }]) {
      expect(quoteTrade(give, { alloy: 0, crystal: 0, deuterium: 1 }, TRADE.rate))
        .toMatchObject({ refusal: null, leftoverUnits: 0, offerUnits: 32, askUnits: 32 });
    }
  });

  /**
   * THE TWO BASES ARE DIFFERENT QUANTITIES, AND THAT IS THE THING TO GUARD.
   *
   * This asserted `420` and `360` — the Dart's two valuations on the day it was written — so a
   * HULL rebalance turned it red while nothing about the valuation had moved. The two figures it
   * really exists to protect are the FORMULAS: Dominion counts a fleet at A+C+D, replacement effort
   * at A+2C+32D, and the raid ledger is built on the two never being confused for one another
   * (`raid-ledger.ts` exists because they were, in a P&L that subtracted one from the other).
   *
   * Stated as the relationship, it holds through any price change and still fails the moment
   * somebody reprices a resource or quietly points one of the two at the other.
   */
  it('keeps the Dominion base and the replacement base apart at every hull', () => {
    for (const hull of Object.values(HULLS)) {
      expect(resourceValue(hull)).toBe(hull.alloy + 2 * hull.crystal + 32 * hull.deuterium);
      expect(fleetValue({ [hull.id]: 1 })).toBe(hull.alloy + hull.crystal + hull.deuterium);
    }
    // And they are not the same number on anything that costs more than alloy.
    const mixed = Object.values(HULLS).filter((h) => h.crystal > 0 || h.deuterium > 0);
    expect(mixed.length).toBeGreaterThan(0);
    for (const hull of mixed) {
      expect(resourceValue(hull)).toBeGreaterThan(fleetValue({ [hull.id]: 1 }));
    }
  });

  it('retains the previous rate in historical random-calendar definitions', () => {
    for (const ruleset of [5, 6, 7]) {
      const definition = galaxyEventConfigForRuleset(ruleset).definitions.TRADE_SHIP;
      if (definition.schedule !== 'RANDOM_DAILY') throw new Error('Expected historical random calendar');
      expect(definition.effect.rate).toEqual({ alloy: 1, crystal: 2, deuterium: 9 });
    }
  });

  it('keeps historical merchant rates frozen rather than changing a live calendar', () => {
    const rate = { alloy: 1, crystal: 2, deuterium: 9 };
    const spec = tradeShipSpec({ sequence: 0, startsAtMinute: 60, endsAtMinute: 180, effect: { rate } }, () => 0.5);
    expect(spec.rate).toEqual(rate);
  });
});
