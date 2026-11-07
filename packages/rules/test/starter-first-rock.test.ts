import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { STARTER, orbitPosition, orbitSeedOf, rockSeedNear, starterAsteroidOrbit } from '../src/index.js';

const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * THE FIRST ROCK (retention plan §6.3). Rocks are scarce and they move, so the guided session's first
 * Prospector may have nothing near. The ship that finishes its Shipyard is given a rock whose orbit is
 * passing close by right now: a minute's flight, not a wait.
 */
describe('a rock near a new shipyard', () => {
  const ids = Array.from({ length: 600 }, () => randomUUID());

  it("is an orbit passing within the first flight's reach right now", () => {
    for (const ship of [{ x: 0, y: 0, z: 0 }, { x: 600, y: 0, z: -300 }, { x: -820, y: 10, z: 120 }]) {
      const id = rockSeedNear(ship, 500, ids);
      expect(id).not.toBeNull();
      const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(id!)), 500);
      const d = distance(at, ship);
      expect(d).toBeGreaterThanOrEqual(STARTER.firstRock.near);
      expect(d).toBeLessThanOrEqual(STARTER.firstRock.far);
    }
  });

  it('is nothing when no candidate passes close', () => {
    expect(rockSeedNear({ x: 5000, y: 0, z: 0 }, 0, ids)).toBeNull();
  });

  it('also reaches ships above and below the orbital equator', () => {
    const candidates = Array.from({ length: 12000 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`);
    for (const ship of [{ x: 109, y: 420, z: -179 }, { x: 0, y: -820, z: 0 }]) {
      const id = rockSeedNear(ship, 80, candidates);
      expect(id).not.toBeNull();
      expect(distance(orbitPosition(starterAsteroidOrbit(orbitSeedOf(id!)), 80), ship)).toBeLessThanOrEqual(STARTER.firstRock.far);
    }
  });
});
