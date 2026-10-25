import { describe, expect, it } from 'vitest';
import { chordAt, type Circle } from '../../src/arena/input.js';

/**
 * Owner 2026-10-21: one thumb laid across TURBO and FIRE must hold both. A phone reports
 * that thumb as one point — the middle of the contact — so it lands between the keys.
 * The strip between them holds both; a key's own face holds only that key.
 */
const H = 812;
const fire: Circle = { x: 292, y: H - 78, r: 42 };
const turbo: Circle = { x: 209, y: H - 59, r: 29 };
const along = (t: number) => ({ x: fire.x + (turbo.x - fire.x) * t, y: fire.y + (turbo.y - fire.y) * t });

describe('fire + turbo chord', () => {
  it('holds one key on its own face', () => {
    expect(chordAt(fire.x, fire.y, 0, fire, turbo)).toEqual(['fire']);
    expect(chordAt(turbo.x, turbo.y, 0, fire, turbo)).toEqual(['turbo']);
    expect(chordAt(fire.x + 30, fire.y, 0, fire, turbo)).toEqual(['fire']);
    const nearFireEdge = along(0.3);
    expect(chordAt(nearFireEdge.x, nearFireEdge.y, 0, fire, turbo)).toEqual(['fire']);
  });

  it('holds both when the thumb lands between them', () => {
    const middle = along(0.58);
    expect(chordAt(middle.x, middle.y, 0, fire, turbo)).toEqual(['fire', 'turbo']);
  });

  it('holds nothing well off the line between them', () => {
    const middle = along(0.58);
    expect(chordAt(middle.x, middle.y - 45, 0, fire, turbo)).toEqual([]);
  });

  it('holds both when a flat thumb\'s contact covers both keys', () => {
    const p = along(0.25);
    expect(chordAt(p.x, p.y, 0, fire, turbo)).toEqual(['fire']);
    expect(chordAt(p.x, p.y, 36, fire, turbo)).toEqual(['fire', 'turbo']);
  });
});
