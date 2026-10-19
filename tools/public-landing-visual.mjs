import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Read-only, anonymous browser acceptance. Every API call is locally intercepted. */
export async function verifyPublicLanding(output) {
  await mkdir(output, { recursive: true });
  const origin = process.env.ASTERA_VISUAL_WEB ?? 'http://localhost:5174';
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = { origin, noJavaScript: [], enhanced: [], offline: [], errors: [] };
  try {
    for (const [name, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844], ['narrow', 350, 640], ['short', 350, 480]]) {
      const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false, ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
      const page = await context.newPage();
      const response = await page.goto(`${origin}/tr/`);
      assert.equal(response?.status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.locator('h2').count() >= 5);
      assert.equal(await page.locator('#worlds a[href="/wiki/tr/worlds"]').count(), 1);
      await page.screenshot({ path: `${output}/${name}-no-js-hero.png` });
      await loadBelowFoldImages(page);
      await page.screenshot({ path: `${output}/${name}-no-js.png`, fullPage: true });
      const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, text: document.querySelector('main')?.innerText.length }));
      assert.ok(metrics.scrollWidth <= width + 1, `${name}: horizontal overflow`);
      results.noJavaScript.push({ name, ...metrics });
      await context.close();
    }
    const locales = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
    for (const language of ['tr', 'en', 'fr', 'de', 'es', 'ja']) {
      const page = await locales.newPage();
      await page.goto(`${origin}/${language}/`);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language}: horizontal overflow`);
      await page.screenshot({ path: `${output}/locale-${language}-mobile.png` });
      await page.close();
    }
    await locales.close();
    const retina = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2, javaScriptEnabled: false, ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
    const artworkPage = await retina.newPage();
    await artworkPage.goto(`${origin}/en/`);
    await loadBelowFoldImages(artworkPage);
    const artwork = await artworkPage.locator('.landing-chapter-art img').evaluateAll(async images => Promise.all(images.map(async image => {
      const bitmap = await createImageBitmap(await (await fetch(image.currentSrc)).blob());
      const result = { source: image.currentSrc, pixels: bitmap.width, displayed: image.getBoundingClientRect().width, dpr: devicePixelRatio, fit: getComputedStyle(image).objectFit };
      bitmap.close();
      return result;
    })));
    assert.equal(artwork.length, 4);
    for (const art of artwork) { assert.ok(art.pixels >= art.displayed * art.dpr, `Insufficient source detail: ${JSON.stringify(art)}`); assert.equal(art.fit, 'contain'); }
    for (const chapter of ['intelligence', 'fleet']) await artworkPage.locator(`#${chapter}`).screenshot({ path: `${output}/${chapter}-retina.png` });
    await writeFile(`${output}/artwork-resolution.json`, JSON.stringify(artwork, null, 2));
    await retina.close();
    for (const [name, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844], ['narrow', 350, 640], ['short', 350, 480]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'tr-TR', ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
      await context.route(url => url.origin !== origin, route => route.abort());
      await context.route(url => url.pathname.startsWith('/api/'), route => {
        const isServers = new URL(route.request().url()).pathname === '/api/servers';
        return route.fulfill({ status: isServers ? 200 : 401, contentType: 'application/json', body: JSON.stringify(isServers ? { servers: [] } : { error: { code: 'UNAUTHENTICATED', message: 'Anonymous visual fixture' } }) });
      });
      const page = await context.newPage();
      const requests = [];
      page.on('request', request => { requests.push(request.url()); });
      page.on('pageerror', error => { results.errors.push({ name, message: error.message }); });
      await page.goto(`${origin}/tr/`);
      await page.locator('[data-testid="landing-primary"]').waitFor();
      await page.waitForTimeout(700);
      assert.equal(await page.locator('canvas').count(), 0);
      const metrics = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="landing-primary"]').getBoundingClientRect();
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cta: { top: button.top, bottom: button.bottom }, height: innerHeight, selection: getComputedStyle(document.body).userSelect, touch: getComputedStyle(document.documentElement).touchAction };
      });
      assert.ok(metrics.scrollWidth <= width + 1, `${name}: horizontal overflow`);
      await page.screenshot({ path: `${output}/${name}-hero.png` });
      assert.ok(metrics.cta.bottom <= height, `${name}: primary CTA is below the first viewport`);
      const consent = page.getByRole('dialog', { name: 'Çerez ve reklam tercihin', exact: true });
      await consent.waitFor();
      const bounds = await consent.boundingBox();
      assert.ok(bounds && bounds.height <= 200, `${name}: consent panel is too tall`);
      await consent.screenshot({ path: `${output}/${name}-consent.png` });
      await loadBelowFoldImages(page);
      await page.screenshot({ path: `${output}/${name}-full.png`, fullPage: true });
      const beforeEntry = requests.slice();
      assert.ok(!beforeEntry.some(url => /(?:\/three\.js|\/assets\/models\/|\/LandingScene\.)/.test(url)), 'Public entry loaded a 3D runtime/model');
      await page.getByRole('button', { name: /zaten bir komutanım var/i }).click();
      await page.getByRole('dialog', { name: 'Giriş yap', exact: true }).waitFor();
      await page.screenshot({ path: `${output}/${name}-login.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog', { name: 'Giriş yap', exact: true }).count(), 0);
      if (name === 'desktop') {
        await page.getByRole('combobox').selectOption('en');
        await page.locator('[data-testid="landing-primary"]').click();
        await page.locator('canvas').waitFor({ timeout: 60000 });
        if (process.env.ASTERA_LANDING_CAPTURE_GAME === '1') {
          await page.locator('[data-loading-screen]:not([data-departing="true"])').waitFor({ state: 'hidden', timeout: 60000 });
          await page.screenshot({ path: `${output}/${name}-practice.png`, timeout: 60000 });
        }
        assert.equal(await page.locator('[data-public-landing]').count(), 0);
        assert.equal(await page.locator('html[data-public-surface]').count(), 0);
      }
      results.enhanced.push({ name, ...metrics, initialRequests: beforeEntry });
      await context.close();
    }
    for (const [name, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844], ['short', 350, 480]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR', ignoreHTTPSErrors: origin.startsWith('https://127.0.0.1:') });
      await context.route(url => url.origin !== origin, route => route.abort());
      await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'UNREACHABLE', message: 'Offline fixture' }) }));
      const page = await context.newPage();
      await page.goto(`${origin}/tr/`);
      await page.getByRole('button', { name: 'Tekrar dene', exact: true }).waitFor();
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('#worlds').count(), 1);
      assert.equal(await page.locator('html[data-public-surface]').count(), 1);
      const cta = await page.getByTestId('landing-primary').boundingBox();
      assert.ok(cta && cta.y + cta.height <= height, `${name}: offline CTA below first viewport`);
      await page.screenshot({ path: `${output}/${name}-offline.png` });
      results.offline.push({ name, width, height, publicContentVisible: true, retryVisible: true });
      await context.close();
    }
    assert.equal(results.errors.length, 0, JSON.stringify(results.errors));
    await writeFile(`${output}/acceptance.json`, JSON.stringify(results, null, 2));
    console.log('Public landing browser acceptance PASS');
  } finally { await browser.close(); }
}

async function loadBelowFoldImages(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) { await page.evaluate(top => { window.scrollTo(0, top); }, y); await page.waitForTimeout(90); }
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(100);
}
