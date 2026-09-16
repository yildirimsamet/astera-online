/** Real mining/transfer/probe components with in-memory fixtures; no API or DB writes. */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const web = process.env.WEB ?? 'http://localhost:5173';
const out = process.argv[2] ?? 'out/miner-recall-components';
await mkdir(out, { recursive: true });
const source = await (await fetch(`${web}/src/api/queries.ts`)).text();
const queryModule = source.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
if (!queryModule) throw new Error('Cannot resolve the app’s React Query module');
const pendingSource = await (await fetch(`${web}/src/shell/PendingStrip.tsx`)).text();
const toastModule = pendingSource.match(/from "([^"]*\/Toast\.tsx[^"]*)"/)?.[1];
if (!toastModule) throw new Error('Cannot resolve the app’s toast module');
const browser = await chromium.launch();
try {
  for (const language of ['tr', 'en']) {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: language });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.abort());
    for (const surface of ['pending', 'transfer', 'probe']) {
      await page.route('**/miner-recall-preview', (route) => route.fulfill({
        contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { QueryClient, QueryClientProvider } = await import('${queryModule}');
const { ApiProvider } = await import('/src/api/context.tsx');
const { Api } = await import('/src/api/client.ts');
const { keys } = await import('/src/api/keys.ts');
const { PendingStrip } = await import('/src/shell/PendingStrip.tsx');
const { TransferSheet } = await import('/src/screens/TransferSheet.tsx');
const { PlanetFocus } = await import('/src/galaxy/FocusPanel.tsx');
const { ToastProvider } = await import('${toastModule}');
const { planetView } = await import('/test/fixtures.ts');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('${language}');
const now = Date.now();
const originId = '00000000-0000-4000-8000-000000000001';
const run = { id: '00000000-0000-4000-8000-000000000002', planetId: originId,
  targetKind: 'asteroid', asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', debrisFieldId: null,
  craft: 2, status: 'outbound', recalledAt: null, departAt: new Date(now - 60000),
  arriveAt: new Date(now + 600000), homeAt: null, intercept: { x: 400, y: 0, z: 80 },
  minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0 };
const status = { derrick: false, craftSpeed: 330, craftHold: 400, derrickHold: 600,
  craftReadyAt: null, craftCooldowns: [], isotopes: [], runs: [run] };
const field = { asteroids: [], debris: [], nextFieldChangeAt: null };
const planet = planetView({ fleet: { DART: 10, PROSPECTOR: 2, COURIER: 2 },
  flight: { used: 1, total: 3 } }, { id: originId, alloy: 10000, crystal: 5000, deuterium: 5000 });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(keys.planet, planet); client.setQueryData(keys.miningStatus, status);
client.setQueryData(keys.miningField, field); client.setQueryData(keys.pending, { pending: [] });
client.setQueryData(keys.traffic, { contacts: [] });
const api = new Api();
api.miningStatus = async () => status; api.miningField = async () => field;
api.pending = async () => ({ pending: [] }); api.traffic = async () => ({ contacts: [] });
api.recallMining = async () => {
  const recalledAt = new Date(); const homeAt = new Date(recalledAt.getTime() + 120000);
  return { runId: run.id, homeAt, mining: { ...status,
    runs: [{ ...run, status: 'returning', recalledAt, arriveAt: recalledAt, homeAt }] }, pending: [], planet };
};
const world = { id: 'target', name: 'Örnek-91', owner: 'Sable', position: { x: 200, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false };
const intel = { watching: [], probeReports: [], radarLog: [], probeCost: { alloy: 65, crystal: 40, deuterium: 0 },
  probeCooldowns: [{ targetPlanetId: world.id, readyAt: new Date(now + 5000) }] };
const content = '${surface}' === 'pending' ? React.createElement(PendingStrip, { onFocus: () => {} })
  : '${surface}' === 'transfer' ? React.createElement(TransferSheet, {
    target: { id: 'colony', name: 'Örnek-91', position: world.position }, planet,
    onClose: () => {}, onLaunched: () => {} })
  : React.createElement(PlanetFocus, { target: world, planet, intel, reports: [], now,
    onClose: () => {}, onAttack: () => {}, onInstallTelescope: () => {}, onLaunched: () => {},
    open: true, onToggle: () => {} });
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider, { client },
  React.createElement(ApiProvider, { api }, React.createElement(ToastProvider, null, content))));
</script></body></html>` }));
      await page.goto(`${web}/miner-recall-preview`);
      await page.evaluate(() => document.fonts.ready);
      if (surface === 'pending') {
        await page.getByRole('button', { name: /open flights|havadaki araçları aç/i }).click();
        const recall = page.getByRole('button', { name: /recall prospectors|kazıcıları geri çağır/i });
        await recall.waitFor();
        await recall.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/${language}-350-outbound.png` });
        await recall.click();
        await recall.waitFor({ state: 'hidden' });
        await page.screenshot({ path: `${out}/${language}-350-returning.png` });
      } else if (surface === 'transfer') {
        await page.getByRole('dialog').waitFor();
        if (await page.locator('[data-hull-row="PROSPECTOR"]').count()) throw new Error('Prospector transfer row is visible');
        await page.screenshot({ path: `${out}/${language}-350-transfer.png` });
      } else {
        const cooling = page.getByRole('button', { name: /another probe|yeni sonda/i });
        await cooling.waitFor();
        await page.screenshot({ path: `${out}/${language}-350-probe-cooling.png` });
        await page.getByRole('button', { name: /send a probe|sonda gönder/i }).waitFor({ timeout: 7000 });
        await page.screenshot({ path: `${out}/${language}-350-probe-ready.png` });
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow: ${language}/${surface}`);
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`PASS ${language} / ${surface} / 350px`);
      await page.unroute('**/miner-recall-preview');
    }
    await page.close();
  }
} finally { await browser.close(); }
