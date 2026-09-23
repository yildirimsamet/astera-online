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
 * THE GARBAGE COLLECTOR, RECALIBRATED. Owner decision, 2026-09-22, closing C1b.
 *
 * *"Hurdacı: 15k hurda taşıma kapasitesi → 7.5k'ya düşecek. Hangarda kapladığı alan: 40'a
 * çıkacak"* — and the thirst, revised in the same exchange, *"Yakıtı 100 döt yap"*.
 *
 * WHAT IT REPLACES. The chat logs' complaint was that an attacker takes the whole wreck — *"eşit
 * güçteysek bile adam kafa atıp geçiyor, hurdacı ile toplayıp geçiyor"* — and the owner closed the
 * obvious fix (giving each side its own wreck) on 2026-09-21: *"Hurdacıyı düzenleriz kalibre
 * ederiz."* This is that calibration. The wreck stays public and stays the attacker's to take; what
 * changes is what taking it costs.
 *
 * MEASURED BEFORE: one collector cost 26,000 AE, lifted 15,000 a trip and burned 1,920 AE of fuel,
 * so it repaid itself in TWO trips and then ran free for ever. Halving the lift, doubling the
 * thirst and near-tripling the room it occupies turns a fleet of them into a real commitment of
 * hangar space, ore and deuterium — which is the decision the mechanic never had.
 */
describe('what a collector lifts, burns and occupies', () => {
  it('lifts half of what it used to', () => {
    expect(SALVAGE.perCollector).toBe(7_500);
    expect(salvageCapacity({ GARBAGE_COLLECTOR: 1 })).toBe(7_500);
    expect(salvageCapacity({ GARBAGE_COLLECTOR: 4 })).toBe(30_000);
  });

  /** The card quotes `fuelMass / 10`, which is how the owner states this figure. */
  it('quotes 100 deuterium on its card, double what it used to', () => {
    expect(hullFuelRate('GARBAGE_COLLECTOR')).toBe(100);
    expect(SALVAGE.fuelMass).toBe(1_000);
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

/**
 * THE POINT OF THE CALIBRATION, AS ARITHMETIC.
 *
 * A collector used to pay for itself in two trips. It is now a hull a commander has to WANT: room
 * in the hangar that a warship would otherwise take, deuterium every time it flies, and enough
 * trips that the decision to build one is a decision.
 */
describe('what taking a wreck now costs', () => {
  const TRIP_DISTANCE = 600;
  const price = resourceValue(HULLS.GARBAGE_COLLECTOR);
  const fuelPerTrip = missionFuel({ GARBAGE_COLLECTOR: 1 }, TRIP_DISTANCE, 2);

  it('takes several trips to pay for a collector, not two', () => {
    const net = SALVAGE.perCollector - fuelPerTrip * 32;
    expect(net).toBeGreaterThan(0);
    expect(price / net).toBeGreaterThan(4);
  });

  /** A big wreck now needs a fleet of them, and that fleet needs somewhere to live. */
  it('makes lifting a large field a real commitment of hangar room', () => {
    const lostFleet = 600_000;
    const field = lostFleet * DEBRIS.share;
    const needed = Math.ceil(field / SALVAGE.perCollector);
    expect(needed).toBeGreaterThanOrEqual(24);
    expect(needed * hullBulk('GARBAGE_COLLECTOR')).toBeGreaterThan(900);
  });

  /**
   * AND THE FUEL FOR THAT FLEET IS NO LONGER A ROUNDING ERROR — it is half of what the wreck is
   * worth. Twenty-four collectors lifting a 180,000 field burn 92,160 alloy-equivalent doing it.
   */
  it('charges a fleet of collectors a fuel bill worth half the wreck', () => {
    const needed = 24;
    const fuel = missionFuel({ GARBAGE_COLLECTOR: needed }, TRIP_DISTANCE, 2) * 32;
    const lifted = needed * SALVAGE.perCollector;
    expect(fuel).toBeGreaterThan(lifted * 0.4);
    expect(fuel).toBeLessThan(lifted);
  });
});
