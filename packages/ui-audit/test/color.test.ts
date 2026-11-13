import { describe, expect, it } from 'vitest';
import { hueFamilies, isNeutral, toOklch } from '../src/color.js';

describe('sRGB to OKLCH', () => {
  it('matches the reference value for pure red', () => {
    const { l, c, h } = toOklch([255, 0, 0]);
    expect(l).toBeCloseTo(0.628, 3);
    expect(c).toBeCloseTo(0.2577, 3);
    expect(h).toBeCloseTo(29.23, 1);
  });

  it('puts greys at zero chroma', () => {
    expect(toOklch([128, 128, 128]).c).toBeCloseTo(0, 4);
  });
});

describe('what counts as a colour', () => {
  it('treats greys and near-greys as neutral', () => {
    expect(isNeutral([128, 128, 128])).toBe(true);
    expect(isNeutral([20, 24, 30])).toBe(true);
    expect(isNeutral([226, 65, 44])).toBe(false);
  });
});

describe('hue families on a surface', () => {
  it('groups close hues, leaves neutrals out and weighs each family by its share', () => {
    const families = hueFamilies([
      { rgb: [226, 65, 44], weight: 3 }, // threat red
      { rgb: [230, 80, 50], weight: 1 }, // a second red, same family
      { rgb: [60, 120, 230], weight: 4 }, // blue
      { rgb: [128, 128, 128], weight: 100 }, // grey: not a colour
    ]);
    expect(families).toHaveLength(2);
    expect(families.map((f) => f.share)).toEqual([0.5, 0.5]);
  });

  it('joins a family across the 0°/360° seam, and only when the hues are close', () => {
    expect(hueFamilies([
      { rgb: [230, 40, 90], weight: 1 }, // h ≈ 13°
      { rgb: [220, 40, 140], weight: 1 }, // h ≈ 353°: 20° away across the seam
    ])).toHaveLength(1);
    expect(hueFamilies([
      { rgb: [235, 50, 70], weight: 1 }, // h ≈ 21°
      { rgb: [220, 40, 160], weight: 1 }, // h ≈ 346°: 35° away
    ])).toHaveLength(2);
  });

  it('has no families for an all-grey surface', () => {
    expect(hueFamilies([{ rgb: [40, 40, 40], weight: 1 }])).toEqual([]);
  });
});
