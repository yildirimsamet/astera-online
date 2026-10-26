import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { exactPowerRange, pirateStats, type Fleet } from '@astera/rules';
import type { PirateContact } from '../src/api/schemas.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';

/**
 * THE PIRATE ON THE RULER IS THE PIRATE THE SERVER FIGHTS. A crew under Telescope sight is the
 * very hulls, handicap included, so its power is one exact figure (combat v3).
 */
describe('the power against a pirate crew', () => {
  const crew: Fleet = { RAMPART: 3, COURIER: 2 };
  const pirate = {
    id: 'pirate-1', callsign: 'VEX7', zone: 'IDENTIFIED', at: { x: 400, y: 0, z: 0 },
    expiresInMinutes: 180, reachMinutes: 12,
    reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
    level: 1, fleet: crew, damageMult: pirateStats(1).damageMult, mass: 'MEDIUM',
  } as unknown as PirateContact;

  it('reads the crew exactly, with its handicap', () => {
    const { result } = renderHook(() => useTargetReading({
      target: { kind: 'pirate', pirate },
      reports: [],
      tech: { SHIP_POWER: 1 },
      wing: { DART: 7 },
      rulesetVersion: 15,
    }));
    expect(result.current.power).toEqual(exactPowerRange({ fleet: { DART: 7 }, tech: { SHIP_POWER: 1 } }, crew,
      { tech: {}, damageMult: pirateStats(1).damageMult }));
    expect(result.current.opposing?.ageMinutes).toBeNull();
  });
});
