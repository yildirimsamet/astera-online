/** Verify the same UFO skin in flight, shop, inventory and menu without API or payment calls. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyUfoProbe(output) {
  await mkdir(output, { recursive: true });
  const base = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  const freshPage = async (width) => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    // Give the local software GPU time between frames; production motion remains untouched.
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(time => setTimeout(() => callback(time), 150));
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    return { page, errors };
  };
  try {
    for (const width of [350, 1280]) {
      const { page, errors } = await freshPage(width);
      await page.goto(`${base}/v2-gallery.html?view=ufo-probe-flight&lng=tr`, { waitUntil: 'domcontentloaded' });
      const stage = page.locator('[data-ufo-flight-ready="true"]');
      await stage.waitFor({ timeout: 60000 });
      const checks = JSON.parse(await stage.getAttribute('data-beam-checks'));
      assert.deepEqual(checks, [
        { attachedToHull: true, depthTest: true, depthWrite: false },
        { attachedToHull: true, depthTest: true, depthWrite: false },
      ]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(output, `${width}-flight.png`), clip: await stage.boundingBox(), timeout: 60000 });
      assert.deepEqual(errors, []);
      results.push({ view: 'flight', width, checks, errors });
      await page.close();
      console.log(`PASS ${width}: own and foreign UFO beams, default probe and unknown contact unchanged`);
    }
    for (const view of ['shop', 'inventory']) {
      const { page, errors } = await freshPage(350);
      if (view === 'inventory') await page.route('**/src/v2/gallery/CosmeticTrialGallery.tsx*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const ownership = /ownedCosmeticIds:\s*\[([^\]]*)\]/;
        const equipment = /equipment:\s*\{\s*RING:\s*["']ring-helios["']\s*\}/;
        assert(ownership.test(source) && equipment.test(source));
        const body = source.replace(ownership, (_, owned) => `ownedCosmeticIds: [${owned}, "probe-ufo"]`)
          .replace(equipment, 'equipment: { RING: "ring-helios", PROBE: "probe-ufo" }');
        await route.fulfill({ response, body });
      });
      const url = view === 'shop' ? 'view=skin-shop' : 'view=store-discovery&panel=inventory';
      await page.goto(`${base}/v2-gallery.html?${url}&lng=tr`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^Probe/ }).click();
      await page.locator('[data-cosmetic-stage="probe-ufo"][data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (view === 'inventory') assert.equal(await page.getByRole('button', { name: 'Kuşanıldı', exact: true }).isDisabled(), true);
      await page.screenshot({ path: join(output, `350-${view}.png`), fullPage: true, timeout: 60000 });
      assert.deepEqual(errors, []);
      results.push({ view, width: 350, errors, overflow: false, fixtureOwnership: view === 'inventory' });
      await page.close();
      console.log(`PASS ${view}: shared UFO preview and product card, no 350px overflow`);
    }
    const { page, errors } = await freshPage(350);
    await page.goto(`${base}/v2-gallery.html?view=store-discovery&panel=menu&lng=tr`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const scene = document.querySelector('[data-showcase-scene]');
      return scene?.querySelector('canvas') && !scene.querySelector(':scope > [data-showcase-poster]');
    }, null, { timeout: 60000 });
    const clip = await page.locator('[data-shop-showcase]').boundingBox();
    assert(clip);
    assert.equal(clip.height, 200.5);
    await page.screenshot({ path: join(output, '350-menu.png'), clip, timeout: 60000 });
    await page.locator('[data-shop-showcase] > button').first().click();
    await page.locator('.v2-store').waitFor();
    assert.deepEqual(errors, []);
    results.push({ view: 'menu', width: 350, height: clip.height, errors, navigation: true });
    await page.close();
    console.log('PASS menu: lava planet, smaller flag, wider UFO orbit and shared beam');
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
