import { expect, it } from 'vitest';
import { battleDistribution } from './fleet-loss-calibration.js';

it('does not turn missing victories into zero-loss successes', () => {
  const r = battleDistribution({ DART: 1 }, { BALLISTA: 100 });
  expect(r.victories).toBe(0);
  expect(r.winningMean).toBeNull();
  expect(r.winningP90).toBeNull();
});

it('keeps both annihilation and survival out of the wrong outcome bucket', () => {
  const r = battleDistribution({ TALON: 45 }, { BALLISTA: 15 });
  expect(r.victories).toBe(0);
  expect(r.mutual).toBe(r.samples);
});
