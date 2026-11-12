import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditSurface, type SurfaceAudit } from '../src/audit.js';

/**
 * A LIST THAT RUNS BELOW THE SCREEN IS MEASURED TO ITS END.
 *
 * 20 rows of 100 px in a 692 px scroller: the audit scrolls, measures each part, and
 * counts every row, the fixed header and the footer exactly once.
 */

const SCROLL = pathToFileURL(fileURLToPath(new URL('./fixtures/scroll.html', import.meta.url))).href;

let browser: Browser;
let full: SurfaceAudit;
let capped: SurfaceAudit;
let long: SurfaceAudit;
let lit: SurfaceAudit;
let padded: SurfaceAudit;

beforeAll(async () => {
  browser = await chromium.launch();
  const open = async (rows = 20, query = '') => {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${SCROLL}?rows=${String(rows)}${query}`);
    return page;
  };
  full = await auditSurface(await open(), { surface: 'scroll', frames: 1, feedback: true, maxParts: 8 });
  capped = await auditSurface(await open(), { surface: 'scroll', frames: 1, maxParts: 2 });
  long = await auditSurface(await open(150), { surface: 'scroll', frames: 1, gridStep: 4 });
  lit = await auditSurface(await open(20, '&active=1'), { surface: 'scroll', frames: 1, feedback: true, maxParts: 8 });
  padded = await auditSurface(await open(20, '&pad=1'), { surface: 'scroll', frames: 1, feedback: true, maxParts: 8 });
}, 180_000);

afterAll(async () => {
  await browser.close();
});

const shown = (audit: SurfaceAudit) => audit.texts.filter((t) => t.rendered).map((t) => t.text);

describe('a scrolled surface', () => {
  it('measures every row once, and the fixed header and footer once', () => {
    const texts = shown(full);
    for (let i = 1; i <= 20; i += 1) expect(texts.filter((t) => t === `Gemi ${String(i)}`)).toHaveLength(1);
    expect(texts.filter((t) => t === 'Filo listesi')).toHaveLength(1);
    expect(texts.filter((t) => t === 'Gönder')).toHaveLength(1);
  });

  it('reaches and presses every button once', () => {
    const buttons = full.targets.filter((t) => t.name.startsWith('Seç'));
    expect(buttons).toHaveLength(20);
    expect(buttons.every((t) => t.region !== null && t.feedback === 'none')).toBe(true);
  });

  it('sees the press answer of a button in every part, not only the first (2026-11-12: later parts pressed a stale twin)', () => {
    const silent = lit.targets.filter((t) => t.name.startsWith('Seç') && t.feedback === 'none').map((t) => t.name);
    expect(silent).toEqual([]);
  });

  it('presses a button again once it shows whole, when the first press reached only a strip of it', () => {
    const silent = padded.targets.filter((t) => t.name.startsWith('Seç') && t.feedback !== 'active').map((t) => t.name);
    expect(silent).toEqual([]);
  });

  it('says how many parts it took, and that it reached the end', () => {
    expect(full.parts).toBeGreaterThanOrEqual(3);
    expect(full.partsCapped).toBe(false);
  });

  it('measures a list of twenty screens to its end without being told a limit', () => {
    expect(long.partsCapped).toBe(false);
    expect(shown(long)).toContain('Gemi 150');
  });

  it('says so when the part limit cut the scroll short', () => {
    expect(capped.parts).toBe(2);
    expect(capped.partsCapped).toBe(true);
    expect(shown(capped)).not.toContain('Gemi 20');
  });
});
