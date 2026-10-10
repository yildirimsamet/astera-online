import { describe, expect, it } from 'vitest';
import { currentAsteroidGeneration, LEGACY_ASTEROID_GENERATION } from '@astera/rules';
import { parseAsteroidGeneration } from '../src/services/asteroidGeneration.js';
import { asteroidId, privateAsteroidHour } from '../src/services/asteroidField.js';

describe('persisted asteroid generation', () => {
  it('reads a pre-migration row with immutable legacy inputs', () => {
    expect(parseAsteroidGeneration(null)).toEqual(LEGACY_ASTEROID_GENERATION);
  });

  it.each([
    { version: 2 },
    { oreByLevel: [] },
    { lifeHoursMin: 6, lifeHoursMax: 1 },
  ])('rejects corrupt or unsupported persisted settings: %j', (change) => {
    expect(() => parseAsteroidGeneration({ ...currentAsteroidGeneration(), ...change })).toThrow();
  });

  it('includes the full generation snapshot in the cached hour while preserving public IDs', () => {
    const key = 'asteroid-generation-cache-fixture';
    const generation = currentAsteroidGeneration();
    const hour = {
      hourOrdinal: 120, levelWeights: [0, 1, 0, 0, 0, 0], generation,
      lanes: [{ fromMinute: 7200, untilMinute: 7260, count: 2, frontCount: 0 }],
    };
    const original = privateAsteroidHour(key, hour);
    const changed = privateAsteroidHour(key, {
      ...hour, generation: { ...generation, oreByLevel: generation.oreByLevel.map((ore) => ore * 2) },
    });
    expect(changed.map((rock) => rock.ore)).toEqual(original.map((rock) => rock.ore * 2));
    expect(changed.map((rock) => asteroidId(key, rock.index)))
      .toEqual(original.map((rock) => asteroidId(key, rock.index)));
    expect(privateAsteroidHour(key, hour)).toEqual(original);
  });
});
