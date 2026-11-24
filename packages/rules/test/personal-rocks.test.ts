import { describe, expect, it } from 'vitest';
import {
  PERSONAL_ROCKS,
  PROSPECTOR,
  asteroidActive,
  distance,
  interceptAsteroid,
  orbitPosition,
  orbitThrough,
  personalRockSpecs,
  worldRadius,
} from '../src/index.js';

/**
 * KİŞİSEL KAYALAR (plan 2026-11-20 §5.2, Faz 3): two rocks beside a first game's capital, a short
 * Prospector flight away, on ordinary closed orbits the shared solver can intercept.
 */
const capital = { x: 5_200, y: 140, z: -2_300 };
const landed = 1_234.5;

describe('the orbit through a point', () => {
  it.each([[capital], [{ x: -800, y: -60, z: 4_100 }], [{ x: 0, y: 0, z: 900 }]])('stands on the point at the minute (%o)', point => {
    const orbit = orbitThrough(point, landed, 3);
    const at = orbitPosition(orbit, landed);
    expect(distance(at, point)).toBeLessThan(1e-6);
    // And drifts sideways at its speed: a minute later it has moved about three units, not up or down.
    const next = orbitPosition(orbit, landed + 1);
    expect(distance(next, at)).toBeCloseTo(3, 3);
    expect(Math.abs(next.y - at.y)).toBeLessThan(0.01);
  });

  it('refuses the centre and a standing rock', () => {
    expect(() => orbitThrough({ x: 0, y: 0, z: 0 }, 0, 3)).toThrow(RangeError);
    expect(() => orbitThrough(capital, 0, 0)).toThrow(RangeError);
  });
});

describe('the two rocks of a landing', () => {
  const rocks = personalRockSpecs(capital, landed, 77);

  it('are two, beside the capital and clear of it, at the landing', () => {
    expect(rocks).toHaveLength(2);
    for (const [i, rock] of rocks.entries()) {
      const at = orbitPosition(rock, landed);
      expect(distance(at, capital)).toBeCloseTo(PERSONAL_ROCKS.distances[i]!, 6);
      expect(distance(at, capital)).toBeGreaterThan(worldRadius(10) * 2);
    }
    expect(distance(orbitPosition(rocks[0]!, landed), orbitPosition(rocks[1]!, landed))).toBeGreaterThan(200);
  });

  it('carry the starter rock: 800–1,200 ore, a third crystal, no deuterium, for six hours', () => {
    for (const rock of rocks) {
      expect(rock.ore).toBeGreaterThanOrEqual(800);
      expect(rock.ore).toBeLessThanOrEqual(1_200);
      expect(rock).toMatchObject({ crystalShare: 0.35, deuteriumShare: 0, isotopeRich: false, level: 1 });
      expect(rock.expiresAt - rock.appearsAt).toBe(360);
      expect(asteroidActive({ ...rock, index: -1 }, landed)).toBe(true);
      expect(asteroidActive({ ...rock, index: -1 }, landed + 361)).toBe(false);
    }
  });

  it('can be reached by a Prospector from home in well under a minute', () => {
    for (const rock of rocks) {
      const hit = interceptAsteroid(capital, PROSPECTOR.speed, { ...rock, index: -1 }, landed);
      expect(hit).not.toBeNull();
      expect(hit!.flightMinutes).toBeLessThan(1);
    }
  });

  it('is the same for the same seed', () => {
    expect(personalRockSpecs(capital, landed, 77)).toEqual(rocks);
    expect(personalRockSpecs(capital, landed, 78).map(rock => rock.ore)).not.toEqual(rocks.map(rock => rock.ore));
  });
});
