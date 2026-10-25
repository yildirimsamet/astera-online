import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T } from '@astera/rules/arena';
import { LANDING_THROTTLE } from '../../src/arena/input.js';
import { landingOffered } from '../../src/arena/landing.js';

/**
 * Owner 2026-10-21: the throttle's landing stop is 24 m/s, not 18, and above 24 m/s
 * neither the LAND key nor the touchdown ring shows.
 */
describe('landing offer', () => {
  it('puts the landing stop at the landing speed', () => {
    expect(LANDING_THROTTLE * T.speedMax).toBeCloseTo(24);
    expect(LANDING_THROTTLE * T.speedMax).toBeLessThanOrEqual(T.landSpeed);
  });

  it('offers LAND at or under landing speed only, and never while landed', () => {
    expect(landingOffered({ s: 24, landed: 0 })).toBe(true);
    expect(landingOffered({ s: 0, landed: 0 })).toBe(true);
    expect(landingOffered({ s: 24.5, landed: 0 })).toBe(false);
    expect(landingOffered({ s: 60, landed: 0 })).toBe(false);
    expect(landingOffered({ s: 0, landed: 3 })).toBe(false);
  });
});
