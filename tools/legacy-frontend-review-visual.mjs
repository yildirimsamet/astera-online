import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** The complete commander-name flow and actual mutations, using local gallery fixtures. */
export async function verifyLegacyFrontend(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], missing = [], captures = [], checks = [];
  const web = process.env.WEB ?? 'http://127.0.0.1:5188';
  try {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) missing.push(response.url()); });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(5000);
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => interval(callback, Math.max(delay ?? 0, 250), ...args);
    });
    async function shot(name) {
      await page.screenshot({ path: `${out}/${name}.png`, timeout: 60_000 }); captures.push(name);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
    }
    async function open(view, suffix = '') {
      await page.goto(`${web}/v2-gallery.html?view=${view}&lng=tr${suffix}`, { waitUntil: 'domcontentloaded' });
    }

    await open('legacy-peek', '&closed=1');
    await page.getByRole('button', { name: 'Kestrel Sable profilini aç' }).click();
    await page.locator('[data-legacy-peek]').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-legacy-peek-piece]')].every(tile => tile.querySelector('img')?.complete));
    await shot('commander-peek-350');
    await page.getByRole('button', { name: 'Honor Şampiyonu · S12', exact: true }).click();
    await page.locator('[data-legacy-award]').waitFor();
    await page.waitForTimeout(1200);
    await shot('visitor-award-350');
    assert.equal(await page.getByRole('button', { name: 'Unvan yap', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-legacy-peek]').count(), 1);
    assert.equal(await page.locator('[data-legacy-award]').count(), 0);
    await page.getByRole('button', { name: 'Tüm mirası gör' }).click();
    await page.locator('[data-legacy-profile]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Vitrini düzenle', exact: true }).count(), 0);
    await shot('visitor-profile-350');
    checks.push('commander label → peek → award → back → complete visitor profile; owner controls hidden');

    await open('legacy-profile', '&self=1');
    await page.locator('[data-legacy-profile]').waitFor();
    await page.waitForTimeout(1600);
    const header = page.locator('[data-sheet-art] img').first();
    assert.ok((await header.getAttribute('src')).includes('header-gallery-v1.webp'));
    assert.ok(await header.evaluate(image => image.complete && image.naturalWidth > 0));
    await shot('own-profile-header-350');
    await page.locator('[data-legacy-season]').last().scrollIntoViewIfNeeded();
    await shot('season-history-350');
    await page.getByRole('tab', { name: 'Koleksiyon', exact: true }).click();
    const tiles = page.locator('[data-legacy-tile]:not([data-locked])');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-legacy-tile]:not([data-locked])')].every(tile => tile.querySelector('img')?.complete));
    const all = await tiles.count();
    await page.getByRole('radio', { name: 'Savaş', exact: true }).click();
    assert.ok(await tiles.count() > 0 && await tiles.count() < all);
    await shot('combat-filter-350');
    await page.getByRole('radio', { name: 'Tümü', exact: true }).click();
    await page.getByRole('button', { name: 'Radyasyon Ustası IV', exact: true }).click();
    await page.getByRole('button', { name: 'Unvan yap', exact: true }).click();
    await page.getByText('Unvanın', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Vitrine koy', exact: true }).isDisabled());
    await shot('title-and-full-shelf-350');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Miras', exact: true }).click();
    await page.getByRole('button', { name: 'Vitrini düzenle', exact: true }).click();
    await page.locator('[data-legacy-editor]').waitFor();
    const editor = page.locator('[data-legacy-editor]');
    await editor.locator('[data-legacy-tile][aria-pressed="false"]').first().click();
    await page.getByText('Vitrin dolu. Önce bir parçayı çıkar.', { exact: true }).waitFor();
    await shot('editor-full-350');
    await page.getByRole('button', { name: 'Hepsini kaldır', exact: true }).click();
    await page.getByRole('button', { name: 'Vitrini kaydet', exact: true }).click();
    await page.getByText('Vitrinin boş. Koleksiyonundan en fazla altı parça seç.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-legacy-shelf] canvas').count(), 0);
    await shot('empty-shelf-350');
    await page.getByRole('button', { name: 'Vitrini düzenle', exact: true }).first().click();
    await page.locator('[data-legacy-editor]').getByRole('button', { name: 'Radyasyon Ustası IV', exact: true }).click();
    await page.locator('[data-legacy-editor]').getByRole('button', { name: 'Silah Arkadaşı IV', exact: true }).click();
    await page.getByRole('button', { name: 'Vitrini kaydet', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-legacy-plate]').length === 2);
    checks.push('category filter, title selection, full shelf guard, editor maximum, clear/save/reselect in order');

    await page.setViewportSize({ width: 1280, height: 900 });
    await open('legacy-peek');
    await page.locator('[data-legacy-peek]').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-legacy-peek-piece]')].every(tile => tile.querySelector('img')?.complete));
    await shot('commander-peek-1280');

    await page.setViewportSize({ width: 812, height: 350 });
    await open('legacy-reveal', '&n=1');
    const reveal = page.getByTestId('legacy-reveal');
    await reveal.waitFor();
    await reveal.click({ position: { x: 20, y: 20 } });
    const close = page.getByRole('button', { name: 'Kapat', exact: true });
    await close.scrollIntoViewIfNeeded();
    const bounds = await close.boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 350, 'landscape reveal close remains reachable');
    await shot('reveal-landscape');
    await close.click();
    assert.equal(await reveal.count(), 0);
    checks.push('short landscape reveal scrolls to usable actions and closes');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    await writeFile(`${out}/report.json`, JSON.stringify({ captures, checks, errors, missing, softwareCaptureFps: 4 }, null, 2) + '\n');
    console.log('Legacy frontend review checks passed:', checks.length, 'flows,', captures.length, 'captures');
  } finally { await browser.close(); }
}
