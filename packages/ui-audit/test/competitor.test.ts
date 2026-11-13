import { describe, expect, it } from 'vitest';
import { emFromInk, inkLines, inkShape, regionAt, size, S22, type Raster } from '../src/competitor.js';
import { isScreens, itemShape, joinsMarks } from '../src/competitorSheet.js';

/** A grey canvas with filled rectangles painted on it. */
function canvas(width: number, height: number, background: [number, number, number], rects: { x: number; y: number; w: number; h: number; rgb: [number, number, number] }[]): Raster {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) data.set(background, i * 3);
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) data.set(r.rgb, (y * width + x) * 3);
  return { width, height, channels: 3, data };
}

describe('text line heights in a crop', () => {
  // Two "lines" of glyph strokes: 12 px tall at y 10, 30 px tall at y 40, on a dark panel.
  const raster = canvas(100, 100, [20, 30, 50], [
    { x: 10, y: 10, w: 3, h: 12, rgb: [230, 230, 230] }, { x: 20, y: 12, w: 3, h: 10, rgb: [230, 230, 230] },
    { x: 10, y: 40, w: 4, h: 30, rgb: [240, 200, 60] },
  ]);

  it('finds each line and its ink height', () => {
    expect(inkLines(raster, { x: 0, y: 0, w: 100, h: 100 })).toEqual([{ top: 10, bottom: 21, height: 12 }, { top: 40, bottom: 69, height: 30 }]);
  });

  it('reads only inside the box, and takes the box background as the most common shade', () => {
    expect(inkLines(raster, { x: 0, y: 35, w: 50, h: 50 })).toEqual([{ top: 40, bottom: 69, height: 30 }]);
  });

  it('keeps a dot or mark that floats clear of its letters in the same line (İ, Ü, Ç)', () => {
    const marked = canvas(60, 60, [20, 30, 50], [
      { x: 10, y: 10, w: 3, h: 3, rgb: [230, 230, 230] },
      { x: 10, y: 15, w: 3, h: 20, rgb: [230, 230, 230] },
      { x: 20, y: 37, w: 3, h: 2, rgb: [230, 230, 230] },
    ]);
    expect(inkLines(marked, { x: 0, y: 0, w: 60, h: 60 }, { joinMarks: true })).toEqual([{ top: 10, bottom: 38, height: 29 }]);
  });

  it('leaves small shapes apart unless asked: in a box without marks they are icons or rules, not letters', () => {
    const iconed = canvas(60, 60, [20, 30, 50], [{ x: 10, y: 15, w: 3, h: 20, rgb: [230, 230, 230] }, { x: 20, y: 37, w: 6, h: 4, rgb: [230, 230, 230] }]);
    expect(inkLines(iconed, { x: 0, y: 0, w: 60, h: 60 })).toEqual([{ top: 15, bottom: 34, height: 20 }, { top: 37, bottom: 40, height: 4 }]);
  });

  it('ignores a shade too close to the background to be text', () => {
    const faint = canvas(40, 40, [20, 30, 50], [{ x: 5, y: 5, w: 3, h: 20, rgb: [40, 50, 70] }]);
    expect(inkLines(faint, { x: 0, y: 0, w: 40, h: 40 })).toEqual([]);
  });
});

describe('a button found from a point inside it', () => {
  const raster = canvas(300, 200, [10, 10, 10], [
    { x: 50, y: 60, w: 200, h: 70, rgb: [70, 190, 90] },
    { x: 120, y: 85, w: 60, h: 20, rgb: [255, 255, 255] },
  ]);

  it('fills around its label and returns its box', () => {
    expect(regionAt(raster, { x: 60, y: 70 })).toEqual({ x: 50, y: 60, w: 200, h: 70 });
  });
});

describe('sizes on the S22', () => {
  it('turns screenshot pixels into dp and millimetres on the axis measured', () => {
    expect(S22).toMatchObject({ density: 3 });
    const tall = size(48, 'portrait');
    expect(tall.dp).toBe(16);
    expect(tall.mm).toBeCloseTo((48 * 25.4) / 424.542, 3);
    expect(size(48, 'landscape').mm).toBeCloseTo((48 * 25.4) / 428.625, 3);
  });

  it('measures widths on the other axis', () => {
    expect(size(48, 'portrait', 'horizontal').mm).toBeCloseTo((48 * 25.4) / 428.625, 3);
    expect(size(48, 'landscape', 'horizontal').mm).toBeCloseTo((48 * 25.4) / 424.542, 3);
  });

  it('reads our own DPR 2 screenshots as the S22 would show them: one CSS px, one dp', () => {
    const ours = size(20, 'portrait', 'vertical', 2);
    expect(ours.dp).toBe(10);
    expect(ours.mm).toBeCloseTo((10 * 3 * 25.4) / 424.542, 3);
  });
});

describe('font size from ink height', () => {
  it('tells what part of the em a line of text inks', () => {
    expect(inkShape('240')).toBe('caps');
    expect(inkShape('Barınak 5')).toBe('caps');
    expect(inkShape('Kahramanlar')).toBe('caps');
    expect(inkShape('Savaşçıların uyudukları yer.')).toBe('full');
    expect(inkShape('(0 / 1)')).toBe('full');
    expect(inkShape('1 / 3')).toBe('full');
    expect(inkShape('Süre')).toBe('caps');
    expect(inkShape('ÜSTÜN')).toBe('accented');
    expect(inkShape('ana orman')).toBe('lower');
  });

  it('estimates the em from the ink of each shape', () => {
    expect(emFromInk(36, 'caps')).toBeCloseTo(50, 0);
    expect(emFromInk(36, 'full')).toBeCloseTo(36 / 0.95, 1);
    expect(emFromInk(26, 'lower')).toBeCloseTo(50, 0);
  });
});

describe('a spec line whose font draws a mark differently', () => {
  const screen = (item: Record<string, unknown>) => [{ game: 'g', screen: 's', file: 'f.png', items: [{ label: 'l', text: '1/3', box: [0, 0, 10, 10], ...item }] }];

  it('joins floating marks only for text that has them', () => {
    expect(joinsMarks('accented')).toBe(true);
    expect(joinsMarks('caps')).toBe(false);
    expect(joinsMarks('full')).toBe(false);
  });

  it('takes a shape named in the spec over the guess from the text', () => {
    // Supercell's face draws "/" at cap height; Archivo draws it full height (the guess).
    expect(itemShape({ text: '1/3', shape: 'caps' })).toBe('caps');
    expect(itemShape({ text: '1/3' })).toBe('full');
  });

  it('accepts only the known shapes in a spec', () => {
    expect(isScreens(screen({ shape: 'caps' }))).toBe(true);
    expect(isScreens(screen({}))).toBe(true);
    expect(isScreens(screen({ shape: 'bold' }))).toBe(false);
  });
});
