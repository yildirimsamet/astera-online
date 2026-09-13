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
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.version).toBe(4);
    for (const give of [{ alloy: 32, crystal: 0, deuterium: 0 }, { alloy: 0, crystal: 16, deuterium: 0 }]) {
      expect(quoteTrade(give, { alloy: 0, crystal: 0, deuterium: 1 }, TRADE.rate))
        .toMatchObject({ refusal: null, leftoverUnits: 0, offerUnits: 32, askUnits: 32 });
    }
  });

  it('does not silently reprice the current Dominion fleet value', () => {
    expect(resourceValue(HULLS.DART)).toBe(420);
    expect(fleetValue({ DART: 1 })).toBe(360);
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
