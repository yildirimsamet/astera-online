import { ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, DEUTERIUM, GALAXY } from './constants.js';
import type { IsotopeGenerationParameters } from './research.js';

/** Version 1 fixes the RNG order, orbit sampler and isotope hash; change algorithms via a new version. */
export interface AsteroidGeneration {
  version: 1;
  frontLoadMinutes: number;
  levelUnlockByDay: readonly number[];
  oreByLevel: readonly number[];
  orbitMin: number;
  orbitMax: number;
  speedMin: number;
  speedMax: number;
  lifeHoursMin: number;
  lifeHoursMax: number;
  crystalShareMin: number;
  crystalShareMax: number;
  isotope: IsotopeGenerationParameters;
}

/**
 * Pre-2026-10-09 rows have no generation snapshot. These are the exact settings their
 * last image used. Never derive this fallback from mutable balance constants: doing
 * that revives depleted rocks and changes targets when the next image starts.
 */
export const LEGACY_ASTEROID_GENERATION: AsteroidGeneration = Object.freeze({
  version: 1,
  frontLoadMinutes: 5,
  levelUnlockByDay: Object.freeze([2, 3, 4, 5]),
  oreByLevel: Object.freeze([0, 800, 1600, 2400, 3200, 4000]),
  orbitMin: 900,
  orbitMax: 4500,
  speedMin: 262.5,
  speedMax: 562.5,
  lifeHoursMin: 2.5,
  lifeHoursMax: 5,
  crystalShareMin: 0.175,
  crystalShareMax: 0.455,
  isotope: Object.freeze({
    frontierStartsAtMinutes: 35 * 60,
    isotopeCadence: 5,
    isotopeBonusCadence: 10,
    isotopeShareMin: 0.10,
    isotopeShareMax: 0.25,
  }),
});

/** Capture once at hour creation; subsequent reads use the persisted copy. */
export function currentAsteroidGeneration(): AsteroidGeneration {
  return {
    version: 1,
    frontLoadMinutes: ASTEROID_SHOWER_FRONT_LOAD.minutes,
    levelUnlockByDay: [...ASTEROID_DYNAMIC.levelUnlockByDay],
    oreByLevel: [...GALAXY.asteroidOreByLevel],
    orbitMin: GALAXY.asteroidOrbitMin,
    orbitMax: GALAXY.asteroidOrbitMax,
    speedMin: GALAXY.asteroidSpeedMin,
    speedMax: GALAXY.asteroidSpeedMax,
    lifeHoursMin: GALAXY.asteroidLifeHoursMin,
    lifeHoursMax: GALAXY.asteroidLifeHoursMax,
    crystalShareMin: GALAXY.asteroidCrystalShareMin,
    crystalShareMax: GALAXY.asteroidCrystalShareMax,
    isotope: {
      frontierStartsAtMinutes: DEUTERIUM.frontierStartsAtMinutes,
      isotopeCadence: DEUTERIUM.isotopeCadence,
      isotopeBonusCadence: DEUTERIUM.isotopeBonusCadence,
      isotopeShareMin: DEUTERIUM.isotopeShareMin,
      isotopeShareMax: DEUTERIUM.isotopeShareMax,
    },
  };
}
