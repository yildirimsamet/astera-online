import { expect, it } from 'vitest';
import { asteroidHitRadius, asteroidRadius, STARTER_MODEL_SCALE } from '../src/galaxy/scene.js';

it('keeps the original rock touch area when the visible model becomes smaller', () => {
  for (const level of [1, 2, 3, 4, 5]) {
    expect(asteroidHitRadius(level)).toBe(Math.max(asteroidRadius(level) * 2.4, 0.42));
    expect(asteroidHitRadius(level)).toBeGreaterThan(asteroidRadius(level, STARTER_MODEL_SCALE) * 2.4);
  }
});
