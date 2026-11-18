import { describe, expect, it } from 'vitest';
import { STARTER, distance, firstRockMeeting, firstTripMinutes, interceptOrbit, orbitPosition, starterAsteroidOrbit } from '../src/index.js';

/**
 * THE GUIDED ROAD'S FIRST FLIGHTS ARE WATCHED, NOT WAITED FOR (owner phone playtest 2026-11-19): the first
 * Prospector came home in the middle of the probe, and the first probe's report in the middle of the yard.
 * The road now waits for each, so neither keeps the player longer than fifteen to twenty seconds.
 */
describe('the first flights', () => {
  it('keep the player at most twenty seconds each', () => {
    expect(STARTER.firstTrips.mineOut + STARTER.firstTrips.mineBack).toBeLessThanOrEqual(20);
    expect(STARTER.firstTrips.probe).toBeLessThanOrEqual(20);
  });

  it('cut a long flight to its cap and leave a short one alone', () => {
    expect(firstTripMinutes(1.5, 12)).toBeCloseTo(0.2, 9);
    expect(firstTripMinutes(0.1, 12)).toBe(0.1);
  });

  it('meet the first rock where it is when the cap runs out, and a near one where it would have been met', () => {
    const orbit = starterAsteroidOrbit(0xabcdef12);
    const now = 600;
    const far = { x: orbit.radius + 400, y: 0, z: 0 };
    const hit = interceptOrbit(far, STARTER.prospectorSpeed, orbit, now + 10_000, now);
    if (!hit) throw new Error('the rock cannot be met');
    expect(hit.flightMinutes * 60).toBeGreaterThan(STARTER.firstTrips.mineOut);
    const met = firstRockMeeting(hit, orbit, now);
    expect(met.flightMinutes * 60).toBeCloseTo(STARTER.firstTrips.mineOut, 9);
    expect(met.meetsAtMinutes).toBeCloseTo(now + STARTER.firstTrips.mineOut / 60, 9);
    expect(distance(met.at, orbitPosition(orbit, met.meetsAtMinutes))).toBeLessThan(1e-9);
    const near = { flightMinutes: 0.05, meetsAtMinutes: now + 0.05, at: orbitPosition(orbit, now + 0.05) };
    expect(firstRockMeeting(near, orbit, now)).toBe(near);
  });
});
