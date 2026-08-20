import { describe, expect, it } from 'vitest';
import { HULLS, distance, exposureMinutes, fleetTravelMinutes } from '@astera/rules';
import { planRoute, reachMinutes } from '../src/lib/navigation.js';

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
    const sending = { WASP: 10 };
    const route = planRoute(HERE, THERE, sending, { WASP: 20 }, {});

    expect(route.distance).toBe(distance(HERE, THERE));
    expect(route.oneWayMinutes).toBe(fleetTravelMinutes(route.distance, sending));
    expect(route.exposureMinutes).toBe(exposureMinutes(route.oneWayMinutes));
  });

  it('counts what is left at home, including ground defence', () => {
    const route = planRoute(HERE, THERE, { WASP: 12 }, { WASP: 20, HAULER: 2 }, { BASTION: 3 });
    // 20 + 2 at home, 12 leave, 3 Bastions never leave.
    expect(route.homeDefenceAfter).toBe(13);
  });

  it('reports an undefended planet when everything is sent', () => {
    const route = planRoute(HERE, THERE, { WASP: 20 }, { WASP: 20 }, {});
    expect(route.homeDefenceAfter).toBe(0);
  });

  it('never reports negative defence if the fleet drifts under it', () => {
    const route = planRoute(HERE, THERE, { WASP: 40 }, { WASP: 20 }, {});
    expect(route.homeDefenceAfter).toBe(0);
  });

  /**
   * A fleet travels at the speed of its slowest ship, so composition is a *time*
   * decision. The preview has to show that, or Bulwarks look free.
   */
  it('slows the whole fleet to its slowest hull', () => {
    const fast = planRoute(HERE, THERE, { WASP: 10 }, { WASP: 10, BULWARK: 1 }, {});
    const heavy = planRoute(HERE, THERE, { WASP: 10, BULWARK: 1 }, { WASP: 10, BULWARK: 1 }, {});

    expect(heavy.oneWayMinutes).toBeGreaterThan(fast.oneWayMinutes);
    expect(heavy.exposureMinutes).toBe(heavy.oneWayMinutes * 2);
  });

  it('adds the cargo the Haulers bring, and nothing for the rest', () => {
    const combat = planRoute(HERE, THERE, { WASP: 10 }, { WASP: 10, HAULER: 2 }, {});
    const withCargo = planRoute(HERE, THERE, { WASP: 10, HAULER: 2 }, { WASP: 10, HAULER: 2 }, {});

    expect(withCargo.cargo - combat.cargo).toBe(2 * HULLS.HAULER.cargo);
  });

  it('reports no exposure at all when nothing has been chosen yet', () => {
    const route = planRoute(HERE, THERE, {}, { WASP: 20 }, {});
    expect(route.oneWayMinutes).toBe(0);
    expect(route.exposureMinutes).toBe(0);
    expect(route.homeDefenceAfter).toBe(20);
  });

  it('has no reach at all with an empty hangar', () => {
    expect(reachMinutes(HERE, THERE, {})).toBeNull();
    expect(reachMinutes(HERE, THERE, { BASTION: 5 })).toBeNull();
  });
});
