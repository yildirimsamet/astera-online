import { describe, expect, it } from 'vitest';
import {
  HULLS, PIRATE, PROSPECTOR, TRAVEL, distance, interceptOrbit, orbitPosition, travelExact,
  type OrbitElements,
} from '../src/index.js';

describe('earliest orbital rendezvous', () => {
  it.each([
    { name: 'pirate', radius: 1550, targetSpeed: PIRATE.speedMax, speed: HULLS.CITADEL.speed, passAt: 0.1, offset: 1 },
    { name: 'asteroid', radius: 1000, targetSpeed: 750, speed: PROSPECTOR.speed, passAt: 0.005, offset: 0.1 },
  ])('keeps the brief first $name pass between scan samples', ({ radius, targetSpeed, speed, passAt, offset }) => {
    const period = 2 * Math.PI * radius / targetSpeed;
    const orbit: OrbitElements = {
      radius, period, speed: targetSpeed, phase: -2 * Math.PI * passAt / period, inclination: 0, ascendingNode: 0,
    };
    const from = { x: radius + offset, y: 0, z: 0 };
    const position = (t: number) => orbitPosition(orbit, t);
    const residual = (t: number) => travelExact(distance(from, position(t)), speed) - t;
    // Both old samples say unreachable, but the intervening pass IS reachable.
    expect(residual(0)).toBeGreaterThan(0);
    expect(residual(passAt)).toBeLessThan(0);
    expect(residual(0.2)).toBeGreaterThan(0);
    let lo = 0;
    let hi = passAt;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (residual(mid) > 0) lo = mid;
      else hi = mid;
    }
    for (const expiresAt of [120, passAt]) {
      const hit = interceptOrbit(from, speed, orbit, expiresAt, 0);
      expect(hit).not.toBeNull();
      expect(hit!.flightMinutes).toBeCloseTo(hi, 9);
      expect(Math.abs(residual(hit!.flightMinutes))).toBeLessThan(1e-8);
    }
  });

  it('meets an already coincident target immediately', () => {
    const orbit = { radius: 1000, period: 60, speed: 1000 * Math.PI / 30, phase: 0, inclination: 0.3, ascendingNode: 1 };
    const now = 1234;
    const position = (t: number) => orbitPosition(orbit, t);
    expect(interceptOrbit(position(now), 56, orbit, now + 60, now)?.flightMinutes).toBe(0);
  });

  it.each([0.03, 0.1, 0.7, 1, 2])('finds a tangential meeting at %s minutes without a sign change', (at) => {
    const orbit = { radius: 1000, period: 20 * Math.PI, speed: 100, phase: -0.1 * at, inclination: 0, ascendingNode: 0 };
    const from = { x: 1000 - Math.sqrt(1875) * at, y: 0, z: -25 * at };
    // At t=at, distance=50*at and radial target speed=50: the reachable sphere
    // just touches the orbit, then loses contact again before a later crossing.
    const speed = 50 * TRAVEL.distanceFactor;
    const residual = (t: number) => travelExact(distance(from, orbitPosition(orbit, t)), speed) - t;
    expect(residual(at * 0.99)).toBeGreaterThan(0);
    expect(residual(at * 1.01)).toBeGreaterThan(0);
    expect(interceptOrbit(from, speed, orbit, at * 2, 0)?.flightMinutes).toBeCloseTo(at, 7);
    expect(interceptOrbit({ ...from, x: from.x - 0.001 }, speed, orbit, at * 2, 0)).toBeNull();
  });

  it.each([0.0001, 0.005, 0.05, 0.099, 0.3, 1.7])('finds a tilted close pass %s minutes after a late-season launch', (passAt) => {
    const now = 40000;
    const period = 2 * Math.PI * 1550 / PIRATE.speedMax;
    const orbit = {
      radius: 1550, period, speed: PIRATE.speedMax, phase: -2 * Math.PI * (now + passAt) / period,
      inclination: 0.8, ascendingNode: 1.2,
    };
    const closest = orbitPosition(orbit, now + passAt);
    const scale = 1 + passAt / orbit.radius;
    const from = { x: closest.x * scale, y: closest.y * scale, z: closest.z * scale };
    const residual = (t: number) => travelExact(distance(from, orbitPosition(orbit, now + t)), HULLS.CITADEL.speed) - t;
    let lo = 0;
    let hi = passAt;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (residual(mid) > 0) lo = mid;
      else hi = mid;
    }
    const hit = interceptOrbit(from, HULLS.CITADEL.speed, orbit, now + 120, now);
    expect(hit).not.toBeNull();
    expect(hit!.flightMinutes).toBeCloseTo(hi, 8);
    expect(Math.abs(residual(hit!.flightMinutes))).toBeLessThan(1e-7);
  });

  it('excludes expiry itself but includes a meeting just before it', () => {
    const orbit = { radius: 1000, period: 60, speed: 1000 * Math.PI / 30, phase: 0, inclination: 0.3, ascendingNode: 1 };
    const speed = 1000 * TRAVEL.distanceFactor / 10;
    const from = { x: 0, y: 0, z: 0 };
    expect(interceptOrbit(from, speed, orbit, 10, 0)).toBeNull();
    expect(interceptOrbit(from, speed, orbit, 10.000001, 0)?.flightMinutes).toBeCloseTo(10, 9);
  });
});
