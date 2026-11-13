/**
 * THE BIG, BRIGHT MOMENTS, FILMED (plan §1.5, the list the owner approved).
 *
 * Each moment is opened the way the audit opens its surface, then filmed on a held clock
 * (`flashFilm.ts`). A moment started by a press is filmed from the press. The developer
 * preview pages start their effect from page load, so they load with time already held.
 */

import type { Page } from 'playwright';
import { galleryUrl, galleryVisits } from './drivers/gallery.js';
import { publicVisits } from './drivers/public.js';
import { SURFACES, type Reach } from './inventory.js';

export interface Moment {
  id: string;
  what: string;
  seconds: number;
  /** Load with page time held, for an effect that starts with the page. */
  heldFromLoad?: boolean;
  open: (page: Page) => Promise<void>;
  /** Starts the moment once time is held. */
  act?: (page: Page) => Promise<void>;
}

/**
 * Bright effects nothing here can start, and where they are looked at instead. Empty since the
 * 3D art gallery (`view=premium-space`) was found to replay the galaxy strikes on demand.
 */
export const NOT_FILMED: readonly { id: string; why: string; when: string }[] = [];

export function flashMoments(base: string): Moment[] {
  const visits = [...galleryVisits(base, SURFACES), ...publicVisits(base, SURFACES)];
  const opener = (reach: Reach) => {
    const visit = visits.find((v) => v.reach === reach);
    if (!visit) throw new Error(`no visit for ${reach}`);
    return (page: Page) => visit.open(page, 'tr');
  };
  const prologueAt = (stage: string) => async (page: Page) => {
    await page.addInitScript((saved) => { localStorage.setItem('astera.prologue', saved); }, stage);
    await opener('training:prologue')(page);
  };
  const preview = (path: string) => async (page: Page) => {
    await page.goto(`${base}/${path}?lng=tr`, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas').first().waitFor({ state: 'attached', timeout: 30_000 });
  };
  /** The 3D art gallery, zoomed on the struck world: the largest a strike is ever drawn. */
  const artScene = (query: string) => async (page: Page) => {
    await page.goto(`${galleryUrl(base, 'premium-space', 'tr')}&${query}`, { waitUntil: 'load' });
    await page.locator('[data-premium-scene-ready="true"]').waitFor({ timeout: 45_000 });
  };
  const replay = (page: Page) => page.getByRole('button', { name: 'Tekrar oynat', exact: true }).click();
  return [
    { id: 'simulator-battle', what: 'Savaş tekrarı: atışlar, isabetler, patlamalar (simülatör)', seconds: 30, open: opener('simulator') },
    { id: 'arena-match', what: 'Arena: pratik botlarla çatışma, isabet ve gemi ölümü', seconds: 20, open: opener('arena:match') },
    { id: 'radiation-bomb', what: 'Radyasyon bombası: art arda isabetler (geliştirici önizlemesi)', seconds: 9, heldFromLoad: true, open: preview('radiation-bomb-preview.html') },
    { id: 'jump', what: 'Sıçrama: geminin galaksiler arası atlayışı, beş bölümün tamamı (geliştirici önizlemesi)', seconds: 26, heldFromLoad: true, open: preview('jump-preview.html') },
    { id: 'prologue-warp', what: 'Prologue: sinyale dalış, ışık halkaları, beyaz flaş ve gemiye açılış', seconds: 6, open: prologueAt('signal'), act: (page) => page.getByTestId('prologue-signal').click() },
    { id: 'prologue-torch', what: 'Prologue: kaynak torcunun plazması (0,12 sn döngü)', seconds: 3, open: prologueAt('patching') },
    { id: 'legacy-reveal', what: 'Miras: yeni parçanın açılış flaşı', seconds: 3, open: opener('gallery:legacy-reveal'), act: (page) => page.getByTestId('legacy-reveal').getByRole('button').last().click() },
    { id: 'death-star-impact', what: 'Ölüm Yıldızı isabeti: stratejik patlama, şok halkası (galaksi, vurulan dünyaya yakın)', seconds: 11, open: artScene('scene=strategic'), act: replay },
    { id: 'planet-battle', what: 'Gezegen savaşı: filonun on saniyelik bombardımanı (galaksi, vurulan dünyaya yakın)', seconds: 13, open: artScene('scene=battle'), act: replay },
    { id: 'tempest-engine', what: 'Tempest motoru: filonun motorlarında kısa sarı ve beyaz flaşlar', seconds: 8, open: artScene('scene=fleet&engine=engine-tempest') },
  ];
}
