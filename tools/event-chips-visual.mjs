/** Verify the real event chips, translations and styles without a galaxy canvas or API. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyEventChips(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const source = await (await fetch(`${web}/src/v2/gallery/main.tsx`)).text();
  const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
  const dom = source.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/);
  assert(react && dom, 'Vite must expose the React imports');
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 180 }, deviceScaleFactor: 2 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/__event-chips-check.html*', route => route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html lang="${language}"><head><meta charset="UTF-8"></head>
            <body style="margin:0;background:#080e19"><div id="root" style="padding:12px"></div>
            <script type="module">
              import '/src/styles.css';
              import RefreshRuntime from '/@react-refresh';
              RefreshRuntime.injectIntoGlobalHook(window);
              window.$RefreshReg$ = () => {};
              window.$RefreshSig$ = () => type => type;
              window.__vite_plugin_react_preamble_installed__ = true;
              const [{default: React}, {default: ReactDOM}, {default: i18n}, {EventChips}] = await Promise.all([
                import(${JSON.stringify(react[1])}), import(${JSON.stringify(dom[1])}),
                import('/src/i18n/index.ts'), import('/src/v2/hud/GalaxyCorners.tsx'),
              ]);
              await i18n.changeLanguage(${JSON.stringify(language)});
              const now = Date.parse('2026-10-10T17:23:00Z');
              const root = ReactDOM.createRoot(document.getElementById('root'));
              window.showMultiplier = multiplier => {
                const shower = {id:'shower', kind:'ASTEROID_SHOWER', startsAt:new Date(now-23*60000),
                  endsAt:new Date(now+7*60000), asteroidSpawnMultiplier:multiplier};
                const trade = {id:'trade', kind:'TRADE_SHIP', startsAt:new Date(now-60000),
                  endsAt:new Date(now+7*60000), asteroidSpawnMultiplier:1};
                root.render(React.createElement(EventChips, {events:[shower,trade], now,
                  onOpen:event => { document.body.dataset.opened = String(event.asteroidSpawnMultiplier); }}));
              };
              window.showMultiplier(2);
            </script></body></html>`,
        }));
        await page.goto(`${web}/__event-chips-check.html`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /2x/ }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (const multiplier of [2, 4, 5]) {
          await page.evaluate(value => window.showMultiplier(value), multiplier);
          const chip = page.getByRole('button', { name: new RegExp(`${String(multiplier)}x`) });
          await chip.waitFor();
          const measurement = await chip.evaluate(button => {
            const factor = button.querySelector('span.text-v2-self');
            const bounds = button.getBoundingClientRect();
            return { text: button.textContent, label: button.getAttribute('aria-label'),
              factor: factor?.textContent, color: factor ? getComputedStyle(factor).color : null,
              fits: bounds.left >= 0 && bounds.right <= innerWidth && button.scrollWidth <= button.clientWidth,
              spans: [...button.querySelectorAll('span')].map(span => span.textContent) };
          });
          assert.equal(measurement.factor, `${String(multiplier)}x`);
          assert.equal(measurement.color, 'rgb(46, 230, 200)');
          assert.equal(measurement.fits, true, `${language}: chip must fit ${String(width)}px`);
          assert.deepEqual(measurement.spans.slice(1), [`${String(multiplier)}x`, language === 'tr' ? '7 dk' : '7m']);
          assert.equal(await page.getByRole('button').nth(1).locator('span.text-v2-self').count(), 0);
          await chip.click();
          assert.equal(await page.locator('body').getAttribute('data-opened'), String(multiplier));
          await page.locator('#root').screenshot({ path: join(output, `${String(width)}-${language}-${String(multiplier)}x.png`) });
          results.push({ width, language, multiplier, ...measurement, opened: true });
        }
        assert.equal(await page.locator('canvas').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`PASS ${String(width)}px ${language}: 2x/4x/retained 5x, primary color, remaining time, click, no overflow`);
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
