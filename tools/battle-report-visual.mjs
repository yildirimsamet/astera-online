/** Isolated design previews of real report/launch components. No API or DB writes. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Representative data, not an incident replay: casualty distribution is illustrative.
const wing = { DART: 20, PIKE: 50, WARDEN: 15, RAMPART: 10, COURIER: 6, WAYFARER: 3 };
const enemyLosses = { DART: 3, PIKE: 5, TALON: 9, VIPER: 3, BASTION: 1, THORN: 1 };
const rounds = [
  { round: 1, attackerDamage: 3262, defenderDamage: 3966, shieldBefore: 203, shieldAfter: 0,
    shieldAbsorbed: 203, attackerHullDamage: 3059, attackerRoll: 1.02, defenderRoll: 1.03,
    shieldBreakerDamage: 0, attackerLosses: { DART: 20, PIKE: 40, WARDEN: 4 },
    defenderLosses: { DART: 3, PIKE: 5, TALON: 6, VIPER: 1, THORN: 1 } },
  { round: 2, attackerDamage: 1026, defenderDamage: 2495, shieldBefore: 0, shieldAfter: 0,
    shieldAbsorbed: 0, attackerHullDamage: 1026, attackerRoll: 0.99, defenderRoll: 1.03,
    shieldBreakerDamage: 0, attackerLosses: { PIKE: 10, WARDEN: 11, RAMPART: 10 },
    defenderLosses: { TALON: 3, VIPER: 2, BASTION: 1 } },
  { round: 3, attackerDamage: 0, defenderDamage: 3257, shieldBefore: 0, shieldAfter: 0,
    shieldAbsorbed: 0, attackerHullDamage: 0, attackerRoll: 1, defenderRoll: 1,
    shieldBreakerDamage: 0, attackerLosses: { COURIER: 6, WAYFARER: 3 }, defenderLosses: {} },
];

const sample = {
  id: 'design-report', missionId: 'design-mission', at: '2026-09-15T01:23:00Z',
  grade: 'REPELLED', attacking: true, opponentName: 'ÖrnekRakip', opponentPlanet: 'Örnek-91',
  opponentPlanetId: 'design-target', neutral: false, yourPlanet: 'Örnek-237', rounds,
  yourFleet: wing, yourLosses: wing, theirFleet: {}, theirLosses: enemyLosses,
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: -38680,
  dominionBreakdown: { ruleVersion: 7, lootValue: 0, enemyPermanentLossValue: 22026,
    ownPermanentLossValue: 60706, rawExchange: -38680 },
  shieldBefore: 203, shieldAfter: 0, shieldAbsorbed: 203,
};

function fixture(kind) {
  if (kind === 'defender' || kind === 'legacy') return { ...sample, attacking: false,
    grade: kind === 'legacy' ? 'DECISIVE' : 'REPELLED', dominion: 38680,
    dominionBreakdown: null, yourFleet: kind === 'legacy' ? {} : { ...enemyLosses, RAMPART: 30 },
    yourLosses: enemyLosses, theirFleet: kind === 'legacy' ? {} : wing, theirLosses: wing };
  if (kind === 'partial') return { ...sample, grade: 'PARTIAL', shieldBefore: 20300,
    shieldAfter: 20097, dominion: null, dominionBreakdown: null, yourLosses: { DART: 10 }, rounds: [{ ...rounds[0], shieldBefore: 20300,
      shieldAfter: 20097, attackerLosses: { DART: 10 }, defenderLosses: enemyLosses }] };
  if (kind === 'walkover') return { ...sample, grade: 'DECISIVE', rounds: [], yourLosses: {},
    theirLosses: {}, shieldAfter: 203, shieldAbsorbed: 0, lootAlloy: 500, dominion: 500, dominionBreakdown: null };
  if (kind === 'mutual') return { ...sample, grade: 'DECISIVE', dominion: null, dominionBreakdown: null,
    yourFleet: { DART: 20 }, yourLosses: { DART: 20 }, theirLosses: { PIKE: 10 },
    rounds: [{ ...rounds[0], attackerDamage: 3000, defenderDamage: 3000, attackerHullDamage: 2797,
      attackerLosses: { DART: 20 }, defenderLosses: { PIKE: 10 } }] };
  return sample;
}

export async function verifyBattleReports(out) {
  await mkdir(out, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  // The provider must share Vite's exact dependency URL with useReports;
  // a second URL instantiates a second React Query context.
  const querySource = await (await fetch(`${web}/src/api/queries.ts`)).text();
  const queryModule = querySource.match(/from "([^"]*\/@tanstack_react-query\.js[^"]*)"/)?.[1];
  if (!queryModule) throw new Error('Cannot resolve the app\u2019s React Query module');
  const launchSource = await (await fetch(`${web}/src/screens/LaunchSheet.tsx`)).text();
  const toastModule = launchSource.match(/from "([^"]*\/Toast\.tsx[^"]*)"/)?.[1];
  if (!toastModule) throw new Error('Cannot resolve the app\u2019s toast module');
  const browser = await chromium.launch();
  try {
    for (const language of ['tr', 'en']) {
      for (const viewport of [{ width: 350, height: 812 }, { width: 1188, height: 900 }]) {
        const page = await browser.newPage({ viewport, locale: language });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
        // Refuse all network API traffic; all reads below use in-memory fixtures.
        await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
        for (const kind of ['attacker', 'defender', 'partial', 'walkover', 'mutual', 'legacy', 'launch']) {
          await page.route('**/battle-design-preview', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { QueryClient, QueryClientProvider } = await import('${queryModule}');
const { ApiProvider } = await import('/src/api/context.tsx');
const { Api } = await import('/src/api/client.ts');
const { BattleReports } = await import('/src/screens/BattleReports.tsx');
const { LaunchSheet } = await import('/src/screens/LaunchSheet.tsx');
const { ToastProvider } = await import('${toastModule}');
const { planetView } = await import('/test/fixtures.ts');
const { reportsSchema, intelSchema } = await import('/src/api/schemas.ts');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('${language}');
const data = reportsSchema.parse({ reports: [${JSON.stringify(fixture(kind))}], rivals: [] });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(['reports'], data); client.setQueryData(['season'], { shieldUntil: null });
const api = new Api(); api.reports = async () => data; api.season = async () => ({ shieldUntil: null });
const planet = planetView({ fleet: ${JSON.stringify(wing)} }, { deuterium: 20000 });
const intel = intelSchema.parse({ watching: [], radarLog: [], probeCost: { alloy: 50, crystal: 30, deuterium: 0 },
  probeReports: [{ targetPlanetId: 'design-target', targetName: 'Örnek-91', targetUsername: 'ÖrnekRakip',
    at: new Date(), accuracy: 0.67, stock: { low: 1000, high: 2000 }, deuteriumStock: null, defence: { low: 26882, high: 53364 },
    fleetSize: { low: 35, high: 72 }, fleetHome: true, detected: false, doctrines: {},
    classReading: { kind: 'DOMINANT', cls: 'LANCE' }, shield: { low: 133, high: 265 }, unarmed: { low: 2, high: 5 } }] });
const target = { kind: 'world', world: { id: 'design-target', name: 'Örnek-91', owner: 'ÖrnekRakip',
  position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6, intel: 'RESOLVED',
  state: { kind: 'NORMAL' }, satellites: [], shielded: true, isSelf: false } };
const content = '${kind}' === 'launch'
  ? React.createElement(LaunchSheet, { target, planet, intel, onClose: () => {}, onLaunched: () => {} })
  : React.createElement(BattleReports, { open: { missionId: 'design-mission', request: 1 } });
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider, { client },
  React.createElement(ApiProvider, { api }, React.createElement(ToastProvider, null, content))));
</script></body></html>` }));
          await page.goto(`${web}/battle-design-preview`);
          await page.getByRole('dialog').waitFor();
          await page.evaluate(() => document.fonts.ready);
          const prefix = `${out}/${language}-${viewport.width}-${kind}`;
          if (kind === 'launch') {
            const bands = page.locator('[data-fleet-family] > button');
            for (let i = 0; i < await bands.count(); i++) {
              const button = bands.nth(i);
              if (await button.getAttribute('aria-expanded') === 'false') await button.click();
            }
            for (const hull of ['DART', 'PIKE', 'WARDEN', 'RAMPART', 'COURIER', 'WAYFARER']) {
              await page.locator('[data-hull-row="' + hull + '"] [data-count-max] button').click();
            }
            await page.locator('[data-sheet-scroll]').evaluate(body => body.scrollTo({ top: 0 }));
          }
          await page.waitForTimeout(450);
          await page.screenshot({ path: `${prefix}.png` });
          if (kind === 'launch') {
            await page.locator('[data-hull-row="PIKE"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-ships.png` });
          }
          if (kind === 'attacker') {
            await page.locator('[data-report-section="who"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-force.png` });
            await page.locator('[data-combat-round="2"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-rounds.png` });
          }
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow: ${prefix}`);
          console.log(`Captured ${prefix}.png`);
          await page.unroute('**/battle-design-preview');
        }
        if (errors.length) throw new Error(errors.join('\n'));
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
