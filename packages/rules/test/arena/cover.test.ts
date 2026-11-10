import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT as layout, obstacleSize } from '../../src/arena/index.js';

describe('open-space maneuver cover', () => {
  // Cover follows the last crystal; resource-bearing obstacles retain their existing ids.
  const rocks = layout.obstacles.slice(layout.obstacles.findLastIndex(o => o.kind === 'crystal') + 1);
  const gap = (a: typeof rocks[number], b: typeof rocks[number]) => Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y, a.p.z - b.p.z) - a.radius - b.radius;

  it('adds small and large solid rocks throughout the flight plane without adding deposits', () => {
    expect(rocks.length).toBeGreaterThan(350);
    expect(rocks.every(o => o.kind === 'rock' && o.shape === 'mesh')).toBe(true);
    expect(Math.min(...rocks.map(o => obstacleSize(layout, o)))).toBeLessThan(20);
    expect(Math.max(...rocks.map(o => obstacleSize(layout, o)))).toBeGreaterThan(60);
    for (const rock of rocks) {
      expect(layout.deposits).not.toContain(rock.id);
      for (const farm of layout.farmSpots) expect(Math.hypot(rock.p.x - farm.x, rock.p.y - farm.y, rock.p.z - farm.z) - rock.radius).toBeGreaterThan(45);
    }
  });

  it('forms singles, pairs, triples and groups of five with flyable gaps between them', () => {
    const remaining = new Set(rocks); const sizes: number[] = [];
    while (remaining.size > 0) {
      const first = remaining.values().next().value;
      if (!first) break;
      const group = [first]; remaining.delete(first);
      for (const from of group) {
        for (const other of remaining) if (gap(from, other) < 160) { remaining.delete(other); group.push(other); }
      }
      sizes.push(group.length);
      for (const a of group) for (const b of group) if (a !== b) expect(gap(a, b)).toBeGreaterThanOrEqual(45);
    }
    expect(new Set(sizes)).toEqual(new Set([1, 2, 3, 5]));
  });
});
