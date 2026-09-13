import { describe, expect, it } from 'vitest';
import { prospectorAvailability } from '../src/galaxy.js';

describe('independent Prospector cooldowns', () => {
  it('leaves a fresh home craft available while the landed craft rests', () => {
    expect(prospectorAvailability(2, [{ craft: 1, readyAtMs: 2000 }], 1000))
      .toEqual({ available: 1, readyAtMs: 2000 });
  });
  it('expires each landing separately, including the exact ready instant', () => {
    const rests = [{ craft: 1, readyAtMs: 2000 }, { craft: 1, readyAtMs: 3000 }];
    expect(prospectorAvailability(2, rests, 1999)).toEqual({ available: 0, readyAtMs: 2000 });
    expect(prospectorAvailability(2, rests, 2000)).toEqual({ available: 1, readyAtMs: 3000 });
    expect(prospectorAvailability(2, rests, 3000)).toEqual({ available: 2, readyAtMs: null });
  });
  it('counts every craft in a batch and never invents negative availability', () => {
    expect(prospectorAvailability(2, [{ craft: 2, readyAtMs: 2000 }], 1000).available).toBe(0);
    expect(prospectorAvailability(0, [{ craft: 2, readyAtMs: 2000 }], 1000).available).toBe(0);
  });
  it('does not depend on cooldown order', () => {
    expect(prospectorAvailability(2, [{ craft: 1, readyAtMs: 3000 }, { craft: 1, readyAtMs: 2000 }], 1000))
      .toEqual({ available: 0, readyAtMs: 2000 });
  });
});
