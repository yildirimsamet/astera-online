import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

export async function verifyLegacyReview(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], failures = [], reviews = [];
  const web = process.env.WEB ?? 'http://127.0.0.1:5188';
  try {
    const page = await browser.newPage({ viewport: { width: 500, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) failures.push(response.url()); });
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(5000);
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => interval(callback, Math.max(delay ?? 0, 250), ...args);
    });
    for (const id of ['season-memento', 'year-of-service', 'astera-supporter', 'shipwright-dart', 'troublemaker', 'show-off', 'final-verdict', 'shipwright-cataclysm']) {
      const url = `${web}/v2-gallery.html?view=legacy-award&award=${id}&lng=tr`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-legacy-stage] canvas').waitFor();
      await page.waitForTimeout(1600);
      await page.locator('[data-legacy-stage]').screenshot({ path: `${out}/${id}.png`, timeout: 60_000 });
      if (id === 'astera-supporter') assert.ok(await page.getByText('Efsanevi', { exact: true }).count() > 0);
      const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
      if (id.startsWith('shipwright-')) {
        assert.ok(resources.some(url => url.includes('thruster-grunge.webp')));
        assert.ok(!resources.some(url => url.includes('/engine-flames/')), 'ship awards use galaxy exhaust, not arena volumes');
      }
      reviews.push({ id, url }); console.log('Reviewed', id);
    }
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    await writeFile(`${out}/report.json`, JSON.stringify({ reviews, errors, failures, captureFps: 4 }, null, 2) + '\n');
  } finally { await browser.close(); }
}
