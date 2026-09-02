import { describe, expect, it } from 'vitest';
import { CORE_TOP_LEVEL, MULTI_WORLD } from '@astera/rules';
import { shellGroups } from '../src/galaxy/DysonShells.js';
import { planetNodes } from '../src/galaxy/scene.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';

/**
 * WHERE THE DYSON LADDER STARTS, AND WHAT IT IS FOR. D153, owner instruction.
 *
 * It began at Core 9, and the owner's report is what that did to the disc: a world
 * arriving at 9 grew a megastructure, so the step from 8 to 9 was the largest
 * visual event in the whole game — a world that had been ordinary the session
 * before was suddenly wearing a ring, and the two facts a player reads off the map
 * (how big is it, how far along is it) both announced themselves at once.
 *
 * TWELVE IS "THE SOLID PLAYERS" MEANT PROPERLY. The ladder's whole job is to mark a
 * commander who has actually built something; starting at 9 put a structure on a
 * world barely past the middle of the Core ladder. It now begins past the halfway
 * point and runs to the top of the game, which also separates it from the size ramp
 * — the world grows smoothly the whole way, and the structure is the SECOND, later
 * signal rather than a second copy of the first.
 *
 * WHAT IS ASSERTED HERE is the floor and the top, through `shellGroups` — the one
 * exported thing that answers "does this world wear a stage, and which". The rest of
 * the component is instanced-mesh plumbing only a GPU can confirm, and
 * `tools/visual.mjs` is where that is checked.
 */

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'w1',
  name: 'Quillon-116',
  owner: 'johnnylesh',
  position: { x: 0, y: 0, z: 0 },
  coreTier: 5,
  coreLevel: 12,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const stageAt = (coreLevel: number): number | null => {
  const groups = shellGroups(planetNodes([world({ coreLevel })]));
  return groups[0]?.index ?? null;
};

describe('D153 the dyson ladder starts at Core 12', () => {
  it('leaves every world below Core 12 bare', () => {
    for (let level = 0; level <= 11; level += 1) {
      expect(stageAt(level), `core ${String(level)}`).toBeNull();
    }
  });

  /** Core 9 used to be the first rung, and is now nine levels of growth short. */
  it('no longer puts a megastructure on a world at Core 9', () => {
    expect(stageAt(9)).toBeNull();
  });

  it('puts the first rung on exactly Core 12', () => {
    expect(stageAt(12)).toBe(0);
    expect(stageAt(13)).toBe(1);
  });

  /** One rung per level, all the way to the top of the game and no further. */
  it('runs one rung a level to the top of the ladder, then clamps', () => {
    expect(stageAt(CORE_TOP_LEVEL)).toBe(CORE_TOP_LEVEL - 12);
    expect(stageAt(CORE_TOP_LEVEL + 4)).toBe(stageAt(CORE_TOP_LEVEL));
  });

  /**
   * NO NEUTRAL WORLD WEARS ONE, and that still falls out rather than being
   * special-cased: the three neutral tiers are seeded well under the first rung, so
   * scenery stays scenery and a ring always means a player.
   */
  it('keeps every neutral world off the ladder', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(
        stageAt(MULTI_WORLD.neutral[tier].buildings.CORE),
        `neutral ${String(tier)}`,
      ).toBeNull();
    }
  });
});
