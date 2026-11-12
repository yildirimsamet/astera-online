import { describe, expect, it } from 'vitest';
import { hitRegions, rectGap, spacingFailures, type HitSample } from '../src/targets.js';

const STEP = 2;

/** Sample a 120×120 screen every STEP px; later boxes sit on top of earlier ones. */
function sample(boxes: { id: string; x: number; y: number; w: number; h: number }[]): HitSample[] {
  const out: HitSample[] = [];
  for (let y = 0; y < 120; y += STEP) {
    for (let x = 0; x < 120; x += STEP) {
      let target: string | null = null;
      for (const b of boxes) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) target = b.id;
      out.push({ x, y, target });
    }
  }
  return out;
}

describe('hit regions from an elementFromPoint grid', () => {
  it('measures what a finger can actually land on', () => {
    const [region] = hitRegions(sample([{ id: 'a', x: 10, y: 10, w: 40, h: 40 }]), STEP);
    expect(region).toEqual({ target: 'a', area: 1600, box: { left: 10, top: 10, right: 50, bottom: 50 }, width: 40, height: 40, fill: 1 });
  });

  it('shrinks a target that something else covers, and says how much of its box is left', () => {
    const regions = hitRegions(sample([
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'cover', x: 20, y: 20, w: 20, h: 20 },
    ]), STEP);
    const a = regions.find((r) => r.target === 'a');
    expect(a?.area).toBe(1200);
    expect(a?.fill).toBe(0.75);
    expect(a?.width).toBe(40);
  });

  it('ignores points nobody listens on', () => {
    expect(hitRegions(sample([]), STEP)).toEqual([]);
  });
});

describe('the gap between two boxes', () => {
  it('is the straight-line distance between their nearest edges, zero when they touch or overlap', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectGap(a, { left: 14, top: 0, right: 20, bottom: 10 })).toBe(4);
    expect(rectGap(a, { left: 13, top: 14, right: 20, bottom: 20 })).toBe(5);
    expect(rectGap(a, { left: 5, top: 5, right: 20, bottom: 20 })).toBe(0);
  });
});

describe('WCAG 2.5.8: an undersized target needs a clear 24 px circle', () => {
  const box = (id: string, x: number, y: number, w: number, h = w) =>
    ({ target: id, area: w * h, box: { left: x, top: y, right: x + w, bottom: y + h }, width: w, height: h, fill: 1 });

  it('passes small targets spaced so their circles stay apart', () => {
    expect(spacingFailures([box('a', 0, 0, 20), box('b', 30, 0, 20)])).toEqual([]);
  });

  it('fails both small targets when their circles overlap', () => {
    expect(spacingFailures([box('a', 0, 0, 20), box('b', 22, 0, 20)])).toEqual(['a', 'b']);
  });

  it('fails a small target whose circle reaches into a large neighbour', () => {
    expect(spacingFailures([box('small', 0, 0, 20), box('big', 21, 0, 48)])).toEqual(['small']);
    expect(spacingFailures([box('small', 0, 0, 20), box('big', 23, 0, 48)])).toEqual([]);
  });

  it('never fails a target that is 24 px both ways', () => {
    expect(spacingFailures([box('a', 0, 0, 24), box('b', 24, 0, 24)])).toEqual([]);
  });

  it('treats a target thin in one direction as undersized', () => {
    expect(spacingFailures([box('thin', 0, 0, 80, 16), box('under', 0, 18, 80, 16)])).toEqual(['thin', 'under']);
  });
});
