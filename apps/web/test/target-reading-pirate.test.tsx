import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { combatValue, pirateStats, type Fleet } from '@astera/rules';
import type { PirateContact } from '../src/api/schemas.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';

/**
 * THE PIRATE ON THE RULER IS THE PIRATE THE SERVER FIGHTS. Owner report, 2026-10-06.
 *
 * Holds a pirate is left with once its last warship is down are taken (`pirateOverrun`). The
 * launch sheet and the dossier read the same rule, or the ruler says "break" over a fight the
 * server settles as a clean sweep — and the commander under-sends or never sends.
 */
describe('the forecast against a pirate crew', () => {
  const crew: Fleet = { RAMPART: 3, COURIER: 2 };
  const pirate = {
    id: 'pirate-1', callsign: 'VEX7', zone: 'IDENTIFIED', at: { x: 400, y: 0, z: 0 },
    expiresInMinutes: 180, reachMinutes: 12,
    reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
    level: 1, fleet: crew, damageMult: pirateStats(1).damageMult, mass: 'MEDIUM',
  } as unknown as PirateContact;

  it('clears a crew whose holds outlive its line', () => {
    const { result } = renderHook(() => useTargetReading({
      target: { kind: 'pirate', pirate },
      reports: [],
      tech: {},
      wing: { DART: 4 },
      rulesetVersion: 15,
    }));
    expect(result.current.lines).not.toBeNull();
    expect(combatValue(crew)).toBeLessThan(result.current.lines!.clears.low);
  });
});
