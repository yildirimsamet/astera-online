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
      wing: { DART: 7 },
      rulesetVersion: 15,
    }));
    expect(result.current.lines).not.toBeNull();
    expect(combatValue(crew)).toBeLessThan(result.current.lines!.clears.low);
  });

  it('draws the lines with the commander-ship escort\'s bonus when it flies (Y9)', () => {
    // An even fight, where a sixth more damage and a tenth more hull change what comes home.
    const even = { ...pirate, fleet: { DART: 15 }, damageMult: 1 } as PirateContact;
    const read = (escort: Parameters<typeof useTargetReading>[0]['escort']) => renderHook(() => useTargetReading({
      target: { kind: 'pirate', pirate: even }, reports: [], tech: {}, wing: { DART: 20 }, rulesetVersion: 19, escort,
    })).result.current;
    const plain = read(null);
    const led = read({ damage: 1.15, hull: 1.1, time: 1, fuel: 1 });
    expect(led.loss!.low).toBeLessThan(plain.loss!.low);
    // A Kılavuz shortens the road and lends the fight nothing.
    expect(read({ damage: 1, hull: 1, time: 0.97, fuel: 0.95 }).loss).toEqual(plain.loss);
  });
});
