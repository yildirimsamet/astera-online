import { describe, expect, it } from 'vitest';
import { GALAXY } from '../src/constants.js';
import { generateAsteroidSchedule } from '../src/galaxy.js';
import { mulberry32 } from '../src/rng.js';

describe('asteroid Crystal yield', () => {
  it('reduces both ends of the former 25–65% Crystal share by 30%', () => {
    expect(GALAXY.asteroidCrystalShareMin).toBeCloseTo(0.25 * 0.7, 10);
    expect(GALAXY.asteroidCrystalShareMax).toBeCloseTo(0.65 * 0.7, 10);
  });

  it('keeps every generated rock inside the reduced Crystal range', () => {
    const rocks = generateAsteroidSchedule(mulberry32(4242), 7 * 24 * 60, 4242);
    expect(rocks.length).toBeGreaterThan(0);
    for (const rock of rocks) {
      expect(rock.crystalShare).toBeGreaterThanOrEqual(GALAXY.asteroidCrystalShareMin);
      expect(rock.crystalShare).toBeLessThanOrEqual(GALAXY.asteroidCrystalShareMax);
    }
  });
});
