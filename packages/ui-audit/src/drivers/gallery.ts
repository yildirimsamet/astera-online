/**
 * THE GALLERY: EVERY SHEET WITH FIXTURE DATA, NO ACCOUNT, NO SERVER.
 *
 * apps/web/v2-gallery.html draws one view per `?view=`, in the language of `?lng=`. Its
 * API never answers, so a sheet shows what a player sees before the network does.
 */

import type { Page } from 'playwright';
import type { Surface } from '../inventory.js';
import type { Visit } from '../run.js';
import { phrase } from './phrase.js';

export const galleryUrl = (base: string, view: string, lang: string): string =>
  `${base}/v2-gallery.html?lng=${encodeURIComponent(lang)}&view=${encodeURIComponent(view)}`;

/** Fonts in, entrance animations over, and something on the page (in `root`, a selector). */
export async function settle(page: Page, root = '#root'): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(1200);
  const empty = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    return !(element instanceof HTMLElement) || (element.innerText.trim() === '' && !element.querySelector('canvas, svg, img'));
  }, root);
  if (empty) throw new Error('empty surface: nothing rendered');
}

/** Views whose surface appears only after a press. */
export const GALLERY_STEPS: Partial<Record<string, (page: Page, lang: string) => Promise<void>>> = {
  /** The shop opens first; the trial bar is what "try on my world" brings up. */
  'cosmetic-trial': async (page, lang) => {
    await page.getByRole('button', { name: await phrase(lang, 'skins', 'skins.tryOnWorld'), exact: true }).click();
    await page.locator('[data-cosmetic-trial]').waitFor();
    await page.waitForTimeout(1200);
  },
  /** The reading's counts are presses; the monuments' list is what one opens. */
  readout: async (page) => {
    await page.locator('[data-testid="view-caption"] [aria-expanded]').last().click();
    await page.waitForTimeout(400);
  },
};

export function galleryVisits(base: string, surfaces: readonly Surface[]): Visit[] {
  return surfaces.flatMap((surface) =>
    surface.reach.filter((reach) => reach.startsWith('gallery:')).map((reach) => ({
      surface: surface.id,
      reach,
      open: async (page: Page, lang: string) => {
        const view = reach.slice('gallery:'.length);
        await page.goto(galleryUrl(base, view, lang), { waitUntil: 'load' });
        await settle(page);
        await GALLERY_STEPS[view]?.(page, lang);
      },
    })),
  );
}
