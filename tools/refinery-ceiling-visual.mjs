import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** The permanent refinery ceiling on the real card and detail sheet. */
export async function verifyRefineryCeiling(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Other local edits must not reload the page during this deterministic review.
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/radiation-bomb-preview.html?lng=${language}`);
      await page.locator('[data-build-stats]').waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const react = resources.find(name => /\/react\.js\?/.test(name));
        const dom = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const query = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { ToastProvider }, { PlanetScreen }, { planetView }, { keys }, { default: i18n }] = await Promise.all([
          import(react), import(dom), import(query), import(url('/src/api/client.ts')),
          import(url('/src/api/context.tsx')), import(url('/src/ui/Toast.tsx')),
          import(url('/src/screens/PlanetScreen.tsx')), import(url('/test/fixtures.ts')),
          import(url('/src/api/keys.ts')), import(url('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div'); mount.className = 'v2-shell';
        document.body.append(mount);
        const root = createRoot(mount);
        const api = new Api({ fetch: async () => new Response('{}', { status: 200 }) });
        window.__refineryReview = level => {
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          const world = planetView({ buildings: { CORE: 15, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 5, DEUTERIUM_PLANT: level } },
            { alloy: 500000, crystal: 500000, deuterium: 500000 });
          world.research = world.research.map(project => project.id === 'DEUTERIUM_SYNTHESIS'
            ? { ...project, level: 5, completed: true, discovered: true } : project);
          client.setQueryData(keys.planet, world);
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api },
            h(ToastProvider, null, h(PlanetScreen, { key: level, focusGroup: 'grow' })))));
        };
      }, language);
      for (const level of [14, 15]) {
        await page.evaluate(level => window.__refineryReview(level), level);
        const row = page.locator('#row-DEUTERIUM_PLANT');
        await row.waitFor();
        await page.waitForFunction(({ level }) => document.querySelector('#row-DEUTERIUM_PLANT [data-progression-state]')?.getAttribute('data-progression-state') === (level === 15 ? 'complete' : 'owned'), { level });
        await row.scrollIntoViewIfNeeded();
        assert(await row.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
        await page.screenshot({ path: `${output}/${language}-${width}-L${level}-row.png`, fullPage: true });
        await row.locator('[data-open-item]').click();
        const sheet = page.getByRole('dialog');
        await sheet.waitFor();
        assert.equal(await sheet.locator('[data-rung="16"]').count(), 0);
        assert.equal(await sheet.locator('[data-rung="17"]').count(), 0);
        assert.equal(await sheet.locator('[data-rung="15"]').count(), level === 14 ? 1 : 0);
        if (level === 15) {
          assert((await sheet.textContent()).includes(language === 'tr' ? 'en üst seviyede' : 'at its highest level'));
          assert.equal(await sheet.locator('[data-act] button').count(), 0);
        }
        assert(await sheet.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${output}/${language}-${width}-L${level}-sheet.png`, fullPage: true });
        results.push({ language, width, level, passed: true });
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, states: results.length, passed: true }));
}
