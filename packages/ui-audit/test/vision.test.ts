import { describe, expect, it } from 'vitest';
import { simulate, simulatePixels, VISION, VISION_KINDS } from '../src/vision.js';

const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));

describe('colour vision deficiency simulation (Machado 2009, full severity)', () => {
  it('covers the three dichromacies the plan names', () => {
    expect(Object.keys(VISION)).toEqual(['protanopia', 'deuteranopia', 'tritanopia']);
  });

  it('leaves greys grey', () => {
    for (const kind of VISION_KINDS) {
      for (const v of [0, 128, 255]) {
        const out = simulate([v, v, v], kind);
        for (const c of out) expect(Math.abs(c - v)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('pulls red and green together for red-green deficiencies, not for tritanopia', () => {
    const red: [number, number, number] = [220, 40, 40];
    const green: [number, number, number] = [40, 180, 60];
    const normal = distance(red, green);
    expect(distance(simulate(red, 'deuteranopia'), simulate(green, 'deuteranopia'))).toBeLessThan(normal * 0.5);
    expect(distance(simulate(red, 'protanopia'), simulate(green, 'protanopia'))).toBeLessThan(normal * 0.5);
    expect(distance(simulate(red, 'tritanopia'), simulate(green, 'tritanopia'))).toBeGreaterThan(normal * 0.5);
  });

  it('pulls blue and green together for tritanopia', () => {
    const blue: [number, number, number] = [40, 120, 220];
    const green: [number, number, number] = [40, 200, 120];
    expect(distance(simulate(blue, 'tritanopia'), simulate(green, 'tritanopia'))).toBeLessThan(distance(blue, green) * 0.6);
  });

  it('darkens pure red for protanopes', () => {
    const [r, g, b] = simulate([255, 0, 0], 'protanopia');
    expect(r + g + b).toBeLessThan(255);
  });

  it('runs over raw RGBA pixels and keeps alpha', () => {
    const pixels = Uint8Array.from([255, 0, 0, 200, 0, 0, 0, 255]);
    const out = simulatePixels(pixels, 4, 'deuteranopia');
    expect(out[3]).toBe(200);
    expect([...out.slice(4)]).toEqual([0, 0, 0, 255]);
    expect([...out.slice(0, 3)]).toEqual(simulate([255, 0, 0], 'deuteranopia'));
  });
});
