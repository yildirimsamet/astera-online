import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Verify the real daily readout without an account, game action or API write. */
export async function verifyGalaxyReadout(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const source = await (await fetch(`${web}/src/v2/gallery/main.tsx`)).text();
  const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
  const dom = source.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/);
  assert(react && dom, 'Vite must expose the React imports');
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 180 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.route('**/__galaxy-readout-check.html', route => route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html lang="${language}"><head><meta charset="UTF-8"></head>
            <body style="margin:0;background:#080e19"><div id="root" style="display:flex;justify-content:flex-end;padding:12px"></div>
            <script type="module">
              import '/src/styles.css';
              import RefreshRuntime from '/@react-refresh';
              RefreshRuntime.injectIntoGlobalHook(window);
              window.$RefreshReg$ = () => {};
              window.$RefreshSig$ = () => type => type;
              window.__vite_plugin_react_preamble_installed__ = true;
              const [{default: React}, {default: ReactDOM}, {default: i18n}, {GalaxyReadout}] = await Promise.all([
                import(${JSON.stringify(react[1])}), import(${JSON.stringify(dom[1])}),
                import('/src/i18n/index.ts'), import('/src/v2/hud/GalaxyCorners.tsx'),
              ]);
              await i18n.changeLanguage(${JSON.stringify(language)});
              const root = ReactDOM.createRoot(document.getElementById('root'));
              window.showDaily = (count, live) => root.render(React.createElement(GalaxyReadout, {
                online: live, onlineToday: count,
                counts: {worlds:212, fleetsAway:3, rocks:9, pirates:1, wrecks:1, monuments:8},
              }));
              window.dailyLabel = count => i18n.t('galaxy.onlineToday', {count});
              window.showDaily(100, 6);
            </script></body></html>`,
        }));
        await page.goto(`${web}/__galaxy-readout-check.html`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-galaxy-readout]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (const count of [100, 1000, 0]) {
          await page.evaluate(value => window.showDaily(value, undefined), count);
          const label = await page.evaluate(value => window.dailyLabel(value), count);
          const text = page.getByText(label, { exact: true });
          await text.waitFor();
          const measured = await text.evaluate(element => {
            const row = element.parentElement;
            const dot = row.querySelector('[aria-hidden="true"]');
            const bounds = row.getBoundingClientRect();
            return {
              text: row.textContent, color: getComputedStyle(element).color,
              dotColor: getComputedStyle(dot).backgroundColor,
              dotWidth: dot.getBoundingClientRect().width,
              dotRadius: getComputedStyle(dot).borderRadius,
              fits: bounds.left >= 0 && bounds.right <= innerWidth && row.scrollWidth <= row.clientWidth,
            };
          });
          assert.equal(measured.text, label);
          assert.equal(measured.color, 'rgb(164, 177, 205)');
          assert.equal(measured.dotColor, 'rgb(46, 230, 200)');
          assert.equal(measured.dotWidth, 6);
          assert.equal(measured.fits, true, `${language} ${width}px daily activity must fit`);
          if (language === 'tr' && count === 100) assert.equal(label, '24 saatte 100 çevrimiçi');
          await page.locator('#root').screenshot({ path: `${output}/${language}-${width}-${count}.png` });
          results.push({ language, width, count, ...measured });
        }
        await page.evaluate(() => window.showDaily(undefined, 6));
        await page.waitForFunction(() => document.querySelector('[data-galaxy-readout]').children.length === 1);
        assert.deepEqual(errors, []);
        console.log(`PASS ${language} ${width}px: daily 100/1000/0, green dot, brighter text, unknown omitted`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/measurements.json`, `${JSON.stringify(results, null, 2)}\n`);
}
