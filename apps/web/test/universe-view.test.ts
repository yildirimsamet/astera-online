import { mainOffsetOf, starterGalaxyCentre, toWorld } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { UNIVERSE_CLOSE_SHARE, declutterLabels, nextOverscroll, universeBalls, universeFrame } from '../src/galaxy/universe.js';

const galaxies = [{ ordinal: 1, ships: 12 }, { ordinal: 2, ships: 30 }, { ordinal: 3, ships: 1 }];
const away = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('the balls of the universe view', () => {
  it('stand at each galaxy\'s real place, from a commander in the main galaxy', () => {
    const balls = universeBalls(galaxies, null, { x: 0, y: 0, z: 0 });
    expect(balls[1]!.position).toEqual(toWorld(starterGalaxyCentre(2)));
    expect(balls.every(ball => !ball.own)).toBe(true);
  });

  it('put a ship\'s own galaxy where the ship is, and the rest around the main galaxy', () => {
    const balls = universeBalls(galaxies, 1, mainOffsetOf(1));
    expect(balls[0]!.own).toBe(true);
    expect(away(balls[0]!.position, [0, 0, 0])).toBeLessThan(0.001);
    const main = toWorld(mainOffsetOf(1));
    expect(away(balls[1]!.position, main)).toBeCloseTo(away(toWorld(starterGalaxyCentre(2)), [0, 0, 0]), 3);
  });

  it('grow with the ships in them, within bounds, so that a full one reads larger', () => {
    const balls = universeBalls(galaxies, null, { x: 0, y: 0, z: 0 });
    expect(balls[1]!.size).toBeGreaterThan(balls[0]!.size);
    expect(balls[0]!.size).toBeGreaterThan(balls[2]!.size);
    expect(balls[2]!.size).toBeGreaterThan(0);
  });

  it('always show a ship its own galaxy, even if the count has not caught up', () => {
    const balls = universeBalls([{ ordinal: 2, ships: 3 }], 1, mainOffsetOf(1));
    expect(balls.find(ball => ball.own)?.ordinal).toBe(1);
  });
});

describe('the frame of the universe view', () => {
  const phone = 350 / 670, desk = 1440 / 820;

  it('turns around the main galaxy', () => {
    expect(universeFrame(universeBalls(galaxies, 1, mainOffsetOf(1)), mainOffsetOf(1), desk).centre).toEqual(toWorld(mainOffsetOf(1)));
  });

  it('holds every galaxy in sight, on a phone as on a desk', () => {
    const offset = { x: 0, y: 0, z: 0 };
    const balls = universeBalls(galaxies, null, offset);
    const reach = Math.max(...balls.map(ball => away(ball.position, [0, 0, 0])));
    for (const aspect of [phone, desk]) {
      const half = Math.atan(Math.tan((45 / 2) * Math.PI / 180) * Math.min(1, aspect));
      expect(universeFrame(balls, offset, aspect).distance * Math.tan(half)).toBeGreaterThan(reach);
    }
  });

  it('stands further back on a narrow screen', () => {
    const balls = universeBalls(galaxies, null, { x: 0, y: 0, z: 0 });
    expect(universeFrame(balls, { x: 0, y: 0, z: 0 }, phone).distance).toBeGreaterThan(universeFrame(balls, { x: 0, y: 0, z: 0 }, desk).distance);
  });

  describe('its angle', () => {
    const many = Array.from({ length: 28 }, (_, i) => ({ ordinal: i + 1, ships: 20 }));
    const sideways = (position: readonly number[], centre: readonly number[], direction: readonly number[]) => {
      const rel = [position[0]! - centre[0]!, position[1]! - centre[1]!, position[2]! - centre[2]!] as const;
      const along = rel[0] * direction[0]! + rel[1] * direction[1]! + rel[2] * direction[2]!;
      return Math.sqrt(Math.max(0, rel[0] ** 2 + rel[1] ** 2 + rel[2] ** 2 - along ** 2));
    };

    it('never hides your galaxy in front of or behind the main one, wherever you are', () => {
      for (const mine of [1, 3, 7, 12, 19, 28, 29, 40]) {
        const offset = mainOffsetOf(mine);
        const balls = universeBalls(many, mine, offset);
        const frame = universeFrame(balls, offset, phone);
        const own = balls.find(ball => ball.own)!;
        expect(sideways(own.position, frame.centre, frame.direction)).toBeGreaterThan(90);
      }
    });

    it('leaves most galaxies clear of the main one', () => {
      const balls = universeBalls(many, null, { x: 0, y: 0, z: 0 });
      const frame = universeFrame(balls, { x: 0, y: 0, z: 0 }, phone);
      const clear = balls.filter(ball => sideways(ball.position, frame.centre, frame.direction) > 90);
      expect(clear.length).toBeGreaterThanOrEqual(balls.length * 0.75);
    });

    it('is a unit direction from above, which the controls can hold', () => {
      const [x, y, z] = universeFrame(universeBalls(galaxies, 1, mainOffsetOf(1)), mainOffsetOf(1), desk).direction;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
      expect(y).toBeGreaterThan(0.2);
      expect(y).toBeLessThan(0.85);
    });
  });

  it('closes on the way back in, well before the view is lost', () => {
    expect(UNIVERSE_CLOSE_SHARE).toBeGreaterThan(0.3);
    expect(UNIVERSE_CLOSE_SHARE).toBeLessThan(0.8);
  });
});

describe('zooming out past the limit', () => {
  it('does nothing while the camera can still go further', () => {
    expect(nextOverscroll(0.9, 0.5, false)).toEqual({ held: 0, open: false });
  });

  it('builds up at the limit, and one small tick is not enough', () => {
    const first = nextOverscroll(0, 0.34, true);
    expect(first.open).toBe(false);
    expect(first.held).toBeCloseTo(0.34);
  });

  it('opens after a little more', () => {
    expect(nextOverscroll(0.7, 0.34, true).open).toBe(true);
  });

  it('starts over after opening', () => {
    expect(nextOverscroll(0.7, 0.34, true).held).toBe(0);
  });

  it('starts over when the gesture zooms back in', () => {
    expect(nextOverscroll(0.7, -0.1, true)).toEqual({ held: 0, open: false });
  });
});

describe('the names over the balls', () => {
  const at = (id: number, x: number, y: number) => ({ id, x, y });
  const box = { width: 60, height: 26 };

  it('shows every name that has room', () => {
    expect(declutterLabels([at(1, 0, 0), at(2, 100, 0), at(3, 0, 100)], box)).toEqual(new Set([1, 2, 3]));
  });

  it('gives the first in the list the place when two collide', () => {
    expect(declutterLabels([at(1, 0, 0), at(2, 30, 10)], box)).toEqual(new Set([1]));
  });

  it('measures from what is shown, so that a hidden name does not hide another', () => {
    expect(declutterLabels([at(1, 0, 0), at(2, 50, 0), at(3, 100, 0)], box)).toEqual(new Set([1, 3]));
  });
});
