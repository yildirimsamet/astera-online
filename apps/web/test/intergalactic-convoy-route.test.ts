import { describe, expect, it } from 'vitest';
import { distance, fleetPace, TRAVEL } from '@astera/rules';
import { planIntergalacticConvoyRoute, planRoute, flightModifiers } from '../src/lib/navigation.js';
import { convoyOpportunity, type IntergalacticConvoyEvent } from '../src/lib/intergalacticConvoy.js';
import { planetView } from './fixtures.js';

const start = new Date('2026-11-04T00:00:00Z');
const event: IntergalacticConvoyEvent = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11', kind: 'INTERGALACTIC_CONVOY',
  startsAt: start, endsAt: new Date(start.getTime() + 180 * 60000),
  appearsAtMinute: 0, expiresAtMinute: 180,
  route: { from: { x: -4500, y: 0, z: 0 }, to: { x: 4500, y: 0, z: 0 },
    velocity: { x: 50, y: 0, z: 0 }, speed: 50 },
  visual: { formationVersion: 1 },
  rewardPolicy: { resourceCapHours: 4, fullRewardForceRatio: 1, shipDropFullFirepower: 5780,
    shipDropChanceAtFullQuality: 0.15, maxAwardedShips: 3 },
};

describe('the exact convoy quote and ordinary travel', () => {
  it('quotes doubled outbound and ordinary return even after convoy departure', () => {
    const origin = { x: -3000, y: 0, z: 0 };
    const fleet = { PIKE: 2 };
    const mods = { boost: 1, tech: {} };
    const route = planIntergalacticConvoyRoute(origin, event, 90, fleet, fleet, {}, mods);
    expect(route).not.toBeNull();
    expect(route!.oneWayMinutes).toBeCloseTo(34.82926829268292, 9);
    expect(route!.returnMinutes).toBeCloseTo(69.71975057713539, 9);
    expect(route!.homeAtMinute).toBeGreaterThan(event.expiresAtMinute);
    const standard = planRoute(origin, route!.engagementEnd, fleet, fleet, {}, mods);
    expect(standard.oneWayMinutes).toBeCloseTo(route!.returnMinutes, 9);
    expect(standard.oneWayMinutes).toBeCloseTo(distance(origin, route!.engagementEnd)
      / (fleetPace(fleet, mods) / TRAVEL.distanceFactor), 9);
  });
});

describe('the convoy discovery decision', () => {
  it('uses actual time inside the event opening minute', () => {
    const opening = { ...event, startsAt: new Date(start.getTime() + 15000),
      endsAt: new Date(start.getTime() + 180.25 * 60000), appearsAtMinute: 0.25, expiresAtMinute: 180.25 };
    const home = planetView({ fleet: { DART: 1 }, research: [], orbit: [], effectiveOrbit: [] },
      { position: { x: -3000, y: 0, z: 0 } });
    const quote = convoyOpportunity(opening, home, start, start.getTime() + 30000);
    expect(quote.hasCombatCraft).toBe(true);
    expect(quote.reachMinutes).not.toBeNull();
  });

  it('does not promise the reach of a faster ship at 5% HP', () => {
    const home = planetView({ fleet: { DART: 1, RAMPART: 1 },
      fleetDamage: [{ hull: 'DART', count: 1, damageBp: 9500 }],
      fleetCombatReady: undefined, research: [], orbit: [], effectiveOrbit: [] },
      { position: { x: 0, y: 0, z: 0 } });
    const quote = convoyOpportunity(event, home, start, start.getTime() + 150 * 60000);
    expect(quote).toEqual({ hasCombatCraft: true, reachMinutes: null });
    expect(planIntergalacticConvoyRoute(home.planet.position, event, 150, { DART: 1 }, home.fleet,
      home.ground, flightModifiers(home))).not.toBeNull();
  });

  it('uses the authoritative combat-ready fleet and distinguishes no armed ships', () => {
    const home = planetView({ fleet: { DART: 1, COURIER: 2 }, fleetCombatReady: { COURIER: 2 } });
    expect(convoyOpportunity(event, home, start, start.getTime() + 90 * 60000))
      .toEqual({ hasCombatCraft: false, reachMinutes: null });
    expect(convoyOpportunity(null, undefined, undefined, start.getTime()))
      .toEqual({ hasCombatCraft: false, reachMinutes: null });
  });
});
