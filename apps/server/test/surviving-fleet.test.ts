import { describe, expect, it, vi } from 'vitest';
import { survivingFleet } from '../src/services/flightProjection.js';

/**
 * A DOSE IS A FACT ABOUT THE CRAFT, NOT ABOUT WHO IS LOOKING. Query plan, 2026-11-03.
 *
 * Four fifths of a traffic read went on working out what radiation had done to every
 * craft in the galaxy, again for each commander, most of whom could not see that craft
 * at all. The cost grew with craft × commanders. A snapshot now answers it once a second.
 */
const craft = 'mission-1';
const at = (ms: number) => new Date(ms);

describe('survivingFleet', () => {
  it('answers every commander reading in the same second from one projection', () => {
    const snapshot = {};
    const project = vi.fn(() => ({ DART: 3 }));
    const first = survivingFleet(snapshot, craft, at(10_000), project);
    const second = survivingFleet(snapshot, craft, at(10_999), project);
    expect(second).toEqual(first);
    expect(project).toHaveBeenCalledOnce();
  });

  it('projects again in the next second, because a dose keeps growing', () => {
    const snapshot = {};
    const project = vi.fn((when: Date) => ({ DART: when.getTime() < 11_000 ? 3 : 2 }));
    expect(survivingFleet(snapshot, craft, at(10_500), project)).toEqual({ DART: 3 });
    expect(survivingFleet(snapshot, craft, at(11_000), project)).toEqual({ DART: 2 });
    expect(project).toHaveBeenCalledTimes(2);
  });

  it('gives the same answer whichever commander asks first in the second', () => {
    const project = (when: Date) => ({ DART: when.getTime() });
    expect(survivingFleet({}, craft, at(10_001), project)).toEqual(survivingFleet({}, craft, at(10_999), project));
    expect(survivingFleet({}, craft, at(10_999), project)).toEqual({ DART: 10_000 });
  });

  it('keeps each craft to itself', () => {
    const snapshot = {};
    expect(survivingFleet(snapshot, 'a', at(10_000), () => ({ DART: 1 }))).toEqual({ DART: 1 });
    expect(survivingFleet(snapshot, 'b', at(10_000), () => ({ DART: 2 }))).toEqual({ DART: 2 });
  });

  it('starts over with a newer snapshot, whose flights may have changed', () => {
    const project = vi.fn(() => ({ DART: 1 }));
    survivingFleet({}, craft, at(10_000), project);
    survivingFleet({}, craft, at(10_000), project);
    expect(project).toHaveBeenCalledTimes(2);
  });
});
