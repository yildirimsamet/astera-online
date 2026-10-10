import { orbitFingerprint } from './orbitFingerprint.js';
import { describe, expect, it } from 'vitest';
import {
  ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, DEUTERIUM, GALAXY,
  currentAsteroidGeneration, generateAsteroidHour, mulberry32, type AsteroidGeneration,
} from '../src/index.js';

const generate = (generation?: AsteroidGeneration) => generateAsteroidHour({
  hourOrdinal: 120, isotopeSeed: 4242, rng: mulberry32(42),
  generation,
  levelWeights: [0, 0.44, 0.26, 0.17, 0.09, 0.04],
  lanes: [{ fromMinute: 7200, untilMinute: 7230, count: 100, frontCount: 40 }],
});

describe('legacy dynamic generation inputs', () => {
  it('preserves the exact pre-release RNG order and all 100 complete specs', () => {
    // Keep RNG draws and all identity/resource fields exact across supported runtimes.
    expect(orbitFingerprint(generate()))
      .toBe('dde57e2b385e56bf89fc12f0def15148b71c4fdc49d2ec6b13659f9479ac4716');
  });

  it('copies the generation inputs when an hour opens rather than retaining mutable arrays', () => {
    const generation = currentAsteroidGeneration();
    expect(generation.oreByLevel).toEqual(GALAXY.asteroidOreByLevel);
    expect(generation.oreByLevel).not.toBe(GALAXY.asteroidOreByLevel);
    expect(generation.levelUnlockByDay).not.toBe(ASTEROID_DYNAMIC.levelUnlockByDay);
    expect(generation.frontLoadMinutes).toBe(10);
    const before = generate(generation);
    const descriptor = Object.getOwnPropertyDescriptor(ASTEROID_SHOWER_FRONT_LOAD, 'minutes')!;
    try {
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', { value: 1 });
      expect(generate(generation)).toEqual(before);
    } finally {
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', descriptor);
    }
  });

  it('keeps every existing spec identical when all mutable generation settings change', () => {
    const before = generate();
    const originals = [GALAXY, ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, DEUTERIUM]
      .map((target) => ({ target, descriptors: Object.getOwnPropertyDescriptors(target) }));
    try {
      Object.defineProperties(GALAXY, {
        asteroidOreByLevel: { value: [0, 1600, 3200, 4800, 6400, 8000] },
        asteroidOrbitMin: { value: 100 }, asteroidOrbitMax: { value: 500 },
        asteroidSpeedMin: { value: 100 }, asteroidSpeedMax: { value: 200 },
        asteroidLifeHoursMin: { value: 1 }, asteroidLifeHoursMax: { value: 2 },
        asteroidCrystalShareMin: { value: 0.01 }, asteroidCrystalShareMax: { value: 0.02 },
      });
      Object.defineProperties(ASTEROID_DYNAMIC, {
        levelUnlockByDay: { value: [1] }, levelWeights: { value: [0, 1] },
        indexBase: { value: 20_000_000 }, indexSpanPerHour: { value: 200_000 },
      });
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', { value: 1 });
      Object.defineProperties(DEUTERIUM, {
        frontierStartsAtMinutes: { value: 999_999 }, isotopeCadence: { value: 3 },
        isotopeBonusCadence: { value: 4 },
        isotopeShareMin: { value: 0.5 }, isotopeShareMax: { value: 0.6 },
      });
      expect(generate().every((rock, index) => JSON.stringify(rock) === JSON.stringify(before[index])))
        .toBe(true);
    } finally {
      for (const original of originals) Object.defineProperties(original.target, original.descriptors);
    }
  });
});
