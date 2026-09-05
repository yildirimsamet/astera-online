import { describe, expect, it } from 'vitest';
import {
  orbitDiscoveredAt,
  asteroidOrbitRadius,
  asteroidPosition,
  firstOrbitSensorContact,
  nextAsteroidDiscoveryAt,
  type AsteroidSpec,
  type SensorEpoch,
} from '../src/index.js';

const TAU = Math.PI * 2;

function rock(overrides: Partial<AsteroidSpec> = {}): AsteroidSpec {
  return {
    index: 7,
    level: 2,
    ore: 1_600,
    crystalShare: 0.4,
    deuteriumShare: 0,
    isotopeRich: false,
    radius: 1_000,
    period: 100,
    phase: 0,
    inclination: 0,
    ascendingNode: 0,
    speed: (TAU * 1_000) / 100,
    appearsAt: 0,
    expiresAt: 500,
    ...overrides,
  };
}

function epoch(overrides: Partial<SensorEpoch> = {}): SensorEpoch {
  return {
    at: { x: 1_000, y: 0, z: 0 },
    reach: 100,
    startsAt: 0,
    endsAt: null,
    ...overrides,
  };
}

describe('asteroid orbit distribution', () => {
  it('keeps the established inner boundary and reaches the true sphere boundary', () => {
    expect(asteroidOrbitRadius(0)).toBe(400);
    expect(asteroidOrbitRadius(1)).toBe(2_000);
  });

  it('uses the measured opportunity-balanced distribution across the full radius', () => {
    const roll = 0.5;
    const expected = Math.pow(400 ** 4 + roll * (2_000 ** 4 - 400 ** 4), 1 / 4);
    expect(asteroidOrbitRadius(roll)).toBeCloseTo(expected, 10);
  });

  it('is monotonic and never leaves the playable sphere for every valid roll', () => {
    let previous = asteroidOrbitRadius(0);
    for (let step = 1; step <= 10_000; step++) {
      const radius = asteroidOrbitRadius(step / 10_000);
      expect(radius).toBeGreaterThanOrEqual(previous);
      expect(radius).toBeGreaterThanOrEqual(400);
      expect(radius).toBeLessThanOrEqual(2_000);
      previous = radius;
    }
  });

  it('rejects invalid random draws instead of silently creating an invalid orbit', () => {
    for (const roll of [-1, 1.000_001, Number.NaN, Infinity]) {
      expect(() => asteroidOrbitRadius(roll)).toThrow(RangeError);
    }
  });
});

describe('exact asteroid/sensor contact', () => {
  it('finds a contact already in progress at the interval start', () => {
    expect(firstOrbitSensorContact(rock(), epoch(), 0, 20)).toBe(0);
  });

  it('finds the next revolution when the interval starts outside the sensor', () => {
    const found = firstOrbitSensorContact(rock(), epoch(), 20, 120);
    expect(found).not.toBeNull();
    expect(found!).toBeGreaterThan(90);
    expect(found!).toBeLessThan(100);
  });

  it('counts an exact tangent as a real contact', () => {
    const tangent = epoch({ at: { x: 1_500, y: 0, z: 0 }, reach: 500 });
    expect(firstOrbitSensorContact(rock(), tangent, 0, 1)).toBeCloseTo(0, 10);
  });

  it('returns null when the orbit can never enter the sphere', () => {
    const centre = epoch({ at: { x: 0, y: 0, z: 0 }, reach: 999 });
    expect(firstOrbitSensorContact(rock(), centre, 0, 500)).toBeNull();
  });

  it('treats an orbit fully enclosed by the sensor as continuously visible', () => {
    const enclosing = epoch({ at: { x: 0, y: 0, z: 0 }, reach: 1_001 });
    expect(firstOrbitSensorContact(rock(), enclosing, 37, 38)).toBe(37);
  });

  it('works on an isotropically tilted 3D orbit, not only the horizontal plane', () => {
    const tilted = rock({ inclination: Math.PI / 2, ascendingNode: Math.PI / 3 });
    const at = asteroidPosition(tilted, 25);
    const post = epoch({ at, reach: 1 });
    const expectedEntry = 25 - (Math.asin(post.reach / tilted.radius) * tilted.period) / TAU;
    expect(firstOrbitSensorContact(tilted, post, 20, 30)).toBeCloseTo(expectedEntry, 8);
  });

  it('clips the search to asteroid appearance and excludes the expiry instant', () => {
    // Phase π puts the rock at this sensor when the global orbit clock reaches 50.
    // Appearance does not reset its orbit phase.
    const finite = rock({ phase: Math.PI, appearsAt: 50, expiresAt: 100 });
    expect(firstOrbitSensorContact(finite, epoch(), 0, 49.999)).toBeNull();
    expect(firstOrbitSensorContact(finite, epoch(), 0, 60)).toBe(50);
    expect(firstOrbitSensorContact(finite, epoch(), 100, 200)).toBeNull();
  });

  it('clips the search to a closed sensor epoch', () => {
    const closedBeforeContact = epoch({ startsAt: 10, endsAt: 90 });
    expect(firstOrbitSensorContact(rock(), closedBeforeContact, 10, 200)).toBeNull();
  });

  it('handles zero-length, reversed and non-finite intervals safely', () => {
    expect(firstOrbitSensorContact(rock(), epoch(), 10, 10)).toBeNull();
    expect(firstOrbitSensorContact(rock(), epoch(), 11, 10)).toBeNull();
    expect(firstOrbitSensorContact(rock(), epoch(), Number.NaN, 10)).toBeNull();
  });
});

describe('persistent per-commander asteroid discovery', () => {
  it('remembers a rock after it leaves the sensor, until the rock expires', () => {
    const asteroid = rock();
    expect(orbitDiscoveredAt(asteroid, [epoch()], 40)).toBe(0);
    expect(orbitDiscoveredAt(asteroid, [epoch()], 499.999)).toBe(0);
    expect(orbitDiscoveredAt(asteroid, [epoch()], 500)).toBeNull();
  });

  it('does not use a future sensor epoch to reveal a past crossing retroactively', () => {
    const upgraded = epoch({ startsAt: 10, endsAt: 90 });
    expect(orbitDiscoveredAt(rock(), [upgraded], 90)).toBeNull();
  });

  it('keeps a discovery made by an old, closed epoch', () => {
    const oldPost = epoch({ startsAt: 0, endsAt: 10 });
    expect(orbitDiscoveredAt(rock(), [oldPost], 80)).toBe(0);
  });

  it('uses the union of multiple owned worlds and chooses the earliest earned contact', () => {
    const misses = epoch({ at: { x: 0, y: 0, z: 0 }, reach: 100 });
    const later = epoch({ startsAt: 20, at: { x: 0, y: 1_000, z: 0 }, reach: 10 });
    const earlier = epoch({ startsAt: 0, at: { x: 1_000, y: 0, z: 0 }, reach: 10 });
    expect(orbitDiscoveredAt(rock(), [misses, later, earlier], 120)).toBe(0);
  });

  it('does not discover through an epoch with no positive reach or no duration', () => {
    expect(orbitDiscoveredAt(rock(), [epoch({ reach: 0 })], 100)).toBeNull();
    expect(orbitDiscoveredAt(rock(), [epoch({ startsAt: 10, endsAt: 10 })], 100)).toBeNull();
  });

  it('returns the next first discovery, ignoring already discovered and expired rocks', () => {
    const already = rock({ index: 1, phase: 0 });
    const future = rock({ index: 2, phase: Math.PI, appearsAt: 0, expiresAt: 500 });
    const expired = rock({ index: 3, appearsAt: -200, expiresAt: -1 });
    const next = nextAsteroidDiscoveryAt([already, future, expired], [epoch()], 1);
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThan(40);
    expect(next!).toBeLessThan(60);
  });

  it('returns null without sensor history or without a future contact', () => {
    expect(nextAsteroidDiscoveryAt([rock()], [], 0)).toBeNull();
    expect(
      nextAsteroidDiscoveryAt(
        [rock()],
        [epoch({ at: { x: 0, y: 0, z: 0 }, reach: 100 })],
        0,
      ),
    ).toBeNull();
  });
});
