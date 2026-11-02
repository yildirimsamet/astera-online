import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

/** Built artefacts, disposable browser state and mocked API only. Never writes to a live game. */
export async function verifyFirstVisit(output) {
  await mkdir(output, { recursive: true });
  const events = [], requests = [];
  const root = resolve(process.env.ASTERA_FIRST_VISIT_BUILD ?? '/tmp/astera-fastentry-candidate');
  const cached = new Map();
  const server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url, 'http://local.invalid').pathname;
      requests.push(path);
      if (path.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        res.setHeader('content-type', 'application/json');
        if (path === '/api/analytics/visitors') {
          res.statusCode = req.method === 'DELETE' ? 204 : 201;
          res.end(req.method === 'DELETE' ? undefined : JSON.stringify({ visitorId: randomUUID(), credential: 'v'.repeat(43), expiresAt: new Date(Date.now() + 86400000).toISOString() }));
        } else if (path === '/api/analytics/events') {
          const batch = JSON.parse(body).events; events.push(...batch);
          res.end(JSON.stringify({ accepted: batch.length, duplicates: 0 }));
        } else if (path === '/api/servers') res.end(JSON.stringify({ servers: [] }));
        else { res.statusCode = 401; res.end(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'Local browser fixture' })); }
        return;
      }
      const relative = path === '/' || /^\/(tr|en|fr|de|es|ja)\/$/.test(path) ? path + 'index.html' : path;
      let file = resolve(root, '.' + relative);
      if (!file.startsWith(root + '/')) { res.statusCode = 403; res.end(); return; }
      try { await stat(file); } catch { file = resolve(root, 'index.html'); }
      if (!cached.has(file)) {
        let content = await readFile(file);
        const extension = extname(file);
        if (extension === '.html') content = Buffer.from(content.toString().replaceAll('__CSP_NONCE__', 'local-first-visit'));
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' }[extension] ?? 'application/octet-stream';
        const gzip = ['.html', '.js', '.css', '.json', '.svg'].includes(extension);
        cached.set(file, { body: gzip ? gzipSync(content) : content, type, gzip });
      }
      const content = cached.get(file); res.setHeader('content-type', content.type);
      if (content.gzip) res.setHeader('content-encoding', 'gzip');
      res.setHeader('cache-control', 'public, max-age=3600'); res.end(content.body);
    })().catch(error => { res.statusCode = 500; res.end(); console.error(error.message); });
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  const contextFor = async (width, language = 'tr', returning = false) => {
    const context = await browser.newContext({ viewport: { width, height: 740 }, locale: language, isMobile: width < 600, hasTouch: width < 600 });
    await context.route(url => url.origin !== origin, route => route.abort());
    await context.addInitScript(({ returning }) => {
      localStorage.setItem('astera.consent', JSON.stringify({ version: 1, decision: 'denied', at: new Date().toISOString() }));
      if (returning) localStorage.setItem('astera.commander', '1');
      window.__entryLongTasks = []; window.__entryLcp = 0;
      new PerformanceObserver(list => { window.__entryLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))); }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(list => { window.__entryLcp = list.getEntries().at(-1)?.startTime ?? 0; }).observe({ type: 'largest-contentful-paint', buffered: true });
    }, { returning });
    return context;
  };
  try {
    for (const [name, width, language] of [['phone', 390, 'tr'], ['small-phone', 350, 'tr'], ['desktop', 1440, 'de']]) {
      const context = await contextFor(width, language); const page = await context.newPage();
      const requestStart = requests.length;
      const errors = []; page.on('pageerror', error => { errors.push(error.message); });
      const begin = Date.now(); await page.goto(`${origin}/${language}/`);
      await page.locator('[data-school-scene="welcome"]').waitFor({ timeout: 60000 });
      const mountedMs = Date.now() - begin;
      assert.equal(await page.locator('[data-public-landing]').count(), 0);
      await page.waitForFunction(() => !document.querySelector('[data-loading-screen]:not([data-departing="true"])'), { timeout: 60000 });
      await page.locator('[data-academy-home]').waitFor({ state: 'visible' });
      const readyMs = Date.now() - begin;
      await page.screenshot({ path: `${output}/${name}-training.png` });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(!requests.slice(requestStart).some(p => /\/assets\/images\/landing\//.test(p)), 'Training must not download promotional images');
      assert.ok(!requests.some(p => /\/api\/(?:onboarding\/claim|preview)$/.test(p)), 'Entry does not claim a live seat');
      assert.ok(!events.some(e => e.name === 'play_clicked'), 'Automatic entry must not manufacture a click');
      assert.deepEqual(errors, []);
      if (name === 'phone') {
        // Real controls: progress survives refresh, and the existing-player door stays usable.
        const reveal = page.locator('.school-reveal');
        if (await reveal.count()) await reveal.click();
        await reveal.waitFor({ state: 'hidden' });
        // The DOM marker locates the planet; picking is handled by the canvas.
        const home = await page.locator('[data-academy-home]').boundingBox();
        assert.ok(home);
        await page.mouse.click(home.x + home.width / 2, home.y + home.height / 2);
        await page.locator('[data-school-scene="resources"]').waitFor();
        await page.reload();
        await page.locator('[data-school-scene="resources"]').waitFor({ timeout: 60000 });
        await page.waitForFunction(() => !document.querySelector('[data-loading-screen]:not([data-departing="true"])'));
        await page.locator('.school-exit').click();
        await page.getByRole('button', { name: /zaten bir komutanım var/i }).click();
        await page.getByRole('dialog', { name: 'Giriş yap', exact: true }).waitFor();
        await page.keyboard.press('Escape');
        await page.reload();
        await page.getByTestId('landing-primary').waitFor();
        assert.equal(await page.locator('[data-school-scene]').count(), 0);
        await page.getByTestId('landing-primary').click();
        await page.locator('[data-school-scene="resources"]').waitFor({ timeout: 60000 });
        results.push({ progressSurvivesRefresh: true, signInInsteadWorks: true, manualReentryWorks: true });
      }
      assert.deepEqual(errors, []);
      results.push({ name, mountedMs, readyMs, errors }); console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
    const context = await contextFor(390, 'tr', true); const page = await context.newPage();
    await page.goto(`${origin}/tr/`); await page.getByTestId('landing-primary').waitFor();
    assert.equal(await page.locator('[data-school-scene]').count(), 0);
    await page.screenshot({ path: `${output}/returning-sign-in.png` });
    results.push({ returningCommanderHasSignIn: true }); await context.close();
    await writeFile(`${output}/acceptance.json`, JSON.stringify({ results, requests, events: events.map(e => ({ name: e.name, mode: e.mode })) }, null, 2));
    console.log('First-visit browser acceptance PASS');
  } finally { await browser.close(); await new Promise(resolve => { server.close(resolve); }); }
}
