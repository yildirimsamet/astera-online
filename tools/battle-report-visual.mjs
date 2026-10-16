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
  if (kind === 'preserved-shield') return { ...fixture('low-tier'),
    pvpBalance: { lootDecisive: 0.6, lootPartial: 0.3, lootBufferShare: 0.5,
      recoveryLossHours: 4, recoveryLookbackHours: 6, recoveryShieldHours: 8 },
    recovery: { lossHours: 4, shielded: true, until: new Date(new Date(sample.at).getTime() + 11 * 3_600_000).toISOString() },
  };
  if (kind === 'low-tier' || kind === 'low-tier-progress') return { ...sample,
    attacking: false, grade: 'DECISIVE', yourFleet: { DART: 4 }, yourLosses: { DART: 4 }, theirLosses: {},
    theirFleet: { DART: 20, COURIER: 6 }, dominionBreakdown: null,
    rounds: [{ ...rounds[0], attackerLosses: {}, defenderLosses: { DART: 4 } }],
    pvpBalance: { lootDecisive: 0.25, lootPartial: 0.125, lootBufferShare: 0.6,
      recoveryLossHours: 2, recoveryLookbackHours: 8, recoveryShieldHours: 12 },
    recovery: { lossHours: kind === 'low-tier' ? 2.4 : 1.5, shielded: kind === 'low-tier' },
  };
  if (kind === 'fractional' || kind === 'fractional-defender') return { ...sample,
    attacking: kind === 'fractional', grade: 'PARTIAL', dominion: 0, dominionBreakdown: null,
    yourFleet: { CATACLYSM: 2, DART: 1 }, yourLosses: {}, theirLosses: {},
    rounds: [{ ...rounds[0], attackerLosses: {}, defenderLosses: {} }],
    yourDamage: [
      { hull: 'CATACLYSM', count: 1, damageBp: 0, remainderBp: 0.8857506709106965 },
      { hull: 'CATACLYSM', count: 1, damageBp: 2000, remainderBp: Number.MIN_VALUE },
      { hull: 'DART', count: 1, damageBp: 2000, remainderBp: 0 },
    ] };
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
        for (const kind of ['attacker', 'defender', 'partial', 'walkover', 'mutual', 'legacy', 'fractional', 'fractional-defender', 'low-tier', 'low-tier-progress', 'preserved-shield', 'launch']) {
          await page.route('**/battle-design-preview', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root { --v2-top-h: 0px; --v2-dock-h: 0px; }</style></head><body><div id="root"></div>
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
const { ToastProvider } = await import('/src/ui/Toast.tsx');
const { planetView } = await import('/test/fixtures.ts');
const { reportsSchema, intelSchema } = await import('/src/api/schemas.ts');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('${language}');
const data = reportsSchema.parse({ reports: [${JSON.stringify(fixture(kind))}], rivals: [] });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(['reports'], data); client.setQueryData(['season'], { shieldUntil: null, rivals: [] });
const api = new Api(); api.reports = async () => data; api.season = async () => ({ shieldUntil: null, rivals: [] });
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
            await page.locator('[data-sheet-body]').evaluate(body => body.scrollTo({ top: 0 }));
          }
          await page.waitForTimeout(450);
          await page.screenshot({ path: `${prefix}.png` });
          if (kind === 'launch') {
            await page.locator('[data-hull-row="PIKE"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-ships.png` });
          }
          if (kind === 'low-tier' || kind === 'low-tier-progress' || kind === 'preserved-shield') {
            const recovery = page.locator('[data-recovery-shield]');
            await recovery.scrollIntoViewIfNeeded();
            const text = await recovery.textContent();
            const duration = kind === 'preserved-shield' ? '11' : '12';
            const history = kind === 'preserved-shield' ? '6' : '8';
            if (!text?.includes(duration) || !text.includes(history)) throw new Error(`Wrong recovery duration/history: ${text}`);
            if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
              throw new Error(`Low-tier report overflows at ${viewport.width}px`);
            }
            await page.screenshot({ path: `${prefix}-recovery.png` });
            const formula = page.locator('[data-combat-formula]');
            await page.locator('details').filter({ has: formula }).locator('summary').click();
            await formula.scrollIntoViewIfNeeded();
            if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
              throw new Error(`Loot rules overflow at ${viewport.width}px`);
            }
            await page.screenshot({ path: `${prefix}-rules.png` });
          }
          if (kind === 'attacker') {
            await page.locator('[data-report-section="who"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-force.png` });
            await page.locator('[data-combat-round="2"]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${prefix}-rounds.png` });
          }
          if (kind === 'fractional' || kind === 'fractional-defender') {
            const damage = page.locator('[data-report-damage]');
            await damage.scrollIntoViewIfNeeded();
            const box = await damage.boundingBox();
            if (!box || box.y < 0 || box.y + box.height > viewport.height) {
              throw new Error(`Fractional damage is outside the viewport: ${prefix}: ${JSON.stringify(box)}`);
            }
            const rows = await damage.locator('li').allTextContents();
            const expected = await page.evaluate(async () => {
              const i18n = (await import('/src/i18n/index.ts')).default;
              const { hullLabel } = await import('/src/i18n/names.ts');
              return [
                i18n.t('reportScene.damageLot', { name: hullLabel('CATACLYSM'), count: 1, pct: 1 }),
                i18n.t('reportScene.damageLot', { name: hullLabel('CATACLYSM'), count: 1, pct: 21 }),
                i18n.t('reportScene.damageLot', { name: hullLabel('DART'), count: 1, pct: 20 }),
              ];
            });
            if (rows.length !== expected.length || expected.some((text, index) => !rows[index].includes(text))) {
              throw new Error(`Incorrect fractional damage: ${prefix}: ${JSON.stringify(rows)}`);
            }
            if (kind === 'fractional-defender') {
              const labels = await page.evaluate(async () => {
                const i18n = (await import('/src/i18n/index.ts')).default;
                return { hangar: i18n.t('repairStation.maintenance.hangar') };
              });
              if (rows.some(row => !row.includes(labels.hangar))) {
                throw new Error(`Incorrect damaged-ship maintenance state: ${prefix}`);
              }
            }
            await page.screenshot({ path: `${prefix}-damage.png` });
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
