import { describe, expect, it } from 'vitest';
import { wreckPosition, type WreckView } from '../src/galaxy/Wrecks.js';
import { toWorld } from '../src/galaxy/scene.js';

/**
 * WHERE A WRECK IS, FOR EVERYTHING THAT NEEDS TO KNOW. D150.
 *
 * The camera resolved a field through the WORLD it orbited, and a pirate battle
 * happens in open space — so `planetId` is null, the lookup found nothing, and
 * tapping the one wreck in the galaxy that nobody owns did nothing at all: no
 * focus, no zoom, and no way for a player to tell whether they had missed.
 *
 * The field's own coordinates are authoritative for every field, world or void
 * (the renderer has always placed it from them), so this is the one statement of
 * a wreck's position and both the ring and the rig read it.
 */
const field = (over: Partial<WreckView> = {}): WreckView => ({
  id: 'd1',
  planetId: 'w1',
  at: { x: 40, y: 2, z: -18 },
  alloy: 1200,
  crystal: 300,
  minutesLeft: 12,
  ...over,
});

describe('a wreck field on the disc', () => {
  it('is placed from its own coordinates when it orbits a world', () => {
    expect(wreckPosition(field())).toEqual(toWorld({ x: 40, y: 2, z: -18 }));
  });

  it('is placed the same way with no world under it at all', () => {
    expect(wreckPosition(field({ planetId: null, at: { x: -9, y: 5, z: 3 } })))
      .toEqual(toWorld({ x: -9, y: 5, z: 3 }));
  });
});
