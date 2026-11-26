import { describe, expect, it } from 'vitest';
import { corridorSpeedLook, streakAlong, streakFade } from '../src/galaxy/corridorStreaks.js';
import { formationEngineUnits } from '../src/galaxy/engineUnits.js';
import type { Marker } from '../src/galaxy/Squadrons.js';

/**
 * A CLAN SUPPORT WAVE ON THE CORRIDOR MUST LOOK FAST (owner, 2026-11-24). The route already flows
 * in the clan's green; the craft itself now burns a long plume and lane streaks rush back past it,
 * so the speed is read off what moves past the fleet. Every other flight keeps its ordinary look.
 */
describe('the corridor speed look', () => {
  it('gives a corridor leg streaks, a longer and brighter plume', () => {
    const look = corridorSpeedLook(true);
    expect(look.streaks).toBe(true);
    expect(look.plume).toBeGreaterThan(1.5);
    expect(look.intensity).toBeGreaterThan(1);
  });

  it('leaves every other flight exactly as it was', () => {
    for (const corridor of [false, undefined]) {
      expect(corridorSpeedLook(corridor)).toEqual({ streaks: false, plume: 1, intensity: 1 });
    }
  });
});

describe('lane streaks along the heading', () => {
  const span = 10;

  it('run backward past the craft as time passes', () => {
    expect(streakAlong(0.5, 1, span, 2)).toBeLessThan(streakAlong(0.5, 0, span, 2));
  });

  it('wrap inside the span and never leave it', () => {
    for (let t = 0; t < 40; t += 0.37) {
      for (const offset of [0, 0.31, 0.99]) {
        const along = streakAlong(offset, t, span, 3);
        expect(along).toBeGreaterThanOrEqual(-span / 2);
        expect(along).toBeLessThanOrEqual(span / 2);
      }
    }
  });

  it('start the same place for the same seed, so two screens agree', () => {
    expect(streakAlong(0.42, 7.5, span, 2)).toBe(streakAlong(0.42, 7.5, span, 2));
  });

  it('fade to nothing at both ends and show fully in the middle, so nothing pops in or out', () => {
    expect(streakFade(-span / 2, span)).toBe(0);
    expect(streakFade(span / 2, span)).toBe(0);
    expect(streakFade(0, span)).toBe(1);
    expect(streakFade(span * 0.45, span)).toBeLessThan(streakFade(span * 0.25, span));
  });
});

describe('the plume of a corridor craft', () => {
  const markers: Marker[] = (['DART', 'CORSAIR'] as const).map(hull => ({ hull, filled: 1, ordinal: 0 }));

  it('stretches every engine by the same factor and leaves the ports where they are', () => {
    const plain = formationEngineUnits(markers, [], 1);
    const fast = formationEngineUnits(markers, [], 1, undefined, 1, 2.4);
    for (const [index, unit] of fast.entries()) {
      expect(unit.lengthFactor).toBeCloseTo(plain[index]!.lengthFactor * 2.4, 9);
      expect(unit.widthFactor).toBe(plain[index]!.widthFactor);
      expect(unit.nozzles).toEqual(plain[index]!.nozzles);
    }
  });

  it('is unchanged when no stretch is asked for', () => {
    expect(formationEngineUnits(markers, [], 1)).toEqual(formationEngineUnits(markers, [], 1, undefined, 1, 1));
  });
});
