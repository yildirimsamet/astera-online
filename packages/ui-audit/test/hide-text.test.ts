import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditPage, type SurfaceAudit } from '../src/audit.js';

/**
 * HIDING THE LETTERS LEAVES THE GROUND AS THE PLAYER SEES IT (review of stage 1, 2026-11-13).
 * Contrast is measured against an image with the text hidden. Hiding it by making the colour
 * transparent also erased plates drawn in the text's own colour, so a white word on a light plate
 * was measured against black and passed.
 */

const PLATE = pathToFileURL(fileURLToPath(new URL('./fixtures/plate.html', import.meta.url))).href;

let browser: Browser;
let audit: SurfaceAudit;

beforeAll(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 350, height: 200 }, deviceScaleFactor: 2 });
  await page.goto(PLATE);
  audit = await auditPage(page, { surface: 'plate', frames: 1 });
});

afterAll(async () => {
  await browser.close();
});

describe('the hidden-text ground', () => {
  it('keeps a plate drawn in the text colour', () => {
    const plate = audit.texts.find((t) => t.key === 'plate');
    expect(plate?.contrast?.p5).toBeLessThan(4.5);
  });
});
