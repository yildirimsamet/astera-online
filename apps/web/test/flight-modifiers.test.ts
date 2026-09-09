import { describe, expect, it } from 'vitest';
import {
  RESEARCH_TECH,
  SATELLITES,
  UNAIDED,
  distance,
  fleetSpeedMult,
  fleetTravelExact,
} from '@astera/rules';
import {
  flightModifiers,
  planPirateRoute,
  planRoute,
  reachMinutes,
} from '../src/lib/navigation.js';

/**
 * THE PREVIEW HAS TO QUOTE THE FLIGHT THE SERVER WILL ACTUALLY FLY. D180.
 *
 * A fleet's pace is its slowest hull times two things the hull knows nothing
 * about: the commander's `SHIP_PROPULSION` ladder and the BEACON standing over the
 * world it launches from. The server has always applied both. The client applied
 * NEITHER on four surfaces, because `fleetTravelExact(dist, fleet, boost = 1,
 * tech = {})` handed a plausible wrong number to anybody who forgot the last two
 * arguments — and four callers did.
 *
 * WHAT IT COST: propulsion is four rungs of +25% to a ×2 ceiling, so a commander at
 * the top of the ladder was quoted DOUBLE the real flight time, plus whatever the
 * Beacon adds. That is not a cosmetic slip. `FocusPanel`'s `settlementCanArrive`
 * decides whether the sheet says a claim is reachable at all, so the preview was
 * telling commanders they could not make a window they could comfortably make.
 *
 * THE FIX IS THE SIGNATURE, NOT THESE CALL SITES. `FlightModifiers` is one
 * REQUIRED argument carrying both, so a new caller cannot compile without deciding
 * what it means — and `UNAIDED` is how a flight that belongs to no commander says
 * so out loud. These tests hold the behaviour; the type holds the next author.
 */
const HERE = { x: 0, y: 0, z: 0 };
const THERE = { x: 300, y: 0, z: 400 }; // 500 units away
const SENDING = { DART: 10 } as const;
const HOME = { DART: 20 } as const;

const TOP = RESEARCH_TECH.propulsionMaxLevel;
const fast = { boost: 1, tech: { SHIP_PROPULSION: TOP } } as const;
const beaconed = { boost: fleetSpeedMult(['BEACON']), tech: {} } as const;

describe('what a world lends every fleet that leaves it', () => {
  it('reads the ladder and the Beacon off one planet payload', () => {
    expect(flightModifiers({
      research: [{ id: 'SHIP_PROPULSION', level: 2 }],
      orbit: ['BEACON'],
    })).toEqual({ boost: SATELLITES.BEACON.speed, tech: { SHIP_PROPULSION: 2 } });
  });

  it('lends nothing when there is nothing to lend', () => {
    expect(flightModifiers({ research: [], orbit: [] })).toEqual(UNAIDED);
  });
});

describe('the launch preview and propulsion research', () => {
  it('quotes exactly what the server will compute', () => {
    const route = planRoute(HERE, THERE, SENDING, HOME, {}, fast);
    expect(route.oneWayMinutes)
      .toBe(fleetTravelExact(distance(HERE, THERE), SENDING, fast));
  });

  /**
   * THE CEILING IS THE ASSERTION. Four rungs of +25% is a doubling, so the top of
   * the ladder halves the flight — which is exactly the size of the error the old
   * preview showed.
   */
  it('halves the quoted flight at the top of the ladder', () => {
    const plain = planRoute(HERE, THERE, SENDING, HOME, {}, UNAIDED);
    const quick = planRoute(HERE, THERE, SENDING, HOME, {}, fast);
    expect(quick.oneWayMinutes).toBeCloseTo(plain.oneWayMinutes / 2, 6);
    // ...and exposure is the doubled leg, so the error compounded there too.
    expect(quick.exposureMinutes).toBeCloseTo(quick.oneWayMinutes * 2, 6);
  });

  it('flies faster out of a world with a Beacon over it', () => {
    const plain = planRoute(HERE, THERE, SENDING, HOME, {}, UNAIDED);
    const lifted = planRoute(HERE, THERE, SENDING, HOME, {}, beaconed);
    expect(lifted.oneWayMinutes)
      .toBeCloseTo(plain.oneWayMinutes / SATELLITES.BEACON.speed, 6);
  });

  it('stacks the ladder and the Beacon the way the server does', () => {
    const both = { boost: fleetSpeedMult(['BEACON']), tech: { SHIP_PROPULSION: TOP } };
    expect(planRoute(HERE, THERE, SENDING, HOME, {}, both).oneWayMinutes)
      .toBe(fleetTravelExact(distance(HERE, THERE), SENDING, both));
  });
});

describe('every other surface that quotes a flight', () => {
  /**
   * "How far away is this world for me right now" is a decision, not a label — it
   * is what the focus panel answers before a commander opens a launch sheet at all.
   */
  it('measures reach at the commander’s real pace', () => {
    expect(reachMinutes(HERE, THERE, HOME, fast))
      .toBeLessThan(reachMinutes(HERE, THERE, HOME, UNAIDED)!);
  });

  it('still refuses a reach with nothing that can fly', () => {
    expect(reachMinutes(HERE, THERE, { BASTION: 3 }, fast)).toBeNull();
  });

  /**
   * A PIRATE'S OUTBOUND LEG COMES FROM THE SERVER; the way home does not. The
   * return was computed here with no modifiers at all, so the exposure figure — the
   * whole bet, on the one lane that cannot be recalled — was inflated.
   */
  it('brings a pirate raid home at the commander’s real pace', () => {
    const reach = [
      { hull: 'DART' as const, minutes: 30, distance: distance(HERE, THERE), at: THERE },
    ];
    const quick = planPirateRoute(reach, SENDING, HOME, {}, fast);
    const plain = planPirateRoute(reach, SENDING, HOME, {}, UNAIDED);
    expect(quick!.exposureMinutes).toBeLessThan(plain!.exposureMinutes);
    // The outbound half is the server's answer and must not move.
    expect(quick!.oneWayMinutes).toBe(plain!.oneWayMinutes);
  });
});
