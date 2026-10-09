import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Exercise the real GalaxyView, store, camera and PlanetField on fixture-owned worlds. */
export async function verifyCosmeticTrial(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [], mutations = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
      page.on('request', request => { if (/\/api\//.test(request.url()) && request.method() !== 'GET') mutations.push(request.url()); });
      await page.addInitScript(() => {
        localStorage.setItem('astera.quality', 'low');
        window.requestAnimationFrame = callback => {
          const tick = () => { if (window.__capturePause) window.setTimeout(tick, 150); else callback(performance.now()); };
          return window.setTimeout(tick, 150);
        };
        window.cancelAnimationFrame = id => window.clearTimeout(id);
      });
      const capture = async name => {
        // Let SwiftShader drain before reading back a full-screen WebGL image.
        await page.evaluate(() => { window.__capturePause = true; });
        await page.waitForTimeout(500);
        try { await page.screenshot({ path: `${output}/${width}-${name}.png`, timeout: 60000 }); }
        finally { await page.evaluate(() => { window.__capturePause = false; }); }
      };
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=cosmetic-trial&lng=tr`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__galaxy), null, { timeout: 60000 });
      await page.getByRole('button', { name: /^Gezegen halkası/ }).click();
      await page.getByRole('button', { name: /^Aurora/ }).click();
      await page.locator('[data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: 'Gezegenimde dene', exact: true }).click();
      const bar = page.getByRole('region', { name: 'Geçici deneme', exact: true });
      await bar.waitFor();
      console.log(`Loaded own-world trial: ${width}px`);
      const counts = () => page.evaluate(() => {
        const result = { aurora: 0, helios: 0 };
        window.__galaxy.scene.traverse(object => {
          if (object.name === 'ring-aurora') result.aurora++;
          if (object.name === 'ring-helios') result.helios++;
        });
        return result;
      });
      await page.waitForFunction(() => Boolean(window.__galaxy.scene.getObjectByName('ring-aurora')));
      assert.deepEqual(await counts(), { aurora: 1, helios: 1 });
      await page.waitForTimeout(1600);
      await capture('ring-trial');
      await page.getByRole('combobox', { name: 'Denenecek gezegen' }).selectOption('trial-colony');
      assert.deepEqual(await counts(), { aurora: 1, helios: 1 });
      await page.getByRole('button', { name: 'Kuşandığımı göster', exact: true }).click();
      await page.waitForFunction(() => !window.__galaxy.scene.getObjectByName('ring-aurora'));
      assert.deepEqual(await counts(), { aurora: 0, helios: 2 });
      await page.getByRole('button', { name: 'Denemeyi göster', exact: true }).click();
      await page.getByRole('button', { name: 'Mağazaya dön', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^Gezegen halkası/ }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await counts(), { aurora: 0, helios: 2 });
      await page.getByRole('button', { name: /^Gezegen\s+\d/ }).click();
      await page.getByRole('button', { name: 'Gezegenimde dene', exact: true }).click();
      await bar.waitFor();
      console.log(`Loaded planet trial: ${width}px`);
      await page.waitForTimeout(1600);
      await capture('planet-trial');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const barBounds = await bar.boundingBox();
      assert(barBounds && barBounds.x >= 0 && barBounds.y >= 0 && barBounds.x + barBounds.width <= width && barBounds.y + barBounds.height <= 900);
      await page.getByRole('button', { name: 'Denemeyi bitir', exact: true }).click();
      await bar.waitFor({ state: 'detached' });
      assert.deepEqual(mutations, []);
      assert.deepEqual(errors, []);
      results.push({ width, errors, mutations });
      console.log(`PASS own-world trial: ${width}px (ring, colony, compare, return, planet, end)`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
