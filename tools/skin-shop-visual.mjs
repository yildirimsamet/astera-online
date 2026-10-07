/** Photograph the real store component using the existing gallery fixture; no API or payment is called. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifySkinShop(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${web}/v2-gallery.html?view=skin-shop-live&lng=${language}`, { waitUntil: 'domcontentloaded' });
      const primary = page.getByRole('button', { name: /Polar/ }).first();
      await primary.waitFor();
      assert.equal(await primary.isEnabled(), true);
      assert.equal(await page.getByRole('link', { name: /Shopier/ }).count(), 2);
      assert.equal(await page.getByRole('heading', { name: /Shopier/ }).count(), 2);
      const measured = await page.locator('.v2-store').evaluate((store) => ({
        pageFits: document.documentElement.scrollWidth <= window.innerWidth,
        controlsFit: [...store.querySelectorAll('button, a')].every((element) => element.scrollWidth <= element.clientWidth + 1),
        alternatives: [...store.querySelectorAll('section')].filter((section) => section.querySelector(':scope > h4')).map((section) => ({
          heading: section.querySelector(':scope > h4').textContent,
          link: section.querySelector('a')?.getAttribute('href'),
          note: section.querySelector('p')?.textContent,
        })),
      }));
      assert.equal(measured.pageFits, true, language);
      assert.equal(measured.controlsFit, true, language);
      assert.equal(measured.alternatives.length, 2);
      assert(measured.alternatives.every((alternative) => alternative.note.includes('Samet')));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `${language}-store.png`), fullPage: true });
      results.push({ language, fixture: 'skin-shop-live', ...measured, errors });
      console.log(`PASS ${language}: Polar primary, Shopier alternatives, 350px controls fit`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
