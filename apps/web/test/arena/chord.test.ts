import { describe, expect, it } from 'vitest';
import { chordAt, chordLink, type Circle } from '../../src/arena/input.js';

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

/** Owner 2026-10-22: the strip that holds both is drawn, joined to both keys. What is drawn is what holds both. */
describe('the link drawn between TURBO and FIRE', () => {
  const link = chordLink(fire, turbo);
  /** A point `s` px along the link from TURBO's centre, `off` px beside it. */
  const point = (s: number, off: number) => ({
    x: link.x + Math.cos(link.angle) * s - Math.sin(link.angle) * off, y: link.y + Math.sin(link.angle) * s + Math.cos(link.angle) * off,
  });

  it('runs from TURBO towards FIRE', () => {
    expect([link.x, link.y]).toEqual([turbo.x, turbo.y]);
    expect(link.angle).toBeCloseTo(Math.atan2(fire.y - turbo.y, fire.x - turbo.x), 9);
  });

  it('holds both keys everywhere inside it', () => {
    for (const s of [link.start + 0.5, (link.start + link.end) / 2, link.end - 0.5]) {
      for (const off of [-link.half + 0.5, 0, link.half - 0.5]) {
        const p = point(s, off);
        expect(chordAt(p.x, p.y, 0, fire, turbo)).toEqual(['fire', 'turbo']);
      }
    }
  });

  it('holds neither key just beside it in the gap between them', () => {
    const gap = (turbo.r + Math.hypot(fire.x - turbo.x, fire.y - turbo.y) - fire.r) / 2;
    for (const off of [-link.half - 1, link.half + 1]) {
      const p = point(gap, off);
      expect(chordAt(p.x, p.y, 0, fire, turbo)).toEqual([]);
    }
  });

  it('starts under TURBO and ends under FIRE, so the keys and the link read as one piece', () => {
    const length = Math.hypot(fire.x - turbo.x, fire.y - turbo.y);
    expect(link.start).toBeLessThan(turbo.r);
    expect(link.end).toBeGreaterThan(length - fire.r);
  });
});
