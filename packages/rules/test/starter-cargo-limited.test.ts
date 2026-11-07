import { describe, expect, it } from 'vitest';
import { cargoWasLimited } from '../src/starter/flight.js';

const some = { alloy: 60, crystal: 40, deuterium: 0 };
const none = { alloy: 0, crystal: 0, deuterium: 0 };

describe('whether the holds were what stopped a raid', () => {
  it('says so when a living fleet left stock behind', () => {
    expect(cargoWasLimited({ alloy: 120, crystal: 80, deuterium: 0 }, some, 100)).toBe(true);
  });

  it('does not blame the holds of a fleet with none left', () => {
    expect(cargoWasLimited(some, none, 0)).toBe(false);
  });

  it('says nothing when everything was carried', () => {
    expect(cargoWasLimited(some, some, 100)).toBe(false);
  });
});
