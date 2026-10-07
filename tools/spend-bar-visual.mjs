/** Verify actual launch selection and the shared spend bar at 350px, without an API or launch. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifySpendBars(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=launch&lng=${language}`);
      const quantity = page.locator('input[inputmode="numeric"]').first();
      await quantity.waitFor();
      await quantity.fill('1');
      await quantity.blur();
      await page.locator('[data-spend-amount]').waitFor();
      const first = Number(await page.locator('[data-spend-amount]').textContent());
      await quantity.fill('40');
      await quantity.blur();
      const larger = Number(await page.locator('[data-spend-amount]').textContent());
      assert(larger > first, `${language}: more ships must show more fuel spent`);
      assert.equal(await page.locator('[data-spend-left]').count(), 0);
      await page.screenshot({ path: join(output, `${language}-launch.png`), fullPage: true });
      const measurements = await page.evaluate(async () => {
        const source = performance.getEntriesByType('resource').map((entry) => entry.name);
        const reactUrl = source.find((name) => /\/react\.js\?/.test(name));
        const domUrl = source.find((name) => /\/react-dom_client\.js\?/.test(name));
        if (!reactUrl || !domUrl) throw new Error('React modules were not loaded by the gallery');
        const [{ default: { createElement } }, { default: { createRoot } }, { SpendBar }] = await Promise.all([
          import(reactUrl), import(domUrl), import('/src/ui/SpendBar.tsx'),
        ]);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'width:350px;padding:12px;display:grid;gap:24px;background:#080c16';
        document.body.append(mount);
        const examples = [
          { stock: 1000, spend: 0 }, { stock: 1000, spend: 250 },
          { stock: 250, spend: 250 }, { stock: 100, spend: 400, inline: true },
          { stock: 0, spend: 50, compactSize: true },
        ];
        createRoot(mount).render(createElement('div', { style: { display: 'grid', gap: '24px' } },
          ...examples.map((props, index) => createElement(SpendBar, { key: index, ...props, tone: 'deuterium', label: 'Fuel' })),
        ));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return [...mount.querySelectorAll('[data-spend-bar]')].map((bar) => ({
          cost: bar.querySelector('[data-spend-amount]').textContent,
          shortage: bar.querySelector('[data-spend-short]')?.textContent ?? null,
          reading: bar.querySelector('[role="img"]').getAttribute('aria-label'),
          fits: bar.scrollWidth <= bar.clientWidth,
        }));
      });
      assert.deepEqual(measurements.map((row) => row.cost), ['0', '250', '250', '400', '50']);
      assert(measurements.every((row) => row.fits), `${language}: 350px bar overflow`);
      assert(measurements[3].shortage && measurements[4].shortage);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `${language}-bars.png`), fullPage: true });
      results.push({ language, first, larger, measurements, errors });
      console.log(`PASS ${language}: launch cost increases; zero, covered, exact, short and empty bars fit 350px`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
