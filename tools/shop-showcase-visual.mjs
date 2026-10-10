import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Verify the real menu at phone/desktop widths without rendering an unrelated galaxy. */
export async function verifyShopShowcase(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 2 });
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
        // Only the unrelated background is stubbed. The menu, styles and artwork are real.
        await page.route('**/src/galaxy/GalaxyCanvas.tsx*', async route => {
          const response = await route.fetch();
          const source = await response.text();
          const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
          assert(react, 'Vite must expose the React import');
          await route.fulfill({ response, body: `import React from ${JSON.stringify(react[1])};
            export function GalaxyCanvas({ onReady }) { React.useEffect(onReady, [onReady]); return null; }` });
        });
        let releaseImage;
        const imageGate = new Promise(resolve => { releaseImage = resolve; });
        await page.route('**/assets/images/cosmetics/shop-showcase-static.webp', async route => {
          await imageGate;
          await route.continue();
        });
        await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=store-discovery&panel=menu&lng=${language}`, { waitUntil: 'domcontentloaded' });
        const card = page.locator('[data-shop-showcase]');
        const image = card.locator('[data-showcase-poster]');
        await card.waitFor().catch(async error => {
          releaseImage();
          await page.screenshot({ path: join(output, 'failure.png') });
          await writeFile(join(output, 'failure.html'), await page.content());
          throw error;
        });
        await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const before = await card.boundingBox();
        assert(before);
        assert.equal(await image.evaluate(element => element.naturalWidth), 0);
        assert.equal(await card.getByRole('button').count(), 2);
        for (const button of await card.getByRole('button').all()) assert(await button.isEnabled());
        if (width === 350 && language === 'tr') {
          await card.screenshot({ path: join(output, '350-tr-before-image.png') });
        }
        releaseImage();
        await image.evaluate(element => element.decode());
        const after = await card.boundingBox();
        assert.deepEqual(after, before, 'Image arrival must not move or resize the card');
        assert.equal(await card.locator('canvas').count(), 0);
        assert.equal(await card.locator('img').count(), 1);
        assert.equal(await card.locator('.shop-showcase-hero').evaluate(hero => hero.getAnimations({ subtree: true }).length), 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await image.evaluate(element => element.naturalWidth), 512);
        await card.screenshot({ path: join(output, `${width}-${language}-card.png`) });
        await page.screenshot({ path: join(output, `${width}-${language}-menu.png`) });
        await page.getByRole('button', { name: language === 'tr' ? 'Kapat' : 'Close', exact: true }).click();
        await card.waitFor({ state: 'hidden' });
        await page.locator('[data-menu-button]').click();
        await card.waitFor();
        await image.evaluate(element => element.decode());
        assert.equal(await card.locator('canvas').count(), 0);
        const failedImageChecked = width === 350 && language === 'tr';
        if (failedImageChecked) {
          await page.unroute('**/assets/images/cosmetics/shop-showcase-static.webp');
          await page.route('**/assets/images/cosmetics/shop-showcase-static.webp', route => route.abort());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('[data-loading-screen]').waitFor({ state: 'hidden' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);
          await page.waitForFunction(() => {
            const image = document.querySelector('[data-showcase-poster]');
            return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0;
          });
          assert.deepEqual(await card.boundingBox(), before, 'A failed image must not move or resize the card');
          assert.equal(await image.isVisible(), false, 'Hide the browser broken-image decoration');
          for (const button of await card.getByRole('button').all()) assert(await button.isEnabled());
          await card.screenshot({ path: join(output, '350-tr-image-failed.png') });
        }
        assert.deepEqual(errors, []);
        results.push({ width, language, before, after, canvases: 0, artAnimations: 0, overflow: false, menuReopened: true, failedImageChecked, errors, galaxyStubbed: true });
        await page.close();
        console.log(`PASS ${width}px ${language}: still artwork, stable loading layout, menu reopens`);
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
