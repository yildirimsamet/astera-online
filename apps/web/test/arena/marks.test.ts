import { describe, expect, it } from 'vitest';
import { SCANNED } from '@astera/rules/arena';
import { LAST_SEEN, MARK_RANGE, enemyMarked, sighting, threatPointed, type Sighting, edgePoint } from '../../src/arena/marks.js';

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
 * Owner 2026-10-27: a lock or a missile on the pilot is pointed at on screen; a radar sweep is
 * only told ("Tarandın"). Its source is never drawn, or the sweep would give its pilot away.
 */
describe('incoming warning marker', () => {
  it('points at a lock building, a held lock and a missile, never at a sweep or nothing', () => {
    expect([1, 2, 3].map(threatPointed)).toEqual([true, true, true]);
    expect(threatPointed(SCANNED)).toBe(false);
    expect(threatPointed(0)).toBe(false);
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

/** F10/F13 (S22 2026-10-26): the exit arrow's name ran under the throttle, and an exit behind sat on the nose. */
describe('an edge arrow', () => {
  const band = { width: 360, top: 205, bottom: 397 };
  const cx = 180; const cy = 301; const rx = 360 / 2 - 30 - 18;

  it('rides the ellipse of the free band, and says which side it is on', () => {
    const right = edgePoint(900, cy, false, 30, band);
    expect([Math.round(right.x), Math.round(right.y), right.side]).toEqual([cx + rx, cy, 'right']);
    expect(edgePoint(-500, cy, false, 30, band).side).toBe('left');
  });

  it('keeps a point behind at the bottom unless asked to put it on a side', () => {
    expect(Math.round(edgePoint(cx, cy - 50, true, 30, band).y)).toBe(397);
    const aside = edgePoint(cx, cy - 50, true, 30, band, true);
    expect([Math.round(aside.x), aside.side]).toEqual([cx + rx, 'right']);
    expect(Math.abs(aside.y - cy)).toBeLessThan(30);
    // Behind and to the left stays on the left, and its arrow points out of that side.
    const left = edgePoint(cx + 120, cy, true, 30, band, true);
    expect([Math.round(left.x), left.side, Math.round(Math.abs(left.angle) * 100)]).toEqual([cx - rx, 'left', 314]);
  });
});
