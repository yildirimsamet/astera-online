import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

/** Real native HTML/CSP, with a harmless entry probe and no API or device session. */
export async function verifyNativeStartup(output) {
  await mkdir(output, { recursive: true });
  const directory = resolve('apps/web/mobile-dist/native-production');
  const index = await readFile(join(directory, 'index.html'));
  const main = /<script\b[^>]*type="module"[^>]*src="([^"]+)"/.exec(index.toString())?.[1];
  assert(main, 'Native module entry missing');
  const origin = 'https://native-startup.example.test';
  const mainPath = new URL(main, origin).pathname;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [width, height] of [[350, 812], [350, 480], [1280, 812]]) {
      for (const language of ['tr', 'en']) {
        const page = await browser.newPage({ viewport: { width, height }, locale: language === 'tr' ? 'tr-TR' : 'en-GB' });
        const errors = []; const apiRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
          if (url.origin !== origin) return route.abort();
          if (url.pathname === mainPath) return route.fulfill({ contentType: 'text/javascript', body: 'sessionStorage.setItem("astera:startup-probe","started");export {};' });
          const file = resolve(directory, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
          if (!file.startsWith(directory + sep)) return route.fulfill({ status: 404, body: '' });
          try { return route.fulfill({ contentType: types[extname(file)] ?? 'application/octet-stream', body: await readFile(file) }); }
          catch { return route.fulfill({ status: 404, body: '' }); }
        });
        // The engine is modern; only the feature probe is made to report unsupported CSS.
        await page.addInitScript(() => { CSS.supports = () => false; });
        await page.goto(origin);
        await page.waitForURL('**/assets/native-startup.html');
        await page.getByRole('heading', { name: language === 'tr' ? 'Uygulama açılamadı' : 'The app couldn’t open' }).waitFor();
        const state = await page.evaluate(() => ({ language: document.documentElement.lang,
          overflow: document.documentElement.scrollWidth > innerWidth,
          appStarted: sessionStorage.getItem('astera:startup-probe') }));
        assert.equal(state.language, language); assert.equal(state.overflow, false); assert.equal(state.appStarted, null);
        await page.locator('.brand img').evaluate(image => image.decode());
        for (const link of await page.getByRole('link').all()) {
          await link.scrollIntoViewIfNeeded(); const box = await link.boundingBox();
          assert(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= -1 && box.y + box.height <= height + 1, 'Recovery action clipped');
          assert((await link.getAttribute('href')).startsWith('https://'));
        }
        assert.equal(await page.locator('.brand img').evaluate(image => image.naturalWidth > 0), true);
        assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []);
        await page.screenshot({ path: join(output, `startup-${language}-${width}x${height}.png`), fullPage: true });
        results.push({ width, height, language, fallback: true, bootstrapSuppressed: true, actionsReachable: true, errors });
        await page.close();
      }
    }
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: index });
      if (url.pathname === mainPath) return route.fulfill({ contentType: 'text/javascript', body: 'sessionStorage.setItem("astera:startup-probe","started");export {};' });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto(origin);
    await page.waitForFunction(() => sessionStorage.getItem('astera:startup-probe') === 'started');
    assert.equal(new URL(page.url()).pathname, '/');
    results.push({ modernRenderer: true, gameBootstrapAllowed: true });
    await page.close();
  } finally { await browser.close(); }
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results));
}
