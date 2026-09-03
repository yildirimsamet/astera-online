import { describe, expect, it } from 'vitest';
import {
  HULLS,
  distance,
  exposureMinutes,
  fleetCargo,
  fleetTravelExact,
  missionFuel,
} from '@astera/rules';
import { planPirateRoute, planRoute, reachMinutes } from '../src/lib/navigation.js';

/**
 * The number the whole decision rests on.
 *
 * "Home defence after launch: 4 units. Exposed for 28 minutes." The server
 * recomputes both inside the transaction, but the player commits against THIS
 * figure — so it has to be derived from the same rules, not approximated. A
 * preview that is optimistic by even a few minutes is a preview that lies about
 * risk.
 */
const HERE = { x: 0, y: 0, z: 0 };
const THERE = { x: 300, y: 0, z: 400 }; // 500 units away

describe('the launch preview', () => {
  it('agrees with the rules the server will use', () => {
    const sending = { DART: 10 };
    const route = planRoute(HERE, THERE, sending, { DART: 20 }, {}, {});

    expect(route.distance).toBe(distance(HERE, THERE));
    expect(route.oneWayMinutes).toBe(fleetTravelExact(route.distance, sending));
    expect(route.exposureMinutes).toBe(exposureMinutes(route.oneWayMinutes));
  });

  it('counts what is left at home, including ground defence', () => {
    const route = planRoute(HERE, THERE, { DART: 12 }, { DART: 20, COURIER: 2 }, { BASTION: 3 }, {});
    // 20 + 2 at home, 12 leave, 3 Bastions never leave.
    expect(route.homeDefenceAfter).toBe(13);
  });

  it('reports an undefended planet when everything is sent', () => {
    const route = planRoute(HERE, THERE, { DART: 20 }, { DART: 20 }, {}, {});
    expect(route.homeDefenceAfter).toBe(0);
  });

  it('never reports negative defence if the fleet drifts under it', () => {
    const route = planRoute(HERE, THERE, { DART: 40 }, { DART: 20 }, {}, {});
    expect(route.homeDefenceAfter).toBe(0);
  });

  /**
   * A fleet travels at the speed of its slowest ship, so composition is a *time*
   * decision. The preview has to show that, or Bulwarks look free.
   */
  it('slows the whole fleet to its slowest hull', () => {
    const fast = planRoute(HERE, THERE, { DART: 10 }, { DART: 10, RAMPART: 1 }, {}, {});
    const heavy = planRoute(HERE, THERE, { DART: 10, RAMPART: 1 }, { DART: 10, RAMPART: 1 }, {}, {});

    expect(heavy.oneWayMinutes).toBeGreaterThan(fast.oneWayMinutes);
    expect(heavy.exposureMinutes).toBe(heavy.oneWayMinutes * 2);
  });

  it('adds combat-hull cargo and the larger dedicated Courier capacity', () => {
    const combat = planRoute(HERE, THERE, { DART: 10 }, { DART: 10, COURIER: 2 }, {}, {});
    const withCargo = planRoute(HERE, THERE, { DART: 10, COURIER: 2 }, { DART: 10, COURIER: 2 }, {}, {});

    expect(withCargo.cargo - combat.cargo).toBe(2 * HULLS.COURIER.cargo);
    expect(combat.cargo).toBe(10 * HULLS.DART.cargo);
  });

  it('reports no exposure at all when nothing has been chosen yet', () => {
    const route = planRoute(HERE, THERE, {}, { DART: 20 }, {}, {});
    expect(route.oneWayMinutes).toBe(0);
    expect(route.exposureMinutes).toBe(0);
    expect(route.homeDefenceAfter).toBe(20);
  });

  it('has no reach at all with an empty hangar', () => {
    expect(reachMinutes(HERE, THERE, {})).toBeNull();
    expect(reachMinutes(HERE, THERE, { BASTION: 5 })).toBeNull();
  });
});

/**
 * THE SAME PREVIEW, AGAINST SOMETHING THAT MOVES. D150.
 *
 * A world sits still, so the client can solve its own leg: distance over fleet
 * speed, and the trip home is the same again. A pirate is on a closed orbit and
 * the outbound leg is a RENDEZVOUS — a numerical solve against a moving target,
 * which is exactly the sort of thing two implementations get subtly different.
 * `/api/pirates` therefore solves it once, per hull standing at the world, and the
 * preview reads the answer rather than computing one.
 *
 * WHICH MAKES THE TWO LEGS ASYMMETRIC, and that is the whole reason this cannot
 * reuse `exposureMinutes`. Flying out is a chase and may include waiting for the
 * orbit to come round; flying back is a straight line from the meeting point. A
 * preview that doubled the outbound would overstate a long chase and understate a
 * short one, on the surface where a fleet stops being recallable.
 */
describe('the launch preview for something on an orbit', () => {
  const reach = [
    { hull: 'DART' as const, minutes: 12, distance: 900 },
    { hull: 'RAMPART' as const, minutes: 31, distance: 1400 },
  ];

  it('quotes the server\'s own solve for the slowest ship selected', () => {
    // A Rampart is slower than a Dart, so the whole wing flies at its rendezvous.
    const route = planPirateRoute(reach, { DART: 10, RAMPART: 1 }, { DART: 20, RAMPART: 1 }, {}, {});
    expect(route?.oneWayMinutes).toBe(31);
    expect(route?.distance).toBe(1400);

    // Leave the Rampart behind and the fleet catches the earlier rendezvous.
    const faster = planPirateRoute(reach, { DART: 10 }, { DART: 20, RAMPART: 1 }, {}, {});
    expect(faster?.oneWayMinutes).toBe(12);
    expect(faster?.distance).toBe(900);
  });

  it('adds a real return leg rather than doubling the chase', () => {
    const sending = { DART: 10 };
    const route = planPirateRoute(reach, sending, { DART: 20 }, {}, {});
    const home = fleetTravelExact(900, sending);
    expect(route?.exposureMinutes).toBeCloseTo(12 + home, 6);
    // And that is emphatically not the world sheet's answer.
    expect(route?.exposureMinutes).not.toBeCloseTo(exposureMinutes(12), 6);
  });

  /**
   * A HULL WITH NO ROW CANNOT GET THERE, and saying so is the point.
   *
   * `/api/pirates` leaves an unreachable speed OUT of the table entirely, so an
   * absent row is the same refusal `launchPirateRaid` will make — `CANNOT_INTERCEPT`.
   * Answering with a route anyway is how a panel quotes an ETA and enables Send for
   * a launch the server then rejects outright.
   */
  it('refuses when the slowest ship selected cannot make the rendezvous', () => {
    expect(planPirateRoute(reach, { CITADEL: 1 }, { CITADEL: 1 }, {}, {})).toBeNull();
    // Nothing selected is not a refusal, it is simply nothing to quote yet.
    expect(planPirateRoute(reach, {}, { DART: 20 }, {}, {})).toBeNull();
  });

  it('charges fuel over the leg the server solved, both ways', () => {
    const sending = { DART: 10 };
    const route = planPirateRoute(reach, sending, { DART: 20 }, {}, {});
    expect(route?.fuel).toBe(missionFuel(sending, 900, 2));
  });

  it('counts the garrison exactly as a raid on a world does', () => {
    const route = planPirateRoute(
      reach, { DART: 12 }, { DART: 20, COURIER: 2 }, { BASTION: 3 }, {},
    );
    expect(route?.homeDefenceAfter).toBe(13);
    expect(route?.cargo).toBe(fleetCargo({ DART: 12 }, {}));
  });
});
