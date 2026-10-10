import { z } from 'zod';
import { LEGACY_ASTEROID_GENERATION, type AsteroidGeneration } from '@astera/rules';

const share = z.number().finite().min(0).max(1);
const positive = z.number().finite().positive();

/** A corrupt or unknown-version snapshot must fail explicitly rather than silently reroll rocks. */
export const asteroidGenerationSchema = z.object({
  version: z.literal(1),
  frontLoadMinutes: z.number().finite().nonnegative(),
  levelUnlockByDay: z.array(z.number().int().min(1).max(5)).min(1),
  oreByLevel: z.array(z.number().finite().nonnegative()).length(6),
  orbitMin: positive, orbitMax: positive,
  speedMin: positive, speedMax: positive,
  lifeHoursMin: positive, lifeHoursMax: positive,
  crystalShareMin: share, crystalShareMax: share,
  isotope: z.object({
    frontierStartsAtMinutes: z.number().finite().nonnegative(),
    isotopeCadence: z.number().int().positive(),
    isotopeBonusCadence: z.number().int().positive(),
    isotopeShareMin: share, isotopeShareMax: share,
  }).strict(),
}).strict().refine((value) => value.orbitMax >= value.orbitMin
  && value.speedMax >= value.speedMin && value.lifeHoursMax >= value.lifeHoursMin
  && value.crystalShareMax >= value.crystalShareMin
  && value.isotope.isotopeShareMax >= value.isotope.isotopeShareMin,
'Generation ranges must be ordered');

export function parseAsteroidGeneration(value: unknown): AsteroidGeneration {
  return value === null || value === undefined
    ? LEGACY_ASTEROID_GENERATION
    : asteroidGenerationSchema.parse(value);
}
