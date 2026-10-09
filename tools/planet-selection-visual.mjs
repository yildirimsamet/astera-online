import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Actual PlanetField: one close edge, no outer selection hoop, home edge survives. */
export async function verifyPlanetSelection(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 760, height: 600 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(time => setTimeout(() => callback(time), 150));
    });
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=planet-selection&lng=tr`, { waitUntil: 'networkidle' });
    const stage = page.locator('[data-selection-review]');
    for (const [label, count, name] of [['Seçimi kaldır', 1, 'unselected'], ['Kendi gezegenim', 1, 'own-selected'], ['Keşfedilmemiş', 2, 'unknown-selected'], ['Seçimi kaldır', 1, 'cleared']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(expected => {
        const radii = JSON.parse(document.querySelector('[data-selection-review]').dataset.borderRadii ?? '[]');
        return radii.length === expected && radii.every(radius => radius < .8 * 1.1);
      }, count);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await stage.screenshot({ path: `${output}/${name}.png` });
      const radii = JSON.parse(await stage.getAttribute('data-border-radii'));
      assert.equal(radii.length, count);
      assert(radii.every(radius => radius < .8 * 1.1));
      results.push({ name, radii });
      console.log(`PASS ${name}: ${count} close borders, no outer hoop`);
    }
    // Also exercise the actual planet pick surface rather than only state buttons.
    const canvas = await page.locator('canvas').boundingBox();
    assert(canvas);
    const focalPixels = canvas.height / (2 * Math.tan(40 * Math.PI / 360));
    await page.mouse.click(canvas.x + canvas.width / 2 + 1.3 * focalPixels / 7, canvas.y + canvas.height / 2);
    await page.waitForFunction(() => document.querySelector('[data-selection-review]').dataset.selected === 'selection-hidden');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const clickedRadii = JSON.parse(await stage.getAttribute('data-border-radii'));
    assert.equal(clickedRadii.length, 2);
    assert(clickedRadii.every(radius => radius < .8 * 1.1));
    results.push({ actualPlanetTap: true, radii: clickedRadii });
    console.log('PASS actual unknown-planet tap preserves only its close border');
    assert.deepEqual(errors, []);
    await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  } finally { await browser.close(); }
}
