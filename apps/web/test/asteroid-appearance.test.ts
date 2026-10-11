import { describe, expect, it } from 'vitest';
import { asteroidModelUrl } from '../src/galaxy/asteroidAppearance.js';
import { ASTEROID_MODELS, ISOTOPE_MODEL } from '../src/ui/assets.js';

describe('public asteroid appearance', () => {
  it('selects green mineral geometry exclusively from the public isotope signal', () => {
    expect(asteroidModelUrl({ id: 'opaque-id', isotopeRich: true })).toBe(ISOTOPE_MODEL);
    expect(ASTEROID_MODELS).toContain(asteroidModelUrl({ id: 'opaque-id', isotopeRich: false }));
  });
  it('keeps ordinary variety stable without consulting private ore or composition', () => {
    const first = { id: 'stable-rock', isotopeRich: false, crystalShare: 0.1, deuteriumShare: null, oreRemaining: 300 };
    const second = { ...first, crystalShare: 0.9, deuteriumShare: 0.5, oreRemaining: 20 };
    expect(asteroidModelUrl(first)).toBe(asteroidModelUrl(second));
  });
});
