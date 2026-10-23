import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, lowFuel } from '../../src/arena/index.js';

describe('the fuel warning', () => {
  it('fires at 15 % of the tank, whatever the tank holds (v6: 250)', () => {
    expect(lowFuel(T.fuelTank * 0.15 - 0.01)).toBe(true);
    expect(lowFuel(T.fuelTank * 0.15)).toBe(false);
    expect(lowFuel(14, { ...T, fuelTank: 100 })).toBe(true);
    expect(lowFuel(15, { ...T, fuelTank: 100 })).toBe(false);
  });
});
