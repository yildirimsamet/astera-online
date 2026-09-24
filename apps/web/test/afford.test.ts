import { describe, expect, it } from 'vitest';
import { affordWait } from '../src/lib/afford.js';

/**
 * WHEN A PRICE WILL BE MET, at the planet's current rates. D1: the item sheet's
 * primary button says it in place of the price it cannot pay.
 */
describe('the wait until a price is met', () => {
  const income = { alloyPerHour: 600, crystalPerHour: 120 };

  it('is nothing when nothing is short', () => {
    expect(affordWait({ alloy: 0, crystal: 0 }, income)).toBe(0);
  });

  it('is the longer of the two waits, since both prices must be met', () => {
    // 300 alloy at 600/h is 30 minutes; 240 crystal at 120/h is two hours.
    expect(affordWait({ alloy: 300, crystal: 240 }, income)).toBe(120);
    expect(affordWait({ alloy: 1200, crystal: 0 }, income)).toBe(120);
  });

  /** "Enough in 3,600 days" is worse than saying nothing at all. */
  it('has no answer when a short resource is not being made', () => {
    expect(affordWait({ alloy: 0, crystal: 50 }, { alloyPerHour: 600, crystalPerHour: 0 })).toBeNull();
    expect(affordWait({ alloy: 10, crystal: 0 }, { alloyPerHour: 0, crystalPerHour: 0 })).toBeNull();
  });

  it('does not care that a resource it does not need is idle', () => {
    expect(affordWait({ alloy: 60, crystal: 0 }, { alloyPerHour: 60, crystalPerHour: 0 })).toBe(60);
  });
});
