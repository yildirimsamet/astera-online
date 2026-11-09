import { GALAXY, JUMP_FLIGHT, mainOffsetOf, starterGalaxyCentre, toWorld } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { departuresWatched, inboundWatched, watchSeconds } from '../src/galaxy/watchedFlights.js';

/**
 * EVERYONE SEES THE JUMP (owner, 2026-11-09): the neighbours watch the ship leave, the main galaxy
 * watches it come in. Both see the same seconds of one flight, which ends at the main galaxy's rim:
 * where it lands is nobody else's to see.
 */
const at = new Date('2026-11-09T12:00:00Z');
const later = (seconds: number) => at.getTime() + seconds * 1000;
const rimDistance = (p: readonly number[], centre: readonly number[]) => Math.hypot(p[0]! - centre[0]!, p[1]! - centre[1]!, p[2]! - centre[2]!);

describe('a neighbour leaving, seen from its galaxy', () => {
  const offset = mainOffsetOf(2);
  const row = { name: 'Gone', country: 'TR' as const, at, x: 120, y: -30, z: 60, hull: 'WEDGE' as const };

  it('leaves from where it stood and stops at the main galaxy\'s rim, in this galaxy\'s frame', () => {
    const [flight] = departuresWatched([row], offset, later(3));
    expect(flight!.hull).toBe('WEDGE');
    expect(flight!.from).toEqual(toWorld({ x: 120, y: -30, z: 60 }));
    expect(rimDistance(flight!.stop, toWorld(offset))).toBeCloseTo(GALAXY.radius / 50, 3);
  });

  it('is watched only while it flies, on the clock it left by', () => {
    const [flight] = departuresWatched([row], offset, later(3));
    expect(watchSeconds(flight!, later(-1))).toBeNull();
    expect(watchSeconds(flight!, later(4))).toBeCloseTo(4);
    expect(watchSeconds(flight!, later(JUMP_FLIGHT.gone + 0.5))).toBeNull();
  });

  it('keeps no old departure on the sky, whatever the board still lists', () => {
    expect(departuresWatched([row], offset, later(120))).toEqual([]);
  });
});

describe('a newcomer coming in, seen from the main galaxy', () => {
  const row = { hull: 'SEED' as const, ordinal: 3, at, x: 40, y: 0, z: -90 };

  it('comes from where it stood in its own galaxy and stops at this galaxy\'s rim', () => {
    const [flight] = inboundWatched([row], later(8));
    const centre = starterGalaxyCentre(3);
    expect(flight!.from).toEqual(toWorld({ x: 40 + centre.x, y: centre.y, z: -90 + centre.z }));
    expect(rimDistance(flight!.stop, [0, 0, 0])).toBeCloseTo(GALAXY.radius / 50, 3);
    expect(flight!.at).toBe(at.getTime());
  });

  it('is gone from the sky once it has jumped in', () => {
    expect(inboundWatched([row], later(120))).toEqual([]);
  });
});
