/** Real research, hull and report components on fixture data. No live game API writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyShipShields(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const source = await (await fetch(`${web}/src/api/queries.ts`)).text();
  const queryModule = source.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
  assert(queryModule, 'Could not resolve the app React Query module');
  const browser = await chromium.launch();
  const checks = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: width === 350 ? 812 : 900 } });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); process.stderr.write(`${error.message}\n`); });
      await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
      await page.goto(`${web}/v2-gallery.html?view=base-research&lng=${language}`);
      const star = page.locator('[data-star="SHIP_SHIELDS"]');
      await star.click();
      const card = page.locator('[data-constellation-card="SHIP_SHIELDS"]');
      await card.waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert((await card.textContent()).includes('50'), 'Next research gain is missing');
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${language}-${width}-research.png`, fullPage: true });
      const open = page.getByRole('button', { name: language === 'tr' ? 'Ayrıntılar' : 'Details', exact: true });
      await open.click();
      await page.locator('[data-research-portrait]').waitFor();
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Research overflows');
      await page.screenshot({ path: `${output}/${language}-${width}-research-detail.png`, fullPage: true });

      await page.route('**/ship-shields-preview', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { QueryClient, QueryClientProvider } = await import('${queryModule}');
const { ApiProvider } = await import('/src/api/context.tsx'); const { Api } = await import('/src/api/client.ts');
const { HullStats } = await import('/src/screens/PlanetScreen.tsx');
const { BattleReports } = await import('/src/screens/BattleReports.tsx');
const { MonumentReportSheet } = await import('/src/screens/MonumentReportSheet.tsx');
const { ToastProvider } = await import('/src/ui/Toast.tsx');
const { reportsSchema } = await import('/src/api/schemas.ts');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('${language}');
const report = { id: 'shield-preview', missionId: 'shield-mission', at: new Date(), grade: 'PARTIAL', attacking: true,
  opponentName: 'ÖrnekRakip', opponentPlanet: 'Örnek-91', opponentPlanetId: 'target', neutral: false, yourPlanet: 'Asterion',
  rounds: [{ round: 1, attackerDamage: 800, defenderDamage: 300, shieldBefore: 100, shieldAfter: 0,
    shieldAbsorbed: 100, shieldBreakerDamage: 0, attackerHullDamage: 460, attackerRoll: 1, defenderRoll: 1,
    attackerShipShieldAbsorbed: 120, defenderShipShieldAbsorbed: 240, attackerLosses: {DART: 2}, defenderLosses: {DART: 3} }],
  yourFleet: {DART: 10}, yourLosses: {DART: 2}, theirFleet: {}, theirLosses: {DART: 3},
  lootAlloy: 100, lootCrystal: 50, lootDeuterium: 0, dominion: 0, dominionBreakdown: null, shieldBefore: 100, shieldAfter: 0, shieldAbsorbed: 100 };
const data = reportsSchema.parse({ reports: [report], rivals: [] });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(['reports'], data); client.setQueryData(['season'], { shieldUntil: null, rivals: [] });
const api = new Api(); api.reports = async () => data; api.season = async () => ({ shieldUntil: null, rivals: [] });
const root = createRoot(document.getElementById('root')); const h = React.createElement;
window.drawHull = level => root.render(h('main', {style:{maxWidth:'600px',padding:'16px',margin:'auto'}},
  h('h1', null, 'Corsair · '+level+'/4'), h(HullStats, {hull:'CORSAIR', tech:{SHIP_ARMOR:2, SHIP_SHIELDS:level}})));
window.drawReport = () => root.render(h(QueryClientProvider, {client}, h(ApiProvider, {api},
  h(ToastProvider, null, h(BattleReports, {open:{missionId:'shield-mission',request:1}})))));
window.drawMonument = attacking => {
  const monument = reportsSchema.parse({reports:[{kind:'MONUMENT',id:'cargo-retreat',at:new Date(),
    attacking,grade:'REPELLED',control:'ATTACKER',defenderCargoRetreated:true,roundCount:3,
    monument:{id:'monument',ordinal:1,position:{x:6000,y:0,z:0}},
    yourFleet:attacking?{CORSAIR:3}:{CORSAIR:1,ARGOSY:1},yourSurvivors:attacking?{CORSAIR:3}:{ARGOSY:1},
    yourLosses:attacking?{}:{CORSAIR:1},yourDamage:[],theirLosses:attacking?{CORSAIR:1}:{},
    lootDeuterium:0,dominion:0}],rivals:[]}).reports[0];
  root.render(h(MonumentReportSheet,{report:monument,onClose:()=>{}}));
};
window.drawHull(0);
</script></body></html>` }));
      await page.goto(`${web}/ship-shields-preview`);
      await page.waitForFunction(() => typeof window.drawHull === 'function');
      for (const level of [0, 3, 4]) {
        await page.evaluate(level => window.drawHull(level), level);
        await page.waitForFunction(level => document.querySelector('h1')?.textContent.endsWith(`${level}/4`), level);
        const shield = page.locator('[data-stat="ship-shield"]');
        await shield.waitFor();
        await page.screenshot({ path: `${output}/${language}-${width}-hull-${level}.png`, fullPage: true });
        assert(await shield.isVisible());
      }
      await page.evaluate(() => window.drawReport());
      const toggle = page.getByText(language === 'tr' ? 'Tur tur ne oldu' : 'How the battle unfolded', { exact: false });
      if (await toggle.count()) await toggle.click();
      const absorption = page.locator('[data-round-ship-shields]');
      await absorption.waitFor();
      await absorption.scrollIntoViewIfNeeded();
      assert((await absorption.textContent()).includes('120') && (await absorption.textContent()).includes('240'));
      await page.screenshot({ path: `${output}/${language}-${width}-report.png`, fullPage: true });
      for (const attacking of [true, false]) {
        await page.evaluate(attacking => window.drawMonument(attacking), attacking);
        const retreat = page.getByText(language === 'tr' ? 'Savunanın yük gemileri geri çekildi.' : 'Defending cargo ships retreated.', { exact: true });
        await retreat.waitFor();
        await page.getByText(language === 'tr' ? 'Savaş kuralları' : 'Battle rules', { exact: true }).click();
        await page.screenshot({ path: `${output}/${language}-${width}-monument-${attacking ? 'attack' : 'defence'}.png`, fullPage: true });
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Monument report overflows');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert(!overflow, `${language}/${width}: overflow`);
      assert.deepEqual(errors, []);
      checks.push({ language, width, levels: [0, 3, 4], overflow, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(JSON.stringify({ output, passed: true, checks }));
}
