/** Open the normal report list and each report detail with isolated API fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyBattleIntel(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5197';
  const source = await (await fetch(`${web}/src/api/queries.ts`)).text();
  const queryModule = source.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
  assert(queryModule, 'React Query module missing');
  const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks'] });
  const results = [];
  try {
    for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
      await page.route('**/battle-intel-check', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const {QueryClient, QueryClientProvider} = await import('${queryModule}');
const {ApiProvider} = await import('/src/api/context.tsx');
const {Api} = await import('/src/api/client.ts');
const {BattleReports} = await import('/src/screens/BattleReports.tsx');
const {reportsSchema} = await import('/src/api/schemas.ts');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('${language}');
const root=createRoot(document.getElementById('root'));
window.draw=(monument,visibility,attacking)=>{
 const raw={id:'battle-intel',missionId:'battle-intel',at:new Date(),grade:'REPELLED',attacking,opponentName:'ÖrnekRakip',
 opponentPlanet:'Asterion',opponentPlanetId:'target',yourPlanet:'Home',neutral:false,rounds:[{round:1,attackerDamage:100,defenderDamage:200,shieldAbsorbed:0,shieldBreakerDamage:0,attackerLosses:{DART:2},defenderLosses:{CORSAIR:1}}],
 yourFleet:{DART:2},yourLosses:{DART:2},theirLosses:{CORSAIR:1},theirFleet:visibility==='FULL'?{CORSAIR:4,ARGOSY:1}:{},
 replayStatus:visibility==='INSUFFICIENT_FORCE'?'INSUFFICIENT_FORCE':'NOT_RECORDED',enemyFleetVisibility:visibility,lootAlloy:0,lootCrystal:0,lootDeuterium:0,dominion:0,
 ...(monument?{kind:'MONUMENT',monument:{id:'m',ordinal:1,position:{x:6000,y:0,z:0}},control:'DEFENDER',roundCount:1,rounds:[],yourSurvivors:{},yourDamage:[]}: {})};
 const data=reportsSchema.parse({reports:[raw],rivals:[]});
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
 client.setQueryData(['reports'],data);client.setQueryData(['season'],{rivals:[],shieldUntil:null});client.setQueryData(['notifications'],{notifications:[]});
 const api=new Api();api.reports=async()=>data;api.season=async()=>({rivals:[],shieldUntil:null});
 root.render(React.createElement(QueryClientProvider,{client,key:visibility+monument+attacking},React.createElement(ApiProvider,{api},React.createElement('main',{style:{maxWidth:'700px',margin:'auto',padding:'12px'}},React.createElement(BattleReports)))));
}; window.ready=true;
</script></body></html>` }));
      await page.goto(`${web}/battle-intel-check`);
      await page.waitForFunction(() => window.ready === true);
      for (const monument of [false, true]) for (const visibility of ['FULL', 'INSUFFICIENT_FORCE', 'UNKNOWN']) for (const attacking of visibility === 'INSUFFICIENT_FORCE' ? [true] : [true, false]) {
        await page.evaluate(({ monument, visibility, attacking }) => window.draw(monument, visibility, attacking), { monument, visibility, attacking });
        await page.locator('[data-report-row]').click();
        const section = page.locator(visibility === 'FULL' ? `[data-their-board="${attacking ? 'full' : 'arrived'}"]` : `[data-enemy-intel="${visibility}"]`);
        await section.waitFor();
        await section.scrollIntoViewIfNeeded();
        if (visibility === 'FULL') {
          assert.equal(await page.locator('[data-enemy-hull]').count(), 2);
          if (!monument) {
            const scene = page.locator('[data-side="theirs"]');
            assert((await scene.innerText()).includes('5 → 4'), 'The scene must show the full force too');
          }
          const text = await page.getByRole('dialog').innerText();
          assert(!text.includes('sayıları gizli') && !text.includes('their count is hidden'), 'Full intelligence contradicts the verdict');
        }
        else assert.equal(await page.locator('[data-enemy-hull]').count(), 0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth
          || [...document.querySelectorAll('[data-sheet-body]')].some(el => el.scrollWidth > el.clientWidth + 1));
        assert.equal(overflow, false, `${language}/${width}/${monument}/${visibility} overflow`);
        await page.screenshot({ path: `${output}/${language}-${width}-${monument ? 'monument' : 'planet'}-${attacking ? 'attack' : 'defence'}-${visibility}.png` });
        results.push({ language, width, monument, attacking, visibility, overflow });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2));
  console.log(`Battle intelligence: ${results.length} report-list/detail checks passed.`);
}
