import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT } from '@astera/rules/arena';
import { altitudeShare, mapGrid, mapPlan, mapPoint, selfTransform } from '../../src/arena/map.js';

/**
 * Owner 2026-10-22 (item 9): a map that opens on a tap and shows where you are, the rough
 * structures, the exits and the entries. It shows places, never ships (15-yarik-haritasi §7).
 */
describe('the Rift map plan', () => {
  it('holds every exit, every entry and every belt of the layout', () => {
    const plan = mapPlan(ARENA_LAYOUT);
    expect(plan.radius).toBe(ARENA_LAYOUT.radius);
    expect(plan.exits).toHaveLength(ARENA_LAYOUT.exits.length);
    expect(plan.entries).toHaveLength(ARENA_LAYOUT.entries.length);
    expect(plan.belts).toHaveLength(ARENA_LAYOUT.fields.length);
  });

  it('marks the heart and its refineries, the three caves (Kovuk, Kanyon, Petek), the station, the wreck, the outposts, the harbour annex and the shipyard; the exit docks only once (as exits)', () => {
    const plan = mapPlan(ARENA_LAYOUT);
    expect([...new Set(plan.landmarks.map(l => l.kind))].sort()).toEqual(['annex', 'canyon', 'cave', 'honeycomb', 'hub', 'outpost', 'refinery', 'station', 'wreck', 'yard']);
    expect(plan.landmarks.filter(l => l.kind === 'annex')).toHaveLength(1);
    expect(plan.landmarks.filter(l => l.kind === 'refinery')).toHaveLength(3);
    expect(plan.landmarks.filter(l => l.kind === 'outpost')).toHaveLength(8);
    expect(plan.landmarks).toHaveLength(ARENA_LAYOUT.structures.filter(s => s.kind !== 'dock').length);
  });

  it('carries nothing about pilots: a plan of places only', () => {
    expect(Object.keys(mapPlan(ARENA_LAYOUT)).sort()).toEqual(['belts', 'dust', 'entries', 'exits', 'landmarks', 'radius']);
  });
});

describe('map projection', () => {
  it('is north-up: +Z is up, and facing +Z the right-hand side (−X) is on the right', () => {
    expect(mapPoint(0, 0)).toEqual({ x: 0, y: 0 });
    expect(mapPoint(0, 100).y).toBeLessThan(0);
    expect(mapPoint(-100, 0).x).toBeGreaterThan(0);
  });

  it('turns the own arrow to the heading: +Z up, +X to the left', () => {
    expect(selfTransform(0, 0, 0, 1)).toBe('translate(0 0) rotate(0)');
    expect(selfTransform(10, 20, 1, 0)).toBe('translate(-10 -20) rotate(-90)');
    expect(selfTransform(0, 0, 0, -1)).toBe('translate(0 0) rotate(180)');
  });

  it('reads altitude from floor (0) to ceiling (1)', () => {
    expect(altitudeShare(0, 1000)).toBe(0.5);
    expect(altitudeShare(-1000, 1000)).toBe(0);
    expect(altitudeShare(5000, 1000)).toBe(1);
  });

  it('spaces its rings and scale bar a fifth of the disc, on a 500 m step: 1 km on the 5.2 km Rift, 2.5 km on the 13 km one', () => {
    expect(mapGrid(5200)).toEqual({ step: 1000, rings: [1000, 2000, 3000, 4000, 5000] });
    expect(mapGrid(13000)).toEqual({ step: 2500, rings: [2500, 5000, 7500, 10000, 12500] });
  });
});
