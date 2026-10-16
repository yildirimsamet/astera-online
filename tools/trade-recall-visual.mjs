/** Browser-only fixtures drive the real trade composer, shared recall hook and native flight surface. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyTradeRecall(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      const labels = await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { usePending, useRecallFlight }, { keys }, { TradeSheet }, { ThreadFocus },
          { flightRecallInput }, { ToastProvider }, { planetView }, { default: i18n }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/queries.ts')),
          import(moduleUrl('/src/api/keys.ts')), import(moduleUrl('/src/screens/TradeSheet.tsx')),
          import(moduleUrl('/src/galaxy/FocusPanel.tsx')), import(moduleUrl('/src/lib/flights.ts')),
          import(moduleUrl('/src/ui/Toast.tsx')), import(moduleUrl('/test/fixtures.ts')), import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const now = Date.now();
        const id = '0f5e3c2a-7a39-4a8b-9d6e-1f2a3b4c5d6e';
        const home = { x: 0, y: 0, z: 0 };
        let thread = { id, kind: 'trade', targetName: 'TRADE_SHIP', minutesRemaining: 10, fleet: { COURIER: 4 },
          arriveAt: new Date(now + 600_000), leg: 'outbound', recallable: true,
          path: { from: home, to: { x: 1100, y: 0, z: 0 }, departAt: new Date(now - 300_000), arriveAt: new Date(now + 600_000) } };
        const requests = [];
        window.__tradeRecallReview = { requests };
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        client.setQueryData(keys.galaxy, { radiationModel: 'HP', radiation: [], hpRadiation: [] });
        const api = new Api({ fetch: async (url, init) => {
          const path = String(url);
          if (path.endsWith(`/api/trade/runs/${id}/recall`) && init?.method === 'POST') {
            requests.push(path);
            thread = { ...thread, recallable: undefined, leg: 'return', arriveAt: new Date(now + 300_000),
              path: { from: { x: 350, y: 0, z: 0 }, to: home, departAt: new Date(now), arriveAt: new Date(now + 300_000) } };
            return new Response(JSON.stringify({ runId: id, homeAt: thread.arriveAt }), { status: 200 });
          }
          if (path.endsWith('/api/session/pending')) return new Response(JSON.stringify({ pending: [thread] }), { status: 200 });
          if (path.endsWith('/api/galaxy')) return new Response(JSON.stringify({ radiationModel: 'HP', radiation: [], hpRadiation: [] }), { status: 200 });
          throw new Error(`Unexpected fixture request: ${path}`);
        } });
        const origin = planetView({ fleet: { ATLAS: 2, COURIER: 4 } }, { alloy: 5000, crystal: 5000, deuterium: 5000 });
        const merchant = { id, kind: 'TRADE_SHIP', startsAt: new Date(now - 30 * 60_000), endsAt: new Date(now + 150 * 60_000),
          appearsAtMinute: 570, expiresAtMinute: 750, rate: { alloy: 1, crystal: 2, deuterium: 32 },
          orbit: { radius: 1100, period: 280, phase: 0.7, inclination: 0.4, ascendingNode: 1.9, speed: 24.7 } };
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        document.body.append(mount);
        const root = createRoot(mount);
        const wrap = content => h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ToastProvider, null, content)));
        root.render(wrap(h(TradeSheet, { merchant, planet: origin, seasonStart: new Date(now - 600 * 60_000), onClose: () => undefined, onLaunched: () => undefined })));
        function RecallReview() {
          const pending = usePending();
          const recall = useRecallFlight();
          const current = pending.data?.pending[0];
          return current ? h(ThreadFocus, { thread: current, minutesRemaining: 10, open: true, onToggle: () => undefined, onClose: () => undefined,
            recalling: recall.isPending, onRecall: () => { const input = flightRecallInput(current); if (input) recall.mutate(input); } }) : null;
        }
        window.__tradeRecallReview.showRecall = () => root.render(wrap(h(RecallReview)));
        return { recall: i18n.t('pendingStrip.recallFleet'), warning: language === 'tr' ? 'Yakıt iade edilmez' : 'Fuel is not refunded' };
      }, language);
      const dialog = page.getByRole('dialog');
      await dialog.locator('[data-hull-row="ATLAS"]').getByRole('button').last().click();
      await dialog.getByText(labels.warning, { exact: false }).waitFor();
      const fits = await dialog.evaluate(element => element.scrollWidth <= element.clientWidth && document.documentElement.scrollWidth <= innerWidth);
      assert(fits, 'Trade composer overflows');
      await page.screenshot({ path: join(output, `${width}-${language}-composer.png`) });
      await page.evaluate(() => window.__tradeRecallReview.showRecall());
      await page.getByRole('button', { name: labels.recall, exact: true }).waitFor();
      await page.screenshot({ path: join(output, `${width}-${language}-outbound.png`) });
      await page.getByRole('button', { name: labels.recall, exact: true }).click();
      await page.getByRole('button', { name: labels.recall, exact: true }).waitFor({ state: 'detached' });
      const requests = await page.evaluate(() => window.__tradeRecallReview.requests);
      assert.equal(requests.length, 1);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `${width}-${language}-returning.png`) });
      results.push({ width, language, fits, requests });
      console.log(`PASS trade recall ${width}px ${language}: preflight guidance, native recall, returning state`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
