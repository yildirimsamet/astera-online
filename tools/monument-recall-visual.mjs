/** Actual flight surfaces and native recall requests, with browser-only state. No game writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyMonumentRecall(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en']) {
        for (const surface of ['fleet', 'list', 'focus']) {
          const page = await browser.newPage({ viewport: { width, height: 812 } });
          await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined }); });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.routeWebSocket('**/*', () => undefined);
          await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
          await page.getByRole('tab').first().waitFor();
          const labels = await page.evaluate(async ({ language, surface }) => {
            const resources = performance.getEntriesByType('resource').map(entry => entry.name);
            const reactUrl = resources.find(name => /\/react\.js\?/.test(name));
            const domUrl = resources.find(name => /\/react-dom_client\.js\?/.test(name));
            const queryUrl = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
            const rulesUrl = resources.findLast(name => /\/packages\/rules\/src\/index\.ts/.test(name));
            if (!reactUrl || !domUrl || !queryUrl || !rulesUrl) throw new Error('Gallery modules not loaded');
            const moduleUrl = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
            const [
              { default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
              { Api }, { ApiProvider }, { keys }, { monumentsSchema }, { useMonuments, useRecallFlight },
              { monumentPendingThreads }, { flightRecallInput }, { FleetHost }, { FlightList },
              { ThreadFocus }, { Sheet }, { ToastProvider }, { planetView }, { default: i18n }, { travelExact },
            ] = await Promise.all([
              import(reactUrl), import(domUrl), import(queryUrl), import(moduleUrl('/src/api/client.ts')),
              import(moduleUrl('/src/api/context.tsx')), import(moduleUrl('/src/api/keys.ts')),
              import(moduleUrl('/src/api/schemas.ts')), import(moduleUrl('/src/api/queries.ts')),
              import(moduleUrl('/src/lib/monumentFlights.ts')), import(moduleUrl('/src/lib/flights.ts')),
              import(moduleUrl('/src/v2/shell/FleetHost.tsx')), import(moduleUrl('/src/shell/PendingStrip.tsx')),
              import(moduleUrl('/src/galaxy/FocusPanel.tsx')), import(moduleUrl('/src/ui/kit/index.ts')),
              import(moduleUrl('/src/ui/Toast.tsx')), import(moduleUrl('/test/fixtures.ts')),
              import(moduleUrl('/src/i18n/index.ts')), import(rulesUrl),
            ]);
            await i18n.changeLanguage(language);
            const now = Date.now();
            const id = '00000000-0000-4000-8000-000000000001';
            const waveId = '00000000-0000-4000-8000-000000000002';
            const homeId = '00000000-0000-4000-8000-000000000003';
            const lots = [{ id: '00000000-0000-4000-8000-000000000004', hull: 'ARGOSY', count: 2,
              damageBp: 2000, remainderBp: 0.125, maxHp: 1350, remainingHp: 1079.983125, deuterium: 125.5, cargoCapacity: 600 }];
            const route = [{ from: { x: 3500, y: 0, z: 0 }, to: { x: 6000, y: 0, z: 0 },
              startMs: now - 240_000, endMs: now + 720_000 }];
            const wave = { id: waveId, monumentId: id, playerId: id, originPlanetId: homeId, rootWaveId: null,
              jointOperationId: null, purpose: 'ATTACK', status: 'OUTBOUND', sentAt: new Date(route[0].startMs),
              heldAt: null, arriveAt: new Date(route[0].endMs), position: { x: 4125, y: 0, z: 0 }, route,
              tech: {}, fleet: { ARGOSY: 2 }, lots, deuterium: 125.5, productionPerMinute: 0, fillsAt: null, nextLossAt: null,
              returnForecast: { homePlanetId: homeId, homePosition: route[0].from, speed: travelExact(625, 1) / 9,
                arriveAt: new Date(now + 540_000), minutes: 9,
                doseHp: 50, destroyed: 0, deuterium: 125.5, lostDeuterium: 0, lots } };
            let view = monumentsSchema.parse({ serverNow: new Date(now), waves: [wave], probes: [], probeReports: [],
              monuments: [{ id, ordinal: 5, position: route[0].to, controller: { kind: 'NEUTRAL' },
                capacity: 7270, used: 1, reserved: 0, productionPerMinute: 60, emptySince: null }] });
            const planet = planetView({ rulesetVersion: 16, fleet: { DART: 4 }, flight: { used: 1, total: 3 } }, { id: homeId });
            const mining = { derrick: false, craftSpeed: 330, craftHold: 400, derrickHold: 600,
              craftReadyAt: null, craftCooldowns: [], isotopes: [], runs: [] };
            const field = { asteroids: [], debris: [], nextFieldChangeAt: null };
            const review = { requests: [], unexpected: [], now };
            Date.now = () => review.now;
            window.__monumentRecallReview = review;
            const api = new Api({ fetch: async (input, init) => {
              const url = String(input);
              let body;
              if (init?.method === 'POST') {
                review.requests.push({ url, body: JSON.parse(init.body), key: new Headers(init.headers).get('idempotency-key') });
                view = { ...view, waves: [{ ...view.waves[0], status: 'RETURNING', returnReason: 'RECALLED',
                  arriveAt: new Date(now + 540_000), route: [{ from: wave.position, to: route[0].from, startMs: now, endMs: now + 540_000 }] }] };
                body = { wave: { id: waveId, monumentId: id, status: 'RETURNING' } };
              } else if (url.endsWith('/api/monuments')) body = view;
              else if (url.endsWith('/api/planet')) body = planet;
              else if (url.endsWith('/api/session/pending')) body = { pending: [] };
              else if (url.endsWith('/api/galaxy/traffic')) body = { contacts: [] };
              else if (url.endsWith('/api/mining/field')) body = field;
              else if (url.endsWith('/api/mining/status')) body = mining;
              else if (url.endsWith('/api/clan/support')) body = { waves: [] };
              else { review.unexpected.push(url); throw new Error(`Unexpected fixture read: ${url}`); }
              return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
            } });
            const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
            for (const [key, value] of [[keys.monuments, view], [keys.planet, planet], [keys.pending, { pending: [] }],
              [keys.traffic, { contacts: [] }], [keys.miningField, field], [keys.miningStatus, mining], [keys.clanSupport, { waves: [] }]]) {
              client.setQueryData(key, value);
            }
            const idle = () => undefined;
            function FocusPreview() {
              const catalog = useMonuments().data;
              const recall = useRecallFlight();
              const thread = monumentPendingThreads(catalog)[0];
              return thread ? h(ThreadFocus, { thread, minutesRemaining: 12, open: true, onClose: idle, onToggle: idle,
                recalling: recall.isPending, onRecall() { const intent = flightRecallInput(thread); if (intent) recall.mutate(intent); } }) : null;
            }
            const content = surface === 'fleet' ? h(FleetHost, { onFocus: idle, onFocusWorld: idle, onClose: idle, onOpenRepairStation: idle })
              : surface === 'list' ? h(Sheet, { title: i18n.t('pendingStrip.sheetTitle'), onClose: idle },
                h(FlightList, { onFocus: idle, onDone: idle })) : h(FocusPreview);
            document.getElementById('root').style.display = 'none';
            const mount = document.createElement('div');
            mount.style.cssText = 'position:fixed;inset:0;--v2-top-h:0px;--v2-dock-h:0px';
            document.body.append(mount);
            createRoot(mount).render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, h(ToastProvider, null, content))));
            return { recall: i18n.t(surface === 'fleet' ? 'fleetPage.recall' : 'pendingStrip.recallFleet'),
              forecast: i18n.t('fleetPage.recallHome', { time: '9m 00s' }) };
          }, { language, surface });
          const button = page.getByRole('button', { name: labels.recall, exact: surface !== 'fleet' });
          await button.waitFor();
          await page.evaluate(() => document.fonts.ready);
          // Wait for the opening sheet to settle before recording its visible controls.
          await button.click({ trial: true });
          const geometry = await button.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return { width: bounds.width, fits: element.scrollWidth <= element.clientWidth,
              pageFits: document.documentElement.scrollWidth <= innerWidth,
              inViewport: bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth };
          });
          assert.ok(geometry.fits && geometry.pageFits && geometry.inViewport);
          const label = `${language}-${width}-${surface}`;
          await page.screenshot({ path: join(output, `${label}-outbound.png`) });
          if (surface === 'fleet') {
            const before = await button.getAttribute('aria-label');
            await page.evaluate(() => { window.__monumentRecallReview.now += 30_000; });
            await page.waitForFunction(({ name, before }) => {
              const current = [...document.querySelectorAll('button')].find(element => element.getAttribute('aria-label')?.startsWith(name));
              return current && current.getAttribute('aria-label') !== before;
            }, { name: labels.recall, before });
            assert.notEqual(await button.getAttribute('aria-label'), before);
          }
          await button.click();
          await button.waitFor({ state: 'hidden' });
          const review = await page.evaluate(() => window.__monumentRecallReview);
          assert.equal(review.requests.length, 1);
          assert.match(review.requests[0].url, /\/api\/monuments\/waves\/.+\/recall$/);
          assert.deepEqual(review.requests[0].body, { all: true });
          assert.match(review.requests[0].key, /^monument-flight-recall:/);
          assert.deepEqual(review.unexpected, []);
          assert.deepEqual(errors, []);
          await page.screenshot({ path: join(output, `${label}-returning.png`) });
          results.push({ label, ...geometry, request: review.requests[0] });
          console.log(`PASS ${label}: native recall, all surviving ships, returning action hidden`);
          await page.close();
        }
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
