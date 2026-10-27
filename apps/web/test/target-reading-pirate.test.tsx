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

  it('reads the wing with the commander-ship escort\'s bonus when it flies (Y9)', () => {
    // An even fight, where a sixth more damage and a tenth more hull change the balance.
    const even = { ...pirate, fleet: { DART: 15 }, damageMult: 1 } as PirateContact;
    const read = (escort: Parameters<typeof useTargetReading>[0]['escort']) => renderHook(() => useTargetReading({
      target: { kind: 'pirate', pirate: even }, reports: [], tech: {}, wing: { DART: 20 }, rulesetVersion: 19, escort,
    })).result.current;
    const plain = read(null);
    const led = read({ damage: 1.15, hull: 1.1, time: 1, fuel: 1 });
    expect(led.power!.ratio.low).toBeGreaterThan(plain.power!.ratio.low);
    expect(led.power).toEqual(exactPowerRange({ fleet: { DART: 20 }, tech: {}, damageMult: 1.15, hullMult: 1.1 }, { DART: 15 }, { tech: {}, damageMult: 1 }));
    // A Kılavuz shortens the road and lends the fight nothing.
    expect(read({ damage: 1, hull: 1, time: 0.97, fuel: 0.95 }).power).toEqual(plain.power);
  });
});
