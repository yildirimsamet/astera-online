import { describe, expect, it } from 'vitest';
import { LAST_SEEN, MARK_RANGE, enemyMarked, sighting, type Sighting } from '../../src/arena/marks.js';

/**
 * Owner 2026-10-21: the red box over an enemy shows at 700 m and closer; a ship further out
 * is the pilot's own to spot. The edge arrow and the lead mark keep to the same range.
 */
describe('enemy marks', () => {
  it('reach 700 m and no further', () => {
    expect(MARK_RANGE).toBe(700);
    expect(enemyMarked({ landed: 0, mining: false }, 700)).toBe(true);
    expect(enemyMarked({ landed: 0, mining: false }, 701)).toBe(false);
  });

  it('no longer show a far miner by its beam: the beam itself is what gives it away', () => {
    expect(enemyMarked({ landed: 3, mining: true }, 650)).toBe(true);
    expect(enemyMarked({ landed: 3, mining: true }, 900)).toBe(false);
  });

  it('keep a landed pilot that is not mining quiet beyond 320 m', () => {
    expect(enemyMarked({ landed: 3, mining: false }, 320)).toBe(true);
    expect(enemyMarked({ landed: 3, mining: false }, 321)).toBe(false);
  });
});

/**
 * Owner 2026-10-22 (15-yarik-haritasi §6): rock cuts the marks. A ship that slips behind stone
 * leaves its bracket and map dot at the point it was last seen, fading out over LAST_SEEN
 * seconds: the pursuer knows where it went in, not where it is now.
 */
describe('last seen', () => {
  it('follows a ship in sight at full strength', () => {
    const memory = new Map<number, Sighting>();
    expect(sighting(memory, 4, true, { x: 1, y: 2, z: 3 }, 10)).toMatchObject({ x: 1, y: 2, z: 3, level: 1 });
    expect(sighting(memory, 4, true, { x: 5, y: 2, z: 3 }, 10.5)).toMatchObject({ x: 5, level: 1 });
  });

  it('stays where the ship went behind rock and fades over LAST_SEEN seconds, then is gone', () => {
    expect(LAST_SEEN).toBe(2);
    const memory = new Map<number, Sighting>();
    sighting(memory, 4, true, { x: 100, y: 0, z: 0 }, 10);
    const half = sighting(memory, 4, false, { x: 160, y: 0, z: 0 }, 11);
    expect(half).toMatchObject({ x: 100, y: 0, z: 0 });
    expect(half?.level).toBeCloseTo(0.5);
    expect(sighting(memory, 4, false, { x: 200, y: 0, z: 0 }, 12)).toBeUndefined();
    expect(memory.has(4)).toBe(false);
  });

  it('never invents a mark for a ship it has not seen', () => {
    expect(sighting(new Map(), 4, false, { x: 1, y: 2, z: 3 }, 10)).toBeUndefined();
  });

  it('comes back at full strength, on the live point, when the ship comes out', () => {
    const memory = new Map<number, Sighting>();
    sighting(memory, 4, true, { x: 0, y: 0, z: 0 }, 10);
    sighting(memory, 4, false, { x: 50, y: 0, z: 0 }, 11);
    expect(sighting(memory, 4, true, { x: 90, y: 0, z: 0 }, 11.2)).toMatchObject({ x: 90, level: 1 });
  });
});
