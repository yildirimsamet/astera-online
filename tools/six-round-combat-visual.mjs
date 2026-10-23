/** Real six-round reports, public rules and browser-worker responsiveness; no live API writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

export async function verifySixRoundCombat(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5193';
  const querySource = await (await fetch(`${web}/src/api/queries.ts`)).text();
  const queryModule = querySource.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
  assert(queryModule, 'React Query module missing');
  const rulesModule = `/@fs${resolve('packages/rules/src/index.ts')}`;
  const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks'] });
  const measurements = [];
  try {
    for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
      await page.route('**/six-round-preview', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const {QueryClient, QueryClientProvider} = await import('${queryModule}');
const {ApiProvider} = await import('/src/api/context.tsx'); const {Api} = await import('/src/api/client.ts');
const {BattleReports} = await import('/src/screens/BattleReports.tsx');
const {MonumentReportSheet} = await import('/src/screens/MonumentReportSheet.tsx');
const {MonumentBattleRules} = await import('/src/screens/MonumentBattleRules.tsx');
const {RepairStationSheet} = await import('/src/screens/RepairStation.tsx');
const {planetView} = await import('/test/fixtures.ts');
const {WikiArticleContent} = await import('/src/wiki/WikiContent.tsx');
const {getWikiArticle} = await import('/src/wiki/catalog.ts');
await import('/src/wiki/styles.css');
const {useBattleForecast} = await import('/src/lib/useBattleForecast.ts');
const {ForceCompare} = await import('/src/ui/ForceCompare.tsx');
const {ToastProvider} = await import('/src/ui/Toast.tsx');
const {reportsSchema} = await import('/src/api/schemas.ts');
const {resolveBattle, mulberry32, battleRetreated, fleetCount, activeBattleFleet, monumentBattleControl} = await import('${rulesModule}');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css');
const side = {tech:{SHIP_SHIELDS:4}};
let battle;
for (let seed=0;seed<128;seed++) {
 const trial=resolveBattle([{contributionId:'a',playerId:'a',fleet:{CORSAIR:20},tech:side}],
 [{stackId:'d',playerId:'d',fleet:{CORSAIR:20},tech:side}],0,mulberry32(seed),'HP_PLANET',true);
 if(trial.rounds.length===6 && trial.rounds.some(r=>r.round===5 && r.retreats.length>0)) {battle=trial;break;}
}
if(!battle) throw new Error('No sixth-round fixture with fifth-round retreat');
const rounds = battle.rounds.map(({retreats,casualties,...r})=>({...r,
 yourRetreated:battleRetreated([{...r,retreats}],'ATTACK','a'),
 theirRetreatedCount:fleetCount(battleRetreated([{...r,retreats}],'DEFENCE'))}));
const report={kind:'BATTLE',id:'six-round',missionId:'six-round',at:new Date(),grade:battle.grade,attacking:true,
 opponentName:'ÖrnekRakip',opponentPlanet:'Örnek-91',opponentPlanetId:'p2',yourPlanet:'Asterion',neutral:false,rounds,
 yourFleet:{CORSAIR:20},yourLosses:battle.attackerLosses,theirFleet:{},theirLosses:battle.defenderLosses,
 yourDamage:battle.attackerDamage,yourRetreated:battle.attackerRetreated,theirRetreatedCount:fleetCount(battle.defenderRetreated),
 lootAlloy:0,lootCrystal:0,lootDeuterium:0,dominion:0,dominionBreakdown:null,shieldBefore:0,shieldAfter:0,shieldAbsorbed:0};
const data=reportsSchema.parse({reports:[report],rivals:[]});
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
client.setQueryData(['reports'],data);client.setQueryData(['season'],{rivals:[],shieldUntil:null});
const api=new Api();api.reports=async()=>data;api.season=async()=>({rivals:[],shieldUntil:null});
const h=React.createElement;const root=createRoot(document.getElementById('root'));
const plate=(...children)=>h('main',{style:{maxWidth:'650px',margin:'auto',padding:'16px'}},...children);
window.drawRules=async language=>{await i18n.changeLanguage(language);root.render(plate(h(MonumentBattleRules)));};
window.drawReport=async language=>{await i18n.changeLanguage(language);root.render(h(QueryClientProvider,{client},h(ApiProvider,{api},h(ToastProvider,null,h(BattleReports,{open:{missionId:'six-round',request:Date.now()}})))));};
window.drawMonument=()=>{
 const m=reportsSchema.parse({rivals:[],reports:[{kind:'MONUMENT',id:'six-monument',at:new Date(),grade:battle.grade,attacking:true,
 control:monumentBattleControl(battle.attackerCombatSurvivors,activeBattleFleet(battle.defenderSurvivors,battle.defenderRetreated)),
 monument:{id:'m',ordinal:1,position:{x:6000,y:0,z:0}},roundCount:6,yourFleet:{CORSAIR:20},yourSurvivors:battle.attackerSurvivors,
 yourLosses:battle.attackerLosses,theirLosses:battle.defenderLosses,yourDamage:battle.attackerDamage,
 yourRetreated:battle.attackerRetreated,theirRetreatedCount:fleetCount(battle.defenderRetreated),lootDeuterium:0,dominion:0,
 rounds:rounds.map(r=>({round:r.round,distributedFire:true,yourLosses:r.attackerLosses,theirLosses:r.defenderLosses,
 yourRetreated:r.yourRetreated,theirRetreatedCount:r.theirRetreatedCount}))}]}).reports[0];
 root.render(h(MonumentReportSheet,{report:m,onClose:()=>{}}));
};
const request={wing:{CORSAIR:100},input:{attackerTech:{},defenderTech:{},shield:{low:0,high:0},unarmed:{low:0,high:0},wall:{kind:'UNKNOWN'}},power:{low:100000,high:150000}};
function ForecastPreview(){const f=useBattleForecast(request);window.forecastState=f.pending?'pending':f.error?'error':'ready';
 return plate(h('p',{'data-forecast-state':window.forecastState},i18n.t(f.pending?'counter.forecastCalculating':'reports.heading')),
 h(ForceCompare,{yours:1000000,theirs:{low:100000,high:150000,source:'probe',ageMinutes:0},lines:f.lines,loss:f.loss}));}
window.drawRepair=async language=>{await i18n.changeLanguage(language);
 const planet=planetView({fleet:{DART:51},fleetDamage:Array.from({length:51},(_,index)=>({hull:'DART',count:1,damageBp:index+1,remainderBp:.25})),
 dock:{pct:100,lots:[],waiting:{cost:{alloy:0,crystal:0,deuterium:0},minutes:0}},queues:{CONSTRUCTION:[],YARD:[],REPAIR:[]}});
 root.render(h(QueryClientProvider,{client},h(ApiProvider,{api},h(ToastProvider,null,h(RepairStationSheet,{planet,held:{alloy:1000000,crystal:1000000,deuterium:1000000},onClose:()=>{}})))));
};
window.drawWiki=language=>root.render(h('main',{className:'wiki wiki-room',style:{maxWidth:'900px',margin:'auto',padding:'12px'}},h(WikiArticleContent,{article:getWikiArticle('combat.model'),language})));
window.drawForecast=()=>{window.heartbeats=0;window.heartbeatTimer=setInterval(()=>window.heartbeats++,20);root.render(h(ForecastPreview));};
window.ready=true;await window.drawRules('tr');
</script></body></html>` }));
      await page.goto(`${web}/six-round-preview`);
      await page.waitForFunction(() => window.ready === true);
      for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
        await page.evaluate(language => window.drawRules(language), language);
        const help = page.locator('main details');
        if (!await help.evaluate(element => element.open)) await help.locator('summary').click();
        await page.evaluate(() => document.fonts.ready);
        const text = await page.locator('main').textContent();
        assert(text.includes('6') && text.includes('5') && !text.includes('{{'), `${language}: stale public rules`);
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${language}: rules overflow`);
        await page.screenshot({ path: `${output}/${language}-${width}-rules.png`, fullPage: true });
        measurements.push({ language, width, kind: 'rules', fits: true });
      }
      for (const language of ['tr', 'en']) {
        await page.evaluate(language => window.drawReport(language), language);
        await page.locator('[data-combat-round="6"]').waitFor({ state: 'attached' });
        assert.equal(await page.locator('[data-combat-round]').count(), 6);
        const help = page.locator('[data-distributed-fire-rules]');
        await help.locator('summary').click();
        await help.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${language}-${width}-report-model.png` });
        await page.locator('[data-combat-round="5"]').scrollIntoViewIfNeeded();
        assert(await page.locator('[data-combat-round="5"] [data-battle-retreat]').count() > 0);
        await page.screenshot({ path: `${output}/${language}-${width}-report-round5.png` });
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Report overflow');
        await page.evaluate(() => window.drawMonument());
        const ledger = page.locator('details').filter({ has: page.locator('[data-monument-round]') });
        await ledger.locator('summary').click();
        assert.equal(await page.locator('[data-monument-round]').count(), 6);
        await page.locator('[data-monument-round="5"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${language}-${width}-monument-round5.png` });
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Monument report overflow');
        measurements.push({ language, width, kind: 'reports', rounds: 6, fifthRoundRetreat: true, fits: true });
      }
      for (const language of ['tr', 'en']) {
        await page.evaluate(language => window.drawRepair(language), language);
        const batch = page.getByRole('button', { name: language === 'tr' ? 'İlk 50 can grubunu seç' : 'Select first 50 health groups' });
        await batch.click();
        assert(await page.getByRole('button', { name: language === 'tr' ? 'Tamirhaneye aktar' : 'Move to workshop' }).isEnabled());
        await batch.scrollIntoViewIfNeeded();
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Repair batch overflow');
        await page.screenshot({ path: `${output}/${language}-${width}-repair-batch.png` });
        await page.evaluate(language => window.drawWiki(language), language);
        await page.locator('.wiki-article h1').waitFor();
        assert((await page.locator('.wiki-article').textContent()).includes('1–5'));
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'Combat Wiki overflow');
        await page.screenshot({ path: `${output}/${language}-${width}-wiki.png`, fullPage: true });
        measurements.push({ language, width, kind: 'repair-and-wiki', fits: true });
      }
      await page.evaluate(() => window.drawForecast());
      await page.waitForFunction(() => window.forecastState === 'pending');
      const before = await page.evaluate(() => window.heartbeats);
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => window.heartbeats);
      assert(after > before, 'Forecast blocked the main browser thread');
      await page.waitForFunction(() => window.forecastState === 'ready', null, { timeout: 60000 });
      const heartbeats = await page.evaluate(() => { clearInterval(window.heartbeatTimer); return window.heartbeats; });
      await page.screenshot({ path: `${output}/${width}-forecast-worker.png`, fullPage: true });
      assert.deepEqual(errors, []);
      measurements.push({ width, kind: 'forecast', heartbeats, responsive: true });
      await page.close();
    }
    await writeFile(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
    console.log(`PASS ${measurements.length} checks: six languages, mobile/desktop reports and responsive worker`);
  } finally { await browser.close(); }
}
