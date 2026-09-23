import { describe, expect, it } from 'vitest';
import {
  HANGAR,
  HULLS,
  alloyRate,
  buildingCost,
  hangarCapacity,
  hangarCeiling,
  hullBulk,
  storageCap,
} from '../src/index.js';

/**
 * THE HANGAR NO LONGER ASKS THE COMMAND CORE FOR PERMISSION. Owner decision, 2026-09-22.
 *
 * *"Komuta merkezini level atlamadan istedigim gibi hangar'ı level atlatabileyim. Yani tier
 * atlamadan bir kullanıcı filocu olabilmeli."*
 *
 * THE GATE WAS ADDED FOR A REAL REASON (2026-09-18): commanders held the Core low to stay inside
 * the beginners' tier band and printed an unbounded fleet there. The owner's answer is that the
 * economy already closes that door, and the measurement agrees — a Core-4 world produces 531 alloy
 * an hour, so climbing the ladder AND filling it costs **231 days** of production in a thirty-day
 * season, and its store tops out at 8,355 against a late rung's 71,760. It cannot hold one rung's
 * price, let alone buy nine and a fleet.
 *
 * So the gate was charging a second time for something production had already refused. What is
 * left is one bound — the ore — instead of two.
 */
describe('a Hangar rung asks nothing of the Command Core', () => {
  it('opens every rung at every Core', () => {
    for (const core of [1, 2, 4, 7, 10, 13, 16, 20]) {
      expect(hangarCeiling(core), `core ${String(core)}`).toBe(HANGAR.maxLevel);
    }
  });

  it('keeps the room each rung buys exactly as it was', () => {
    expect(HANGAR.capacity).toEqual([80, 80, 180, 470, 810, 1550, 2290, 3250, 4400, 5740, 7270]);
    for (let rung = 0; rung <= HANGAR.maxLevel; rung++) {
      expect(hangarCapacity(rung), `rung ${String(rung)}`).toBe(HANGAR.capacity[rung]);
    }
  });

  /**
   * THE MEASUREMENT THE DECISION RESTS ON, HELD HERE SO IT CANNOT QUIETLY STOP BEING TRUE.
   *
   * A commander who refuses to raise the Core cannot raise the Refinery either — no building may
   * exceed the Core — so the ore that pays for a tall Hangar is the same ore the Core gates. If a
   * producer retune ever makes a low Core rich enough to climb this ladder inside a season, the
   * exploit the old gate closed comes back and this test is where that shows up.
   */
  it('leaves a low Core unable to afford the ladder it may now climb', () => {
    const LOW_CORE = 4;
    const SEASON_DAYS = 30;
    let alloy = 0;
    for (let rung = 2; rung <= HANGAR.maxLevel; rung++) alloy += buildingCost('HANGAR', rung - 1).alloy;
    const days = alloy / alloyRate(LOW_CORE) / 24;
    expect(days).toBeGreaterThan(SEASON_DAYS * 2);
  });

  it('leaves a low Core unable to hold even one late rung at once', () => {
    const LOW_CORE = 4;
    expect(storageCap(alloyRate(LOW_CORE), 0))
      .toBeLessThan(buildingCost('HANGAR', HANGAR.seedTop - 1).alloy);
  });

  /** And filling the room it opens is further out of reach still. */
  it('leaves a low Core unable to fill the room either', () => {
    const LOW_CORE = 4;
    // A Core-4 world may raise the Shipyard no higher than 4, which is the tier-3 gate.
    const hull = 'BALLISTA';
    expect(HULLS[hull].minShipyard).toBeLessThanOrEqual(LOW_CORE);
    const fleet = Math.floor(HANGAR.capacity[HANGAR.maxLevel] / hullBulk(hull));
    const days = (fleet * HULLS[hull].alloy) / alloyRate(LOW_CORE) / 24;
    expect(days).toBeGreaterThan(100);
  });
});
