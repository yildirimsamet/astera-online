import { describe, expect, it } from 'vitest';
import {
  UNAIDED,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  PROBE,
  PROSPECTOR,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_TECH,
  SUPPORT_ROUND_TRIP,
  TRADE,
  TRAVEL,
  fleetCargo,
  fleetSpeed,
  fleetTravelExact,
  hullTech,
  researchEffectAt,
} from '../src/index.js';
import type { HullId } from '../src/index.js';

/** Base round trips at 1250 units include the ten-second engagement. No research or Beacon. */
describe('monthly fleet tempo', () => {
  /**
   * COMBAT ROLES ONLY. A cargo hull's round trip is a rung of `SUPPORT_ROUND_TRIP`
   * rather than a property of its class — it is bought with hold rather than with
   * a doctrine — and `the cargo ladder` below is where that contract is held.
   */
  it('gives each combat role its accepted unresearched round trip', () => {
    for (const id of MOBILE_HULLS) {
      const hull = HULLS[id];
      if (hull.cls === 'SUPPORT') continue;
      const expected = hull.cls === 'SKIRMISHER' ? 15 : hull.cls === 'LANCE' ? 20 : 25;
      expect(2 * fleetTravelExact(1250, { [id]: 1 }, UNAIDED) + 10 / 60).toBeCloseTo(expected, 9);
    }
  });

  it('gives each hold the round trip its rung authors', () => {
    const cargo = ['COURIER', 'WAYFARER', 'ATLAS'] as const;
    cargo.forEach((id, tier) => {
      expect(2 * fleetTravelExact(1250, { [id]: 1 }, UNAIDED) + 10 / 60)
        .toBeCloseTo(SUPPORT_ROUND_TRIP[tier]!, 9);
    });
  });
  it('keeps ground craft stationary and mining independent', () => {
    for (const id of GROUND_HULLS) expect(HULLS[id].speed).toBe(0);
    expect(HULLS.PROSPECTOR.speed).toBe(PROSPECTOR.speed);
    expect(PROSPECTOR.speed).toBe(825);
  });
});

describe('D152 Ship Propulsion ladder', () => {
  const ladder: readonly [number, number][] = [
    [0, 1], [1, 1.125], [2, 1.25], [3, 1.375], [4, 1.5],
  ];

  it('sells four rungs and nothing beyond them', () => {
    expect(RESEARCH_TECH.propulsionMaxLevel).toBe(4);
    expect(RESEARCH_MAX_LEVEL.SHIP_PROPULSION).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_PROPULSION.maxLevel).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_PROPULSION.prerequisite).toBe('DENSE_FUEL_CELLS');
  });

  it.each(ladder)('multiplies speed by the stated factor at rung %i', (level, factor) => {
    for (const id of MOBILE_HULLS) {
      expect(hullTech({ SHIP_PROPULSION: level }, id).speed, `${id} L${String(level)}`)
        .toBeCloseTo(factor, 12);
    }
  });

  it('doubles and then stops, however many levels are handed to it', () => {
    for (const beyond of [5, 6, 99]) {
      expect(hullTech({ SHIP_PROPULSION: beyond }, 'DART').speed).toBe(1.5);
      expect(researchEffectAt('SHIP_PROPULSION', beyond)).toBe(1.5);
    }
  });

  /** Speed is not a combat statistic: the product ceiling stays where D137 put it. */
  it('never touches attack, hull strength or a preserved craft', () => {
    for (const id of MOBILE_HULLS) {
      expect(hullTech({ SHIP_PROPULSION: 4 }, id)).toMatchObject({ atk: 1, hp: 1 });
    }
    for (const id of ['BASTION', 'THORN', 'PROSPECTOR'] as const satisfies readonly HullId[]) {
      expect(hullTech({ SHIP_PROPULSION: 4 }, id), id).toEqual({ atk: 1, hp: 1, speed: 1 });
    }
  });

  /** A fleet still flies at its slowest hull; the research lifts that hull. */
  it('halves the flight of a maxed fleet without erasing its composition', () => {
    const fleet = { DART: 3, CITADEL: 1 };
    expect(fleetSpeed(fleet, UNAIDED.tech)).toBe(HULLS.CITADEL.speed);
    expect(fleetSpeed(fleet, { SHIP_PROPULSION: 4 })).toBeCloseTo(HULLS.CITADEL.speed * 1.5, 12);
    expect(fleetTravelExact(600, fleet, { boost: 1, tech: { SHIP_PROPULSION: 4 } }))
      .toBeCloseTo(fleetTravelExact(600, fleet, UNAIDED) / 1.5, 12);
    expect(fleetSpeed(fleet, { SHIP_PROPULSION: 4 }))
      .toBeLessThan(fleetSpeed({ DART: 3 }, { SHIP_PROPULSION: 4 }));
  });

  /** Every rung is priced, and each one costs more than the one below it. */
  it('charges a rising price for all four rungs', () => {
    const value = (level: number) => {
      const cost = RESEARCH_PROJECTS.SHIP_PROPULSION.costAt(level);
      return cost.alloy + cost.crystal + cost.deuterium;
    };
    for (let level = 2; level <= 4; level++) {
      expect(value(level), `L${String(level)}`).toBeGreaterThan(value(level - 1));
    }
  });
});

/**
 * THE PROBE FLIES A QUARTER SLOWER. D153, owner instruction.
 *
 * IT IS THE OTHER HALF OF D152. The fleet took +25% and the probe was excluded, so
 * the gap between "how fast can I look" and "how fast can I hit" widened by a
 * quarter in the probe's favour — on top of the ×12 D121 had already given it. A
 * scout that arrives 15× faster than the fastest warship makes looking nearly free
 * in the one currency the intel layer is supposed to charge in: time. Cutting it a
 * quarter and lifting the fleet a quarter closes that from both ends at once.
 *
 * THE CEILING D121 SET IS UNTOUCHED, and it is a ceiling on flatness rather than on
 * speed. The failure it recorded was every probe in the galaxy landing in exactly two
 * minutes, at which point distance stopped meaning anything to a scout; with no fixed
 * launch term the gradient is exactly `GALAXY_SPAN / minSeparation` and no speed
 * anyone picks can move it. A slower probe is a probe that pays MORE for distance,
 * which is the direction that rule wants.
 *
 * AND IT IS STILL THE FASTEST THING IN THE GAME by a wide margin — a scout must
 * outrun anything that can be sent at you, or a warning is worth nothing — and the
 * hour that actually rations scouting (`retargetCooldownMinutes`) still outlasts the
 * widest round trip, which is the relationship that keeps two rules from disagreeing
 * about one control.
 */
describe('D153 probe speed', () => {
  it('flies at exactly three quarters of what it flew before', () => {
    expect(PROBE.speed).toBe(Math.round(4680 * 0.75));
    expect(PROBE.speed).toBe(3510);
  });

  it('still outruns every hull in the game, and the drill', () => {
    expect(PROBE.speed).toBeGreaterThan(PROSPECTOR.speed);
    for (const id of MOBILE_HULLS) {
      expect(PROBE.speed, `a ${HULLS[id].name} outruns a probe`)
        .toBeGreaterThan(HULLS[id].speed);
    }
  });

  /** The cut is on the probe alone. Nothing else in the model reads it. */
  it('moves nothing but the probe', () => {
    expect(PROSPECTOR.speed).toBe(825);
    expect(fleetTravelExact(1250, { DART: 1 }, UNAIDED)).toBeCloseTo((15 - 1 / 6) / 2);
  });
});

/**
 * THE HOLD IS PAID FOR IN SPEED. D148, restored at D186.
 *
 * The three cargo hulls are a ladder, not a set: a Courier carries 700 and gets
 * there, an Atlas carries 6,000 and takes its time. The economy cutover gave every
 * support hull the same round trip, which collapsed the ladder into one hull with
 * three prices — two Couriers arrived exactly when one Atlas did, so the small
 * hauler bought nothing and the choice stopped being a choice.
 *
 * `TRADE.speed` is anchored on the SLOWEST of them, so every hold still leads the
 * merchant; that is why the ladder and the merchant move together or not at all.
 */
describe('the cargo ladder', () => {
  const cargo = ['COURIER', 'WAYFARER', 'ATLAS'] as const;

  it('trades speed for hold, in that order', () => {
    for (let i = 1; i < cargo.length; i++) {
      expect(HULLS[cargo[i]!].cargo).toBeGreaterThan(HULLS[cargo[i - 1]!].cargo);
      expect(HULLS[cargo[i]!].speed).toBeLessThan(HULLS[cargo[i - 1]!].speed);
    }
  });

  /** The complaint the sim caught: two small holds must beat one big one to the target. */
  it('lets two Couriers reach a world before one Atlas does', () => {
    expect(fleetTravelExact(800, { COURIER: 2 }, UNAIDED))
      .toBeLessThan(fleetTravelExact(800, { ATLAS: 1 }, UNAIDED));
    expect(fleetCargo({ ATLAS: 1 }, {})).toBeGreaterThan(fleetCargo({ COURIER: 2 }, {}));
  });

  it('keeps every hold ahead of the merchant it is racing', () => {
    for (const id of cargo) {
      expect(HULLS[id].speed / TRAVEL.distanceFactor).toBeGreaterThan(TRADE.speed);
    }
  });
});
