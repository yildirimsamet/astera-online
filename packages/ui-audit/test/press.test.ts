import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditPage, type SurfaceAudit } from '../src/audit.js';

/**
 * A PRESS IS CREDITED ONLY WHEN IT CAN BE TOLD APART (review of stage 1, 2026-11-13). A region that
 * moves by itself would differ with no press at all, and a control that acts on pointerdown leaves
 * the screen changed: neither answer is evidence of press feedback, so both say "could not tell".
 */

const PRESS = pathToFileURL(fileURLToPath(new URL('./fixtures/press.html', import.meta.url))).href;

let browser: Browser;
let audit: SurfaceAudit;

beforeAll(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 350, height: 400 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(PRESS);
  audit = await auditPage(page, { surface: 'press', frames: 1, feedback: true });
});

afterAll(async () => {
  await browser.close();
});

const feedback = (key: string) => audit.targets.find((t) => t.key === key)?.feedback;

describe('the press test', () => {
  it('credits a control that answers the touch and lets go', () => {
    expect(feedback('answers')).toBe('immediate');
  });

  it('does not credit a press that changed the screen for good', () => {
    expect(feedback('acts')).toBe('unsure');
  });

  it('does not credit a region that moves by itself', () => {
    expect(feedback('drifts')).toBe('unsure');
  });
});
