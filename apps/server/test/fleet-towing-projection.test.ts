import { expect, it } from 'vitest';
import { rewardFlightFleet } from '../src/services/fleetTowing.js';

it('uses physical HP rosters without duplicating same-type prizes or resurrecting lost prizes', () => {
  const aboard = {DART: 4, TALON: 1};
  expect(rewardFlightFleet(aboard, {DART: 2, TALON: 3, VIPER: 1}, true)).toEqual({
    fleet: aboard, towing: {DART: 2, TALON: 1},
  });
  expect(aboard).toEqual({DART: 4, TALON: 1});
  expect(rewardFlightFleet({}, {DART: 1}, true)).toEqual({fleet: {}});
});
it('adds legacy awards only to the visual manifest, without changing source rosters', () => {
  const aboard = {DART: 4};
  expect(rewardFlightFleet(aboard, {DART: 2, TALON: 1}, false)).toEqual({
    fleet: {DART: 6, TALON: 1}, towing: {DART: 2, TALON: 1},
  });
  expect(aboard).toEqual({DART: 4});
  expect(rewardFlightFleet(aboard, {}, false)).toEqual({fleet: aboard});
});
