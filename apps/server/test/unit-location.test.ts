import { describe, expect, it } from 'vitest';
import { dockLocation } from '@astera/rules';
import {
  MOON_LOCATION, PLANET_LOCATION, bodyLocation, hopLocation, isAway, isDock, isHop, isStanding,
} from '../src/services/unitLocation.js';

describe('unit locations (ay planı §6.1)', () => {
  it('names one standing location per body', () => {
    expect(bodyLocation('PLANET')).toBe(PLANET_LOCATION);
    expect(bodyLocation('MOON')).toBe(MOON_LOCATION);
    expect(PLANET_LOCATION).toBe('home');
  });

  it('sorts every row into exactly one class', () => {
    const rows = {
      planet: PLANET_LOCATION,
      moon: MOON_LOCATION,
      dock: dockLocation('lot-1'),
      hop: hopLocation('move-1'),
      mission: '6d81e3f6-cd05-4a0d-8c56-009e3d6b3fce',
      monument: 'monument:abc',
    };
    const classes = Object.fromEntries(Object.entries(rows).map(([name, location]) => [name,
      [isStanding(location), isDock(location), isHop(location), isAway(location)].map(Number).join('')]));
    expect(classes).toEqual({
      planet: '1000', moon: '1000', dock: '0100', hop: '0010', mission: '0001', monument: '0001',
    });
  });
});
