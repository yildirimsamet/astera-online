import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Actual maintenance screens with fixture data; no game API writes. */
export async function verifyShipMaintenance(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      const labels = await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
        const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!reactUrl || !domUrl || !queryUrl) throw new Error('Gallery modules not loaded');
        const [{ default: { createElement: h } }, { default: { createRoot } },
          { QueryClient, QueryClientProvider }, { Api }, { ApiProvider }, { WorldProvider }, { keys },
          { RepairStationSheet }, { ToastProvider }, { planetView }, { default: i18n }, { FleetPage }, { roomOf }] = await Promise.all([
          import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
          import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/world.tsx')), import(moduleUrl('/src/api/keys.ts')),
          import(moduleUrl('/src/screens/RepairStation.tsx')), import(moduleUrl('/src/ui/Toast.tsx')),
          import(moduleUrl('/test/fixtures.ts')), import(moduleUrl('/src/i18n/index.ts')),
          import(moduleUrl('/src/v2/hud/FleetPage.tsx')), import(moduleUrl('/src/lib/fleetPage.ts')),
        ]);
        await i18n.changeLanguage(language);
        const stock = { alloy: 100_000, crystal: 100_000, deuterium: 100_000 };
        const base = planetView({ rulesetVersion: 18, fleet: { DART: 14, CITADEL: 2 },
          fleetDamage: [{ hull: 'DART', count: 2, damageBp: 9500 },
            { hull: 'DART', count: 12, damageBp: 1000, remainderBp: 0.25 }],
          dock: { pct: 75, lots: [{ id: 'wounded', hull: 'WARDEN', count: 8, damageBp: 7000,
            remainderBp: 0.25, repairing: false, orderId: null,
            cost: { alloy: 2000, crystal: 800, deuterium: 0 }, minutes: 20 }],
            waiting: { cost: { alloy: 2000, crystal: 800, deuterium: 0 }, minutes: 20 } },
          queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] }, workshopRadiation: false },
        { ...stock, id: '00000000-0000-4000-8000-000000000001', name: 'Asterion' });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        const list = { playerId: 'owner', seasonId: 'season', capitalPlanetId: base.planet.id, planets: [base] };
        client.setQueryData(keys.planets, list);
        client.setQueryData(keys.planetById(base.planet.id), base);
        const api = new Api({ fetch: async input => {
          if (!String(input).endsWith('/api/planets')) throw new Error(`Unexpected fixture API: ${String(input)}`);
          return new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } });
        } });
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('div');
        document.body.append(mount);
        const root = createRoot(mount);
        window.__maintenanceFleet = (radiation = false) => root.render(h(FleetPage, {
          key: `fleet-${radiation}`, tab: 'home', onTab: () => undefined, now: Date.now(),
          bays: { used: 1, total: 3 }, hangar: { used: 54, total: 80 }, flights: [],
          worlds: [{ id: base.planet.id, name: base.planet.name, capital: true, active: true,
            fleet: base.fleet, damage: base.fleetDamage, workshopRadiation: radiation, away: 6,
            room: roomOf({ hangar: 80, hangarUsed: 54, hangarCeiling: 180, ground: 20, groundUsed: 4 }), docked: 8 }],
          recalling: null, onFocus: () => undefined, onRecall: () => undefined,
          onOpenRepairStation: () => undefined, onFocusWorld: () => undefined,
          onDock: () => undefined, onClose: () => undefined,
        }));
        window.__maintenanceRadiation = () => root.render(h(ApiProvider, { api }, h(QueryClientProvider, { client },
          h(WorldProvider, null, h(ToastProvider, null, h(RepairStationSheet,
            { key: 'radiation', planet: { ...base, workshopRadiation: true }, held: stock, onClose: () => undefined }))))));
        root.render(h(ApiProvider, { api }, h(QueryClientProvider, { client }, h(WorldProvider, null,
          h(ToastProvider, null, h(RepairStationSheet, { planet: base, held: stock, onClose: () => undefined }))))));
        return { ...Object.fromEntries(['scrap', 'scrapAction', 'workshop', 'return', 'move', 'clear'].map(key => [key, i18n.t(`repairStation.maintenance.${key}`)])),
          selectAll: i18n.t('repairStation.selectAll') };
      }, language);
      const panel = page.getByRole('dialog').last();
      await panel.getByTestId('health-group').first().waitFor();
      const measure = async state => {
        await page.waitForTimeout(500);
        const dimensions = await panel.evaluate(node => ({
          fits: node.scrollWidth <= node.clientWidth && document.documentElement.scrollWidth <= innerWidth,
          footerButtons: [...node.querySelectorAll('button')].filter(button => button.closest('footer') || button.dataset.testid === 'confirm-commit').map(button => {
            const rect = button.getBoundingClientRect();
            return { fits: button.scrollWidth <= button.clientWidth, visible: rect.top >= 0 && rect.bottom <= innerHeight };
          }),
        }));
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) });
        assert(dimensions.fits, `${language}/${width}/${state} overflows`);
        assert(dimensions.footerButtons.every(button => button.fits && button.visible), `${language}/${width}/${state}: hidden or clipped action`);
        results.push({ width, language, state, ...dimensions });
      };
      await measure('hangar');
      await panel.getByTestId('health-group').first().getByRole('textbox').fill('1');
      await panel.getByRole('button', { name: labels.selectAll, exact: true }).click();
      assert.deepEqual(await panel.getByRole('textbox').evaluateAll(nodes => nodes.map(node => Number(node.value)).sort((a, b) => a - b)), [2, 12]);
      await measure('hangar-selected-all');
      await panel.getByRole('button', { name: labels.clear, exact: true }).click();
      assert.deepEqual(await panel.getByRole('textbox').evaluateAll(nodes => nodes.map(node => Number(node.value))), [0, 0]);
      await panel.getByRole('tab', { name: labels.scrap, exact: true }).click();
      await panel.getByTestId('health-group').last().getByRole('textbox').fill('1');
      await panel.getByRole('button', { name: labels.scrapAction, exact: true }).click();
      await page.getByTestId('confirm-commit').waitFor();
      await measure('scrap-confirmation');
      await page.evaluate(() => window.__maintenanceRadiation());
      await panel.getByRole('status').waitFor();
      await panel.getByRole('tab', { name: labels.workshop, exact: true }).click();
      await panel.getByTestId('health-group').first().getByRole('textbox').fill('1');
      assert.equal(await panel.getByRole('button', { name: labels.return, exact: true }).isEnabled(), true);
      await measure('radiation');
      await page.evaluate(() => window.__maintenanceFleet());
      await panel.getByTestId('health-group').first().waitFor();
      await panel.getByTestId('health-group').first().getByRole('textbox').fill('1');
      assert.equal(await panel.getByRole('button', { name: labels.move, exact: true }).isEnabled(), true);
      assert(await panel.getByRole('button', { name: /Asterion/ }).locator('span').evaluate(node => node.scrollWidth <= node.clientWidth), `${language}/${width}: fleet world name clipped`);
      await measure('fleet');
      await page.evaluate(() => window.__maintenanceFleet(true));
      await panel.getByTestId('health-group').first().waitFor();
      assert.equal(await panel.getByRole('button', { name: labels.move, exact: true }).isEnabled(), false);
      await measure('fleet-radiation');
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${language}/${width}: hangar, scrap confirmation, radiation, return and fleet`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
