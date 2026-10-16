import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real economic React surfaces; browser-only fixtures, no DB or game writes. */
export async function verifyHonorBenefits(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=leaderboard&lng=${language}`);
      await page.locator('[data-v2-leaderboard]').waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(e => e.name);
        const react = resources.find(name => /\/react\.js\?/.test(name));
        const dom = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const query = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        const rulesUrl = resources.find(name => new URL(name).pathname.endsWith('/packages/rules/src/index.ts'));
        if (!react || !dom || !query || !rulesUrl) throw new Error('Missing gallery runtime');
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { HonorBenefitsSection }, { RepairStationSheet }, { TradeSheet }, { IntergalacticConvoySheet },
          { planetView }, rules, { Api }, { ApiProvider }, { keys }, { ToastProvider }, { default: i18n },
          { StrikeSheet }, { RadiationBombForge, RadiationBombLaunchPanel }] = await Promise.all([
          import(react), import(dom), import(query), import(url('/src/ui/HonorBenefits.tsx')),
          import(url('/src/screens/RepairStation.tsx')), import(url('/src/screens/TradeSheet.tsx')),
          import(url('/src/screens/IntergalacticConvoySheet.tsx')), import('/test/fixtures.ts'),
          import(rulesUrl),
          import(url('/src/api/client.ts')), import(url('/src/api/context.tsx')), import(url('/src/api/keys.ts')),
          import(url('/src/ui/Toast.tsx')), import(url('/src/i18n/index.ts')),
          import(url('/src/galaxy/FocusPanel.tsx')), import(url('/src/screens/RadiationBombControls.tsx')),
        ]);
        await i18n.changeLanguage(language);
        const rootNode = document.getElementById('root'); rootNode.style.display = 'none';
        const mount = document.createElement('div'); mount.className = 'v2-shell min-h-dvh bg-v2-void font-v2-ui text-v2-ink';
        mount.style.cssText = '--v2-top-h:0px;--v2-dock-h:0px'; document.body.append(mount);
        const root = createRoot(mount);
        const now = new Date(), start = new Date(now.getTime() - 30 * 60_000);
        const end = new Date(start.getTime() + 180 * 60_000);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        const api = new Api({ fetch: async () => { throw new Error('Unexpected fixture HTTP read'); } });
        client.setQueryData(keys.galaxy, { radiationModel: 'HP', radiation: [], hpRadiation: [] });
        const noop = () => undefined;
        const thresholds = rules.HONOR_BENEFIT_THRESHOLDS_V1;
        const benefit = score => ({ version: 1, score, thresholds, ...rules.honorBenefits(score, thresholds) });
        const crossing = { id: 'convoy', kind: 'INTERGALACTIC_CONVOY', startsAt: start, endsAt: end,
          appearsAtMinute: 0, expiresAtMinute: 180,
          route: { from: { x: -4500, y: 0, z: 0 }, to: { x: 4500, y: 0, z: 0 }, velocity: { x: 50, y: 0, z: 0 }, speed: 50 },
          visual: { formationVersion: 1 }, rewardPolicy: { resourceCapHours: 2, fullRewardForceRatio: 1,
            shipDropFullFirepower: 5780, shipDropChanceAtFullQuality: .15, maxAwardedShips: 3 } };
        const merchant = { id: 'merchant', kind: 'TRADE_SHIP', startsAt: start, endsAt: end, appearsAtMinute: 0, expiresAtMinute: 180,
          rate: rules.TRADE.rate, orbit: { radius: 1100, period: 2 * Math.PI * 1100 / rules.TRADE.speed,
            phase: .7, inclination: .4, ascendingNode: 1.9, speed: rules.TRADE.speed } };
        window.__honorBenefitVisual = (surface, score) => {
          const value = benefit(score);
          const lot = { id: 'damaged', hull: 'DART', count: 20, damageBp: 6400, remainderBp: .25,
            repairing: false, orderId: null, minutes: 10, cost: rules.shipHpRepairCost([{ hull: 'DART', count: 20, damageBp: 6400, remainderBp: .25 }], 50) };
          const world = planetView({ honorBenefits: value, honorTacticalCredit: score === 1,
            radiationBombsAvailable: true, radiationBombs: [{ id: 'ready-bomb', level: 1, status: 'READY', readyAt: null, remainingSeconds: 0 }],
            fleet: surface === 'repair' ? {} : { DART: 30, ATLAS: 12, COURIER: 20 },
            fleetDamage: [], dock: { pct: 50, lots: [lot], waiting: { cost: lot.cost, minutes: 10 } },
            queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] }, buildings: { CORE: 9, REFINERY: 9, EXTRACTOR: 9,
              VAULT: 3, SHIPYARD: 4, DEUTERIUM_PLANT: 3, HANGAR: 3 }, flight: { used: 0, total: 6 } },
          { position: { x: 0, y: 300, z: 0 }, alloy: 500000, crystal: 200000, deuterium: 100000 });
          const target = { id: 'target', name: 'Bellwether', kind: 'COLONY', intel: 'RESOLVED', position: { x: 500, y: 0, z: 0 } };
          const scene = surface === 'emp' ? h(StrikeSheet, { origin: world, target, onClose: noop, onConfirm: noop })
            : surface === 'bomb' ? h('main', { className: 'mx-auto max-w-xl p-3' }, h(RadiationBombLaunchPanel, {
              origin: world, target: { kind: 'PLANET', id: 'target' }, targetName: target.name, flightMs: 60000, pending: false, onLaunch: noop }))
            : surface === 'forge' ? h('main', { className: 'mx-auto max-w-xl p-3' }, h(RadiationBombForge, {
              planet: world, held: { alloy: 500000, crystal: 200000, deuterium: 100000 }, now: now.getTime(), pending: false, onBuild: noop }))
            : surface === 'tiers' ? h('main', { className: 'mx-auto flex max-w-xl flex-col gap-3 p-3' }, h(HonorBenefitsSection, { value }))
            : surface === 'repair' ? h(RepairStationSheet, { planet: world, held: { alloy: 500000, crystal: 200000, deuterium: 100000 }, onClose: noop })
            : surface === 'trade' ? h(TradeSheet, { merchant, seasonStart: start, planet: world, onClose: noop, onLaunched: noop })
            : h(IntergalacticConvoySheet, { event: crossing, seasonStart: start, planet: world, onClose: noop, onLaunched: noop });
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ToastProvider, null, h('div', { key: surface + score }, scene)))));
        };
      }, language);
      for (const [surface, scores] of [['tiers', [-100000000, -25000000, 0, 25000000, 75000000]],
        ['repair', [-100000000, 75000000]], ['trade', [-100000000, 75000000]], ['convoy', [-100000000, 75000000]],
        ['emp', [0, 1]], ['bomb', [0, 1]], ['forge', [0, 1]]]) {
        for (const score of scores) {
          await page.evaluate(({ surface, score }) => window.__honorBenefitVisual(surface, score), { surface, score });
          const tactical = ['emp', 'bomb', 'forge'].includes(surface);
          if (surface === 'forge') {
            await page.locator('.radiation-forge details summary').click();
          } else if (tactical) {
            await page.locator('[data-honor-weapon-rule]').waitFor();
          } else if (surface === 'tiers') {
            await page.locator('[data-honor-benefits]').waitFor();
            await page.locator('[data-honor-benefits] summary').click();
          } else if (surface === 'repair') {
            await page.locator('[data-testid="health-group"] input').fill('10');
            await page.locator('[data-honor-effect="repair"]').waitFor();
          } else if (surface === 'convoy') {
            await page.locator('input[inputmode="numeric"]').first().fill('20');
            await page.locator('[data-honor-effect="convoy"]').waitFor();
          } else {
            await page.locator('input[inputmode="numeric"]').first().fill('10');
            await page.locator('[data-honor-effect="trade"]').waitFor();
          }
          const selector = tactical ? '[data-honor-weapon-rule]' : surface === 'tiers' ? '[data-honor-benefits]' : `[data-honor-effect="${surface}"]`;
          await page.locator(selector).scrollIntoViewIfNeeded();
          const measurement = await page.locator(selector).evaluate(node => {
            const box = node.getBoundingClientRect();
            return { text: node.textContent, left: box.left, right: box.right, viewport: innerWidth,
              scroll: node.scrollWidth, width: node.clientWidth };
          });
          assert(measurement.left >= 0 && measurement.right <= width + 1 && measurement.scroll <= measurement.width + 1,
            JSON.stringify({ surface, score, language, width, ...measurement }));
          assert(!/honorBenefits\.|undefined|NaN/.test(measurement.text));
          assert(measurement.text.includes('Honor'));
          if (tactical) {
            const inactive = await page.evaluate(async () => (await import('/src/i18n/index.ts')).default.t('leaderboard.honorWeaponsInactive'));
            assert.equal(measurement.text.includes(inactive), score === 0, `${surface}/${language}: wrong seasonal weapon policy`);
            assert(!/leaderboard\.|planet\.radiationBomb\./.test(measurement.text));
          }
          await page.screenshot({ path: join(output, `${width}-${language}-${surface}-${score}.png`) });
          results.push({ surface, score, language, width, ...measurement });
        }
      }
      assert.deepEqual(errors, []);
      console.log(`PASS Honor economic surfaces ${width}px ${language}`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), JSON.stringify(results, null, 2) + '\n');
}
