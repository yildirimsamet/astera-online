import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT } from '@astera/rules/arena';
import { arenaCopy } from '../../src/arena/copy.js';
import { declutter, landmarkSight, placePriority, placesOf } from '../../src/arena/landmarks.js';

/**
 * Owner 2026-10-22: small markers on the named places (Yarık Kalbi, Kovuk, …), like the exit's
 * but smaller and never pinned to the screen edge: a place shows only while you look its way.
 */
describe('place markers', () => {
  it('names every place but the exit docks, which have their own marker', () => {
    const places = placesOf(ARENA_LAYOUT);
    const kinds = new Set(places.map(p => p.kind));
    for (const kind of ['hub', 'cave', 'station', 'wreck', 'yard', 'outpost'] as const) expect(kinds.has(kind)).toBe(true);
    expect(places.some(p => (p.kind as string) === 'dock')).toBe(false);
    for (const place of places) expect(arenaCopy().landmarks[place.kind]).toBeTruthy();
  });

  const eye = { x: 0, y: 0, z: 0 }; const ahead = { x: 0, y: 0, z: 1 };
  const at = (degrees: number, distance = 2000) => ({ x: Math.sin(degrees * Math.PI / 180) * distance, y: 0, z: Math.cos(degrees * Math.PI / 180) * distance });

  it('shows a place straight ahead in full, and fades it out as the view turns away', () => {
    expect(landmarkSight(eye, ahead, at(0), 200)).toBe(1);
    expect(landmarkSight(eye, ahead, at(15), 200)).toBe(1);
    const side = landmarkSight(eye, ahead, at(28), 200);
    expect(side).toBeGreaterThan(0); expect(side).toBeLessThan(1);
    expect(landmarkSight(eye, ahead, at(40), 200)).toBe(0);
    expect(landmarkSight(eye, ahead, at(180), 200)).toBe(0);
  });

  it('hides the place you are already at', () => {
    expect(landmarkSight(eye, ahead, at(0, 150), 200)).toBe(0);
    expect(landmarkSight(eye, ahead, at(0, 230), 200)).toBe(0);
    expect(landmarkSight(eye, ahead, at(0, 400), 200)).toBe(1);
  });

  it('leaves out places across the map: a far name ahead is clutter, not a heading', () => {
    expect(landmarkSight(eye, ahead, at(0, 5000), 200)).toBe(1);
    const far = landmarkSight(eye, ahead, at(0, 7000), 200);
    expect(far).toBeGreaterThan(0); expect(far).toBeLessThan(1);
    expect(landmarkSight(eye, ahead, at(0, 9000), 200)).toBe(0);
  });

  it('keeps the nearer of two names that would print over each other', () => {
    const shown = declutter([
      { x: 100, y: 300, distance: 3000 }, { x: 120, y: 305, distance: 1500 }, { x: 260, y: 300, distance: 4000 },
    ], 44);
    expect(shown).toEqual([false, true, true]);
  });

  it('gives a landmark the word over a nearer outpost or refinery', () => {
    expect(placePriority('hub', 3000)).toBeLessThan(placePriority('refinery', 2300));
    expect(placePriority('outpost', 900)).toBeLessThan(placePriority('outpost', 1200));
    expect(placePriority('cave', 1000)).toBeLessThan(placePriority('cave', 2000));
  });
});
