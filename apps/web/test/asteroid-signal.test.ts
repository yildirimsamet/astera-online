import { describe, expect, it } from 'vitest';
import { asteroidBodyColour, asteroidTrailColour } from '../src/galaxy/asteroidSignal.js';

describe('public isotope anomaly signal', () => {
  it('keeps ordinary rocks neutral and gives isotope rocks a green-dominant body', () => {
    expect(asteroidBodyColour(false, 1)).toEqual([1, 1, 1]);

    const [red, green, blue] = asteroidBodyColour(true, 1);
    expect(green).toBeGreaterThan(red);
    expect(green).toBeGreaterThan(blue);
  });

  it('uses the green signature along the isotope trail without flattening its fade', () => {
    const atRock = asteroidTrailColour(true, 1, 0);
    const atTail = asteroidTrailColour(true, 1, 1);

    expect(atRock[1]).toBeGreaterThan(atRock[0]);
    expect(atTail[1]).toBeGreaterThan(atTail[0]);
    expect(atTail[1]).toBeLessThan(atRock[1]);
  });
});
