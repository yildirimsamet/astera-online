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
  /** A finished season's record is what a ladder line opens (C21). */
  'leaderboard-archive-profile': async (page) => {
    await page.locator('.gk-arch__row').first().click();
    await page.getByRole('tablist').first().waitFor();
    await page.waitForTimeout(600);
  },
  /** …and the career is the record's second tab. */
  'leaderboard-archive-career': async (page) => {
    await page.locator('.gk-arch__row').first().click();
    await page.getByRole('tab').last().click();
    await page.waitForTimeout(600);
  },
  /** The monument's priced flight is what one picked Citadel brings up (C22). */
  'monument-sheet-quote': async (page) => {
    // the first count is the held wave's recall; the second is the first hull to send
    const count = page.locator('[data-sheet-body] input').nth(1);
    await count.fill('2');
    await count.blur();
    await page.waitForTimeout(1800);
  },
  /** The reading's counts are presses; the monuments' list is what one opens. */
  readout: async (page) => {
    await page.locator('[data-testid="view-caption"] [aria-expanded]').last().click();
    await page.waitForTimeout(400);
  },
};

const memberId = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const soon = (ms: number): string => new Date(Date.now() + ms).toISOString();
/** The leader's lobby: five pilots, four ready (the photograph `tools/arena-team-visual.mjs` takes). */
const lobby = { playerId: memberId(1), clanId: memberId(10), canCreate: false, capacity: 5, claims: [],
  team: { id: memberId(20), state: 'forming', leaderId: memberId(1), joined: true,
    members: ['Yıldırım', 'Aylin', 'Bora', 'Deniz', 'Ece'].map((name, i) => ({ playerId: memberId(i + 1), name,
      ready: i > 0, tactic: i === 0 ? 'radar' : 'smoke', outcome: null, blocked: null,
      ship: { class: ['kilavuz', 'muhafiz', 'akinci'][i % 3], level: 3 + i, fuel: 180 + i * 10, fuelMax: 250, readyAt: null } })) } };
const noTeam = { playerId: memberId(1), clanId: null, canCreate: false, capacity: 5, team: null, claims: [] };

/**
 * Views whose sheet asks a server the gallery does not have (the arena's own process): the same
 * fixed answers `tools/arena-visual.mjs` and `tools/arena-team-visual.mjs` photograph, by path.
 */
export const GALLERY_ANSWERS: Partial<Record<string, Record<string, unknown>>> = {
  'arena-hangar': {
    '/arena/team': noTeam,
    '/arena/hangar': {
      core: 12, minCore: 9,
      ship: { class: 'kilavuz', changeUntil: null, fuel: 250, ammo: 480, hold: [0, 0, 0], readyAt: soon(3_600_000), readyReason: 'repair',
        flying: false, level: 3, xp: 50, xpNext: 150, levelCap: 12, abilities: { radar: 1 }, upgrade: { alloy: 450, crystal: 225, deuterium: 0 } },
      refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 250, alloy: 5000, crystal: 2000,
      cap: { alloy: 5600, crystal: 2800, deuterium: 120 }, sent: { alloy: 100, crystal: 30, deuterium: 0 },
      resetsAt: soon(86_400_000), entryClosesAt: soon(864_000_000),
    },
  },
  'arena-team': { '/arena/team': lobby },
  'clan-arena': { '/arena/team': lobby },
};

/** Answers a view's server questions before it opens; a view with none asks nothing. */
export async function answerGallery(page: Pick<Page, 'route'>, view: string): Promise<void> {
  for (const [path, json] of Object.entries(GALLERY_ANSWERS[view] ?? {})) {
    await page.route((url: URL) => url.pathname === path, (route) => route.fulfill({ json }));
  }
}

export function galleryVisits(base: string, surfaces: readonly Surface[]): Visit[] {
  return surfaces.flatMap((surface) =>
    surface.reach.filter((reach) => reach.startsWith('gallery:')).map((reach) => ({
      surface: surface.id,
      reach,
      open: async (page: Page, lang: string) => {
        const view = reach.slice('gallery:'.length);
        await answerGallery(page, view);
        await page.goto(galleryUrl(base, view, lang), { waitUntil: 'load' });
        await settle(page);
        await GALLERY_STEPS[view]?.(page, lang);
      },
    })),
  );
}
