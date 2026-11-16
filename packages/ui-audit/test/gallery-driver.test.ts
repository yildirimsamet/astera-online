import { describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { GALLERY_ANSWERS, GALLERY_STEPS, answerGallery, galleryUrl, galleryVisits } from '../src/drivers/gallery.js';
import { KIT_SURFACES, SURFACES } from '../src/inventory.js';

describe('the gallery driver', () => {
  it('opens one view in one language', () => {
    expect(galleryUrl('http://127.0.0.1:5231', 'rewards-ready', 'ja')).toBe('http://127.0.0.1:5231/v2-gallery.html?lng=ja&view=rewards-ready');
  });

  it('visits every gallery way in the inventory, under its own surface', () => {
    const visits = galleryVisits('http://x', SURFACES);
    const expected = SURFACES.flatMap((s) => s.reach.filter((r) => r.startsWith('gallery:')).map((r) => `${s.id} ${r}`));
    expect(visits.map((v) => `${v.surface} ${v.reach}`)).toEqual(expected);
  });

  it('visits the kit views under the kit surface', () => {
    expect(galleryVisits('http://x', KIT_SURFACES).map((v) => `${v.surface} ${v.reach}`)).toEqual(
      ['ui-kit', 'ui-kit-launch', 'ui-kit-base', 'ui-kit-hud', 'ui-kit-list', 'ui-kit-report'].map((view) => `kit gallery:${view}`),
    );
  });

  it('has steps only for views the inventory visits', () => {
    const views = new Set(SURFACES.flatMap((s) => s.reach).filter((r) => r.startsWith('gallery:')).map((r) => r.slice('gallery:'.length)));
    expect(Object.keys(GALLERY_STEPS).filter((view) => !views.has(view))).toEqual([]);
  });

  it('has fixed answers only for views the inventory visits', () => {
    const views = new Set(SURFACES.flatMap((s) => s.reach).filter((r) => r.startsWith('gallery:')).map((r) => r.slice('gallery:'.length)));
    expect(Object.keys(GALLERY_ANSWERS).filter((view) => !views.has(view))).toEqual([]);
  });

  /** G12 (2026-11-16): the arena's hangar and team ask the arena server; the gallery has none, so the audit measured an error line. */
  it('answers the arena’s hangar and team before the view opens', async () => {
    expect(Object.keys(GALLERY_ANSWERS['arena-hangar'] ?? {}).sort()).toEqual(['/arena/hangar', '/arena/team']);
    expect(GALLERY_ANSWERS['arena-team']?.['/arena/team']).toMatchObject({ team: { state: 'forming', joined: true } });
    const answered: string[] = [];
    const page: Pick<Page, 'route'> = {
      route: (match: string | RegExp | ((url: URL) => boolean)) => {
        if (typeof match === 'function') answered.push(['/arena/hangar', '/arena/team', '/arena/ship'].filter((path) => match(new URL(`http://x${path}`))).join(','));
        // what Playwright hands back: a handle that removes the route
        const done = (): Promise<void> => Promise.resolve();
        return Promise.resolve({ dispose: done, [Symbol.asyncDispose]: done });
      },
    };
    await answerGallery(page, 'arena-hangar');
    expect([...answered].sort()).toEqual(['/arena/hangar', '/arena/team']);
    await answerGallery(page, 'wiki');
    expect(answered).toHaveLength(2);
  });
});
