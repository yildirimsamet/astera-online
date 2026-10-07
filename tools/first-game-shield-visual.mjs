/** Render the real shield chip at 350px, and read both public guides. No game writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyFirstGameShield(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  const base = process.env.WEB ?? 'http://localhost:5173';
  try {
    for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/v2-gallery.html?view=launch&lng=${language}`);
      await page.locator('input[inputmode="numeric"]').first().waitFor();
      const readings = await page.evaluate(async () => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery dependencies missing');
        const [react, dom, query, { AttackShield }, { ApiProvider }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl),
          import('/src/shell/StatusBar.tsx'), import('/src/api/context.tsx'),
        ]);
        const { createElement } = react.default;
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        mount.style.cssText = 'width:350px;padding:16px;display:flex;gap:24px;background:#080c16';
        document.body.append(mount);
        const chips = [72, 24].map(hours => {
          const client = new query.QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
          client.setQueryData(['season'], {
            rivals: [], shieldUntil: new Date(Date.now() + hours * 3_600_000), shieldKind: 'NEWCOMER',
          });
          return createElement(query.QueryClientProvider, { key: hours, client },
            createElement(ApiProvider, { api: {} }, createElement(AttackShield)));
        });
        dom.default.createRoot(mount).render(createElement('div', { style: { display: 'flex', gap: '24px' } }, ...chips));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return [...mount.querySelectorAll('[data-attack-shield]')].map(chip => ({
          text: chip.textContent, hint: chip.getAttribute('aria-label'),
          fits: chip.scrollWidth <= chip.clientWidth,
        }));
      });
      assert.equal(readings.length, 2);
      assert.match(readings[0].text, /71|72/);
      assert.match(readings[1].text, /23|24/);
      assert(readings.every(chip => chip.fits && chip.hint));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `${language}-shields.png`), fullPage: true });
      results.push({ language, readings, errors });
      await page.close();
    }
    for (const guide of ['hizli-baslangic-rehberi.html', 'quick-start-guide.html']) {
      const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
      await page.goto(`${base}/${guide}`);
      const text = await page.locator('body').innerText();
      assert.match(text, /72/);
      assert.match(text, /24/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(output, `${guide}.png`), fullPage: true });
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log('PASS: 72h and 24h shields in all six languages; both guides fit 350px');
}
