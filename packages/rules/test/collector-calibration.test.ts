import { describe, expect, it } from 'vitest';
import {
  DEBRIS,
  HULLS,
  SALVAGE,
  hullBulk,
  hullFuelRate,
  missionFuel,
  resourceValue,
  salvageCapacity,
} from '../src/index.js';

/**
 * Collector calibration: September's salvage, price and bulk remain unchanged.
 * The owner reduced its card fuel rate from 90 to 20 on 2026-10-07; these
 * assertions account for the resulting flight charge without rebalancing salvage.
 */
describe('what a collector lifts, burns and occupies', () => {
  it('lifts half of what it used to', () => {
    expect(SALVAGE.perCollector).toBe(7_500);
    expect(salvageCapacity({ GARBAGE_COLLECTOR: 1 })).toBe(7_500);
    expect(salvageCapacity({ GARBAGE_COLLECTOR: 4 })).toBe(30_000);
  });

  /** The card quotes `fuelMass / 10`, which is how the owner states this figure. */
  it('quotes the owner-requested 20 deuterium on its card', () => {
    expect(hullFuelRate('GARBAGE_COLLECTOR')).toBe(20);
    expect(SALVAGE.fuelMass).toBe(200);
  });

  it('occupies forty of a hangar', () => {
    expect(hullBulk('GARBAGE_COLLECTOR')).toBe(40);
  });

  /** Nothing else moved: the hull's price is still the owner's hand-set one. */
  it('costs what it always cost', () => {
    expect(HULLS.GARBAGE_COLLECTOR.alloy).toBe(13_000);
    expect(HULLS.GARBAGE_COLLECTOR.crystal).toBe(6_500);
  });
});

describe('what taking a wreck now costs', () => {
  const TRIP_DISTANCE = 600;
  const price = resourceValue(HULLS.GARBAGE_COLLECTOR);
  const fuelPerTrip = missionFuel({ GARBAGE_COLLECTOR: 1 }, TRIP_DISTANCE, 2);

  it('accounts for the lower fuel bill separately from the hull price', () => {
    const net = SALVAGE.perCollector - fuelPerTrip * 32;
    expect(net).toBeGreaterThan(0);
    expect(fuelPerTrip).toBe(24);
    expect(net).toBe(6_732);
    expect(price).toBe(26_000);
  });

  /** A big wreck now needs a fleet of them, and that fleet needs somewhere to live. */
  it('makes lifting a large field a real commitment of hangar room', () => {
    const lostFleet = 600_000;
    const field = lostFleet * DEBRIS.share;
    const needed = Math.ceil(field / SALVAGE.perCollector);
    expect(needed).toBeGreaterThanOrEqual(24);
    expect(needed * hullBulk('GARBAGE_COLLECTOR')).toBeGreaterThan(900);
  });

  it('charges 24 collectors their lower fuel bill without changing salvage', () => {
    const needed = 24;
    const fuel = missionFuel({ GARBAGE_COLLECTOR: needed }, TRIP_DISTANCE, 2) * 32;
    const lifted = needed * SALVAGE.perCollector;
    expect(fuel).toBe(18_432);
    expect(lifted).toBe(180_000);
    expect(fuel).toBeLessThan(lifted);
  });
});
