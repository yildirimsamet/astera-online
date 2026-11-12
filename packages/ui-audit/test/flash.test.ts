import { describe, expect, it } from 'vitest';
import { flashAreaThreshold, flashReport, gridCells, renderFlash, type FlashFrame } from '../src/flash.js';

const FPS = 60;
const CELLS = 16; // a 4×4 grid
const CELL_AREA = 2500; // each cell 50×50 px, the screen 200×200 px

type Rgb = readonly [number, number, number];

/** Frames where `lit(t)` cells of the grid show `on` and the rest `off`. */
function film(seconds: number, colour: (t: number) => Rgb, litCells = CELLS, off: Rgb = [0, 0, 0]): FlashFrame[] {
  const frames: FlashFrame[] = [];
  for (let i = 0; i < seconds * FPS; i += 1) {
    const t = i / FPS;
    const cells = new Float64Array(CELLS * 3);
    for (let c = 0; c < CELLS; c += 1) cells.set(c < litCells ? colour(t) : off, c * 3);
    frames.push({ time: t, cells });
  }
  return frames;
}

const square = (hz: number, on: Rgb, off: Rgb = [0, 0, 0]) => (t: number): Rgb => (Math.floor(t * hz * 2) % 2 === 0 ? off : on);
const OPTIONS = { cellArea: CELL_AREA, areaThreshold: 20_000 };

describe('WCAG 2.3.1 general flash', () => {
  it('fails a full-screen 4 Hz black and white flicker', () => {
    const report = flashReport(film(2, square(4, [255, 255, 255])), OPTIONS);
    expect(report.generalPerSecond).toBe(4);
    expect(report.fails).toBe(true);
  });

  it('passes the same flicker at 3 Hz and below', () => {
    expect(flashReport(film(2, square(3, [255, 255, 255])), OPTIONS).fails).toBe(false);
    expect(flashReport(film(2, square(2, [255, 255, 255])), OPTIONS).generalPerSecond).toBe(2);
  });

  it('passes a fast flicker that covers too little of the view', () => {
    // 4 of 16 cells = 10 000 px², under the 20 000 px² threshold.
    const report = flashReport(film(2, square(10, [255, 255, 255]), 4), OPTIONS);
    expect(report.generalPerSecond).toBe(0);
    expect(report.fails).toBe(false);
  });

  it('does not count bright-to-bright changes, where the darker image is still above 0.8', () => {
    const report = flashReport(film(2, square(10, [255, 255, 255], [240, 240, 240])), OPTIONS);
    expect(report.generalPerSecond).toBe(0);
  });

  it('counts one explosion as one flash', () => {
    const boom = (t: number): Rgb => (t > 0.2 && t < 0.35 ? [255, 255, 255] : [0, 0, 0]);
    expect(flashReport(film(1, boom), OPTIONS).generalPerSecond).toBe(1);
  });

  it('counts a slow fade up and down as one flash, not one per frame', () => {
    const fade = (t: number): Rgb => {
      const v = Math.round(255 * (t < 1 ? t : 2 - t));
      return [v, v, v];
    };
    expect(flashReport(film(2, fade), OPTIONS).generalPerSecond).toBe(1);
  });
});

describe('WCAG 2.3.1 red flash', () => {
  it('counts saturated red flicker on its own counter', () => {
    const report = flashReport(film(2, square(4, [255, 0, 0])), OPTIONS);
    expect(report.redPerSecond).toBe(4);
    expect(report.fails).toBe(true);
  });

  it('does not count an orange that is not saturated red', () => {
    const report = flashReport(film(2, square(4, [255, 160, 0])), OPTIONS);
    expect(report.redPerSecond).toBe(0);
  });
});

describe('the area threshold on a phone', () => {
  it('turns 0.006 sr at the viewing distance into CSS px²', () => {
    // 0.006 × 330² mm² = 653.4 mm²; at 0.17 mm per CSS px that is 22 609 px².
    expect(flashAreaThreshold({ viewingDistanceMm: 330, mmPerCssPx: 0.17 })).toBeCloseTo(22_609, 0);
  });
});

describe('screenshots into cells', () => {
  const raster = (width: number, height: number, pixel: (x: number, y: number) => Rgb) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set([...pixel(x, y), 255], (y * width + x) * 4);
    return { width, height, channels: 4 as const, data };
  };

  it('averages each cell, row by row', () => {
    const cells = gridCells(raster(4, 2, (x) => (x < 2 ? [255, 255, 255] : [0, 0, 0])), 2, 1);
    expect([...cells].map(Math.round)).toEqual([255, 255, 255, 0, 0, 0]);
  });

  it('averages light, not sRGB numbers: half white and half black is half the luminance', () => {
    const [r] = gridCells(raster(2, 1, (x) => (x === 0 ? [255, 255, 255] : [0, 0, 0])), 1, 1);
    expect(r).toBeCloseTo(187.5, 0);
  });

  it('gives the last row and column the pixels a division leaves over', () => {
    const cells = gridCells(raster(5, 1, (x) => (x === 4 ? [255, 0, 0] : [0, 0, 0])), 2, 1);
    expect(cells[3]).toBeGreaterThan(0);
    expect(cells.length).toBe(6);
  });
});

describe('the flash report', () => {
  const markdown = renderFlash([
    { id: 'simulator-battle', what: 'Simülatör tekrarı', seconds: 10, report: { generalPerSecond: 2, redPerSecond: 0, fails: false, worstAt: 3.25 }, error: null },
    { id: 'arena-match', what: 'Arena çatışması', seconds: 10, report: { generalPerSecond: 5, redPerSecond: 1, fails: true, worstAt: 6.5 }, error: null },
    { id: 'jump', what: 'Sıçrama', seconds: 6, report: null, error: 'timeout' },
  ], { date: '2026-11-11', areaThreshold: 22_610, fps: 60, notFilmed: [{ id: 'strategic-blast', why: 'tetikleyici yok', when: 'S22 cihaz turu' }] });

  it('states the assumptions it judged by', () => {
    expect(markdown).toContain('33 cm');
    expect(markdown).toContain('22.610');
    expect(markdown).toContain('60 fps');
  });

  it('gives each moment its rates, its worst second and a verdict', () => {
    expect(markdown).toMatch(/simulator-battle.*\| 2 \| 0 \| 3,25 sn \| Geçti/);
    expect(markdown).toMatch(/arena-match.*\| 5 \| 1 \| 6,5 sn \| \*\*Kaldı\*\*/);
  });

  it('says which moments could not be filmed, why, and when they are looked at instead', () => {
    expect(markdown).toMatch(/jump.*Ölçülemedi: timeout/);
    expect(markdown).toMatch(/strategic-blast.*tetikleyici yok.*S22 cihaz turu/);
  });
});
