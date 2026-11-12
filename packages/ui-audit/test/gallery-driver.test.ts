import { describe, expect, it } from 'vitest';
import { GALLERY_STEPS, galleryUrl, galleryVisits } from '../src/drivers/gallery.js';
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
});
