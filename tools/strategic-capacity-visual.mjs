import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyStrategicCapacity(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/radiation-bomb-preview.html?lng=${language}`);
      await page.locator('[data-build-stats]').waitFor();
      await page.evaluate(async () => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { ToastProvider }, { PlanetScreen }, { planetView }, { keys }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/ui/Toast.tsx')),
          import(moduleUrl('/src/screens/PlanetScreen.tsx')), import(moduleUrl('/test/fixtures.ts')),
          import(moduleUrl('/src/api/keys.ts')),
        ]);
        const mount = document.createElement('div');
        document.getElementById('root').style.display = 'none';
        document.body.append(mount);
        const root = createRoot(mount);
        const api = new Api({ fetch: async () => new Response('{}', { status: 200 }) });
        window.__capacityReview = (level, fill = 0) => {
          const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
          const world = planetView({ buildings: { CORE: 13, REFINERY: 4, EXTRACTOR: 4, VAULT: 2, SHIPYARD: 5 },
            instruments: { RADAR: 3 }, orbit: ['UPLINK'], interceptors: Array.from({ length: fill }, (_, i) => ({
              id: `charge-${i}`, status: 'READY', readyAt: null, remainingSeconds: 0 })),
          }, { alloy: 500000, crystal: 500000, deuterium: 500000 });
          world.research = world.research.map(project => project.id === 'INTERCEPTION_GRID'
            ? { ...project, level, completed: level >= 2, discovered: true } : project);
          client.setQueryData(keys.planet, world);
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api },
            h(ToastProvider, null, h(PlanetScreen, { key: level, focusGroup: 'defend' })))));
        };
      });
      for (const [level, capacity] of [[0, 2], [1, 4], [2, 6]]) {
        await page.evaluate(level => { window.__capacityReview(level); }, level);
        const tally = page.locator('[data-interceptor-state] [data-tally]');
        await tally.waitFor();
        await page.waitForFunction(capacity => document.querySelector('[data-interceptor-state] [data-tally]')?.getAttribute('data-total') === String(capacity), capacity);
        assert.equal(await tally.getAttribute('data-total'), String(capacity));
        const panel = page.locator('[data-interceptor-state]');
        assert((await panel.locator('[data-interceptor-capacity]').textContent()).includes(String(capacity)), 'Visible capacity missing');
        await panel.scrollIntoViewIfNeeded();
        const fits = await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth);
        assert(fits, `${language}/${width}/L${level}: battery overflow`);
        await page.screenshot({ path: `${output}/${language}-${width}-grid-${level}.png`, fullPage: true });
        results.push({ language, width, level, capacity, fits });
      }
      await page.evaluate(() => { window.__capacityReview(1, 4); });
      const upgrade = page.locator('[data-capacity-next="INTERCEPTION_GRID"]');
      await upgrade.waitFor();
      assert((await upgrade.textContent()).includes('6'), 'Full L1 battery does not point to six-charge research');
      await upgrade.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${language}-${width}-grid-1-full.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, states: results.length, passed: true }));
}
