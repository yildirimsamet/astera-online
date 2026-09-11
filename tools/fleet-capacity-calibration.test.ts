import { expect, it } from 'vitest';
import { composition, sizeFleet } from './fleet-capacity-calibration.js';

it('keeps economic budget and physical capacity as independent constraints', () => {
  expect(sizeFleet(1000, 100, 10, 3)).toBe(3);
  expect(sizeFleet(1000, 100, 100, 3)).toBe(10);
  expect(sizeFleet(0, 100, 100, 3)).toBe(0);
});

it('rejects an invalid size instead of inventing unlimited ships', () => {
  expect(() => sizeFleet(1000, 100, 100, 0)).toThrow();
});

it('rounds a mixed fleet without creating additional budget', () => {
  expect(composition(['DART', 'PIKE', 'WARDEN'], [0.8, 0.2, 0], 12)).toEqual({ DART: 10, PIKE: 2 });
  expect(composition(['DART', 'PIKE', 'WARDEN'], [1, 1, 1], 12)).toEqual({ DART: 4, PIKE: 4, WARDEN: 4 });
});
