/** Real local navigation and names; empty-state rendering uses browser-only API fixtures. No gameplay is changed. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyMonumentUi(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const [label, viewport, language, ordinal, empty] of [
      ['desktop-en', { width: 1280, height: 900 }, 'en', 1, false],
      ['mobile-en', { width: 350, height: 812 }, 'en', 1, false],
      ['mobile-tr', { width: 350, height: 812 }, 'tr', 5, false],
      ['mobile-tr-empty', { width: 350, height: 812 }, 'tr', 5, true],
    ]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      await context.addInitScript((language) => { localStorage.setItem('astera.language', language); }, language);
      const response = await context.request.post(`${web}/api/auth/login`, { data: {
        username: process.env.VISUAL_COMMANDER ?? 'monument_local', password: process.env.VISUAL_PASSWORD ?? 'MonumentLocal2026!',
      } });
      if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
      const session = await response.json();
      const catalogResponse = await context.request.get(`${web}/api/monuments`, { headers: { authorization: `Bearer ${session.accessToken}` } });
      if (!catalogResponse.ok()) throw new Error(`Catalog failed: ${catalogResponse.status()}`);
      const catalog = await catalogResponse.json();
      if (catalog.monuments.length !== 5) throw new Error('The local season lacks five monuments');
      const target = catalog.monuments.find((row) => row.ordinal === ordinal);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => { errors.push(error.message); });
      if (empty) {
        target.controller = { kind: 'NEUTRAL' };
        target.used = 0;
        target.emptySince = new Date(Date.now() - 600_000).toISOString();
        target.respawnAt = new Date(Date.now() + 23 * 3600_000 + 50 * 60_000).toISOString();
        await page.route(/\/api\/monuments(?:\?|$)/, (route) => route.fulfill({ json: catalog }));
      }
      await page.goto(web, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__galaxy?.scene.getObjectByName('monument-model-5'), undefined, { timeout: 60_000 });
      // The real scene keeps its default selected planet. Freeze animation only for reliable software-GPU readback.
      await page.evaluate(() => { const g = window.__galaxy; g.setFrameloop('never'); g.advance(g.clock.elapsedTime + 1 / 30); });
      const cover = page.locator('[data-sheet-panel][data-placement="card"]');
      // The offline summary arrives after its API read, independently of scene readiness.
      try { await cover.waitFor({ state: 'visible', timeout: 10_000 }); }
      catch (error) { if (error.name !== 'TimeoutError') throw error; }
      if (await cover.isVisible()) await cover.getByRole('button', { name: language === 'en' ? 'Close' : 'Kapat', exact: true }).click();
      await cover.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: language === 'en' ? '5 monuments' : '5 anıt', exact: true }).click();
      const finder = page.locator('#galaxy-target-list');
      if (await finder.getByRole('button').count() !== 5) throw new Error('Finder did not expose all five monuments');
      const names = await finder.getByRole('button').allTextContents();
      if (names.some((name) => /Monument \d|Anıt \d/.test(name))) throw new Error('Finder still uses generic ordinal names');
      await page.screenshot({ path: join(output, `${label}-finder.png`) });
      await finder.getByRole('button').nth(ordinal - 1).click();
      await page.locator('[data-focus-rail] button[aria-expanded="false"]').click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByText(/7[.,]270/).waitFor();
      const result = await dialog.evaluate((element) => {
        const heading = element.querySelector('h2');
        return { title: heading?.textContent, titleFits: heading.scrollWidth <= heading.clientWidth,
          pageFits: document.documentElement.scrollWidth <= window.innerWidth,
          panelFits: element.scrollWidth <= element.clientWidth,
          buttonReachable: Boolean(element.querySelector('[data-testid="monument-send"] button')) };
      });
      if (!result.pageFits || !result.panelFits || !result.buttonReachable || errors.length > 0) throw new Error(JSON.stringify({ label, ...result, errors }));
      if (empty && !(await dialog.textContent()).includes('Garnizonun dönüşüne')) throw new Error('Empty state lacks the garrison return time');
      await page.screenshot({ path: join(output, `${label}-sheet.png`) });
      results.push({ label, fixture: empty, names, ...result });
      console.log(`PASS ${label}: five named targets, ${result.title}, title fits: ${result.titleFits}`);
      await context.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
