import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rightCover } from '../../src/lib/cover.js';

/**
 * E11 · K10: A PAGE ON THE RIGHT DOES NOT HIDE WHAT THE CAMERA IS LOOKING AT. On a wide
 * screen a page docks as a column over the right of the galaxy, and the camera kept centring
 * its subject on the full width — the selected world, or home, sat under the page's edge.
 * The camera's view is shifted by half of what a right-docked page covers, so its subject
 * sits in the middle of what is still open. A dialog in the middle and a phone's bottom
 * sheet cover nothing to the side.
 */

const canvas = { left: 0, right: 1280 };

describe('what a page covers on the right of the galaxy', () => {
  it('is the width a right-docked page takes from the canvas', () => {
    expect(rightCover(canvas, [{ left: 640, right: 1280 }])).toBe(640);
  });

  it('is measured against the canvas, which starts after the desk outline', () => {
    expect(rightCover({ left: 260, right: 1280 }, [{ left: 560, right: 1280 }])).toBe(720);
  });

  it('is nothing for a dialog standing in the middle', () => {
    expect(rightCover(canvas, [{ left: 384, right: 896 }])).toBe(0);
  });

  it('is nothing for a sheet as wide as the canvas — the phone', () => {
    expect(rightCover({ left: 0, right: 350 }, [{ left: 0, right: 350 }])).toBe(0);
  });

  it('takes the widest page when two are open, and nothing with none', () => {
    expect(rightCover(canvas, [{ left: 840, right: 1280 }, { left: 640, right: 1280 }])).toBe(640);
    expect(rightCover(canvas, [])).toBe(0);
  });

  it('never covers the whole canvas', () => {
    expect(rightCover({ left: 0, right: 700 }, [{ left: 1, right: 700 }])).toBeLessThanOrEqual(700 * 0.8);
  });
});

describe('the galaxy canvas', () => {
  it('shifts its view by what a page covers', () => {
    const source = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
    expect(source).toMatch(/<ViewOffset \/>/);
  });
});
