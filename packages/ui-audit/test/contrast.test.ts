import { describe, expect, it } from 'vitest';
import { apcaContrast, composite, contrastRatio, relativeLuminance, textContrast } from '../src/contrast.js';

const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;

/** `count` copies of one RGBA pixel, laid out the way a decoded screenshot is. */
const pixels = (...runs: [rgb: readonly [number, number, number], count: number][]) => {
  const out: number[] = [];
  for (const [[r, g, b], count] of runs) for (let i = 0; i < count; i += 1) out.push(r, g, b, 255);
  return { data: Uint8Array.from(out), channels: 4 as const };
};

describe('WCAG relative luminance and contrast', () => {
  it('puts white at 1, black at 0 and mid grey where the sRGB curve does', () => {
    expect(relativeLuminance(WHITE)).toBe(1);
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance([128, 128, 128])).toBeCloseTo(0.2159, 4);
  });

  it('reproduces the reference ratios, in either order', () => {
    expect(contrastRatio(BLACK, WHITE)).toBe(21);
    expect(contrastRatio([0x77, 0x77, 0x77], WHITE)).toBeCloseTo(4.48, 2);
    expect(contrastRatio(WHITE, [0x76, 0x76, 0x76])).toBeCloseTo(4.54, 2);
  });
});

describe('alpha compositing (browsers blend in sRGB space)', () => {
  it('blends half white over black to mid grey', () => {
    expect(composite(WHITE, 0.5, BLACK)).toEqual([127.5, 127.5, 127.5]);
  });

  it('leaves the background untouched at zero alpha and replaces it at one', () => {
    expect(composite(WHITE, 0, [10, 20, 30])).toEqual([10, 20, 30]);
    expect(composite([1, 2, 3], 1, [10, 20, 30])).toEqual([1, 2, 3]);
  });
});

describe('APCA 0.0.98G-4g', () => {
  it('matches the published black-on-white and white-on-black values', () => {
    expect(apcaContrast(BLACK, WHITE)).toBeCloseTo(106.04, 1);
    expect(apcaContrast(WHITE, BLACK)).toBeCloseTo(-107.88, 1);
  });

  it('reads zero for text that is the background colour', () => {
    expect(apcaContrast([90, 90, 90], [90, 90, 90])).toBe(0);
  });
});

describe('text contrast against the real pixels behind it', () => {
  it('reports the worst pixel, the worst five percent and the median separately', () => {
    // 96 black pixels and 4 white ones behind white text: a few stars behind a label.
    const result = textContrast({ rgb: WHITE, alpha: 1 }, pixels([BLACK, 96], [WHITE, 4]));
    expect(result.min).toBe(1);
    expect(result.p5).toBe(21);
    expect(result.median).toBe(21);
  });

  it('lets the worst five percent fall once one pixel in twenty is bad', () => {
    const result = textContrast({ rgb: WHITE, alpha: 1 }, pixels([BLACK, 95], [WHITE, 5]));
    expect(result.p5).toBe(1);
  });

  it('dims the text by its alpha before measuring', () => {
    const result = textContrast({ rgb: WHITE, alpha: 0.5 }, pixels([BLACK, 10]));
    expect(result.median).toBeCloseTo(5.28, 2);
  });

  it('reads RGB screenshots as well as RGBA ones', () => {
    const rgb = { data: Uint8Array.from([0, 0, 0, 0, 0, 0]), channels: 3 as const };
    expect(textContrast({ rgb: WHITE, alpha: 1 }, rgb).min).toBe(21);
  });

  it('carries the APCA reading of the worst five percent, as a magnitude', () => {
    const result = textContrast({ rgb: WHITE, alpha: 1 }, pixels([BLACK, 20]));
    expect(result.apcaP5).toBeCloseTo(107.88, 1);
  });

  it('refuses an empty background rather than inventing a number', () => {
    expect(() => textContrast({ rgb: WHITE, alpha: 1 }, { data: new Uint8Array(0), channels: 4 })).toThrow(/no background pixels/);
  });
});
