import { describe, expect, it } from 'vitest';
import { UNAIDED, fleetPace, travelMinutes, type FlightModifiers } from '@astera/rules';
import { planRoute, reachMinutes } from '../src/lib/navigation.js';

const origin = { x: 0, y: 0, z: 0 };
const target = { x: 300, y: 0, z: 400 };
const at = (fleet: Parameters<typeof fleetPace>[0], mods: FlightModifiers = UNAIDED) => travelMinutes(500, fleetPace(fleet, mods));

describe('a target estimate before a fleet is selected', () => {
  it('uses the fastest warship for an attack, excluding a faster hauler and a slower escort', () => {
    expect(fleetPace({ COURIER: 1 }, UNAIDED)).toBeGreaterThan(fleetPace({ DART: 1 }, UNAIDED));
    expect(reachMinutes(origin, target, { DART: 4, RAMPART: 9, COURIER: 2 }, UNAIDED, 'combat')).toBe(at({ DART: 1 }));
  });
  it('includes the fastest hauler on a non-combat route', () => {
    expect(reachMinutes(origin, target, { DART: 4, RAMPART: 9, COURIER: 2 }, UNAIDED, 'transport')).toBe(at({ COURIER: 1 }));
  });
  it('has no attack estimate with only cargo or unarmed work craft', () => {
    expect(reachMinutes(origin, target, { COURIER: 2, GARBAGE_COLLECTOR: 1 }, UNAIDED, 'combat')).toBeNull();
  });
  it('still quotes a cargo-only transfer', () => {
    expect(reachMinutes(origin, target, { COURIER: 2 }, UNAIDED, 'transport')).toBe(at({ COURIER: 1 }));
  });
  it('ignores unavailable fast hulls and things that cannot join a fleet', () => {
    expect(reachMinutes(origin, target, { DART: 0, COURIER: 0, RAMPART: 2, BASTION: 99, PROSPECTOR: 99 }, UNAIDED, 'combat')).toBe(at({ RAMPART: 1 }));
    expect(reachMinutes(origin, target, { BASTION: 99, PROSPECTOR: 99 }, UNAIDED, 'transport')).toBeNull();
  });
  it('keeps propulsion, the origin Beacon and pace in the estimate', () => {
    const mods: FlightModifiers = { boost: 1.25, tech: { SHIP_PROPULSION: 4 }, pace: 0.5 };
    expect(reachMinutes(origin, target, { DART: 4, RAMPART: 9, COURIER: 2 }, mods, 'combat')).toBe(at({ DART: 1 }, mods));
  });
  it('keeps an actual mixed launch at its slowest selected hull', () => {
    const fleet = { DART: 4, RAMPART: 9, COURIER: 2 };
    const exact = planRoute(origin, target, fleet, fleet, {}, UNAIDED);
    expect(exact.oneWayMinutes).toBeGreaterThan(at({ DART: 1 }));
    expect(Math.ceil(exact.oneWayMinutes)).toBe(at({ RAMPART: 1 }));
  });
});
