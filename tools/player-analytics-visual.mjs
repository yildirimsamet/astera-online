import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Local fixtures only; the temporary mount imports the real private panel. */
export async function verifyPlayerAnalytics(output) {
  await mkdir(output, { recursive: true });
  const origin = process.env.ASTERA_VISUAL_WEB ?? 'http://127.0.0.1:5197';
  const fixturePath = new URL('../apps/web/src/playerAnalyticsVisual.tmp.tsx', import.meta.url);
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    await writeFile(fixturePath, `import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsAdminPanel } from './screens/AnalyticsAdminPanel';
import { Api } from './api/client';
import { ApiProvider } from './api/context';
import { ItemSheet } from './ui/ItemSheet';
import { PasswordResetSheet } from './screens/PasswordResetSheet';
import { planetView } from '../test/fixtures';
import i18n from './i18n/index';
await i18n.changeLanguage('tr');
document.getElementById('root')!.style.display = 'none';
document.documentElement.removeAttribute('data-public-surface');
const root = document.createElement('div');
root.className = 'mx-auto max-w-3xl px-3 font-v2-ui text-v2-ink';
document.body.append(root);
const mounted = createRoot(root);
mounted.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ApiProvider api={new Api()}><AnalyticsAdminPanel /></ApiProvider></QueryClientProvider>);
export function showItem() { mounted.render(<ItemSheet item={{kind:'instrument',id:'TELESCOPE'}} name="Teleskop" role="Keşif" planet={planetView()} held={{alloy:0,crystal:0}} pending={false} onAct={() => {}} onClose={() => {}} />); }
export function showRecovery() { mounted.render(<ApiProvider api={new Api()}><PasswordResetSheet onClose={() => {}} /></ApiProvider>); }
`);
    for (const [name, width, height] of [['mobile', 350, 740], ['phone', 390, 844], ['desktop', 1440, 960]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR', reducedMotion: 'reduce' });
      const received = [], errors = [];
      await context.route(url => url.origin !== origin, route => route.abort());
      await context.route(url => url.pathname.startsWith('/api/'), async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        let status = 200, body;
        if (path === '/api/analytics/visitors') {
          received.push({ method: request.method(), path });
          body = { visitorId: randomUUID(), credential: 'v'.repeat(43), expiresAt: new Date(Date.now() + 86400000).toISOString() };
        } else if (path === '/api/analytics/events') {
          const { events } = request.postDataJSON(); received.push(...events);
          body = { accepted: events.length, duplicates: 0 };
        } else if (path === '/api/admin/analytics') body = report();
        else if (path.endsWith('/events')) body = { events: [], nextBefore: null };
        else if (path === '/api/servers') body = { servers: [] };
        else { status = 401; body = { error: { code: 'UNAUTHENTICATED', message: 'Anonymous fixture' } }; }
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => { errors.push(error.message); });
      await page.goto(`${origin}/tr/`);
      await page.getByTestId('landing-primary').waitFor();
      await page.screenshot({ path: `${output}/${name}-landing.png` });
      const google = page.getByRole('dialog', { name: 'Çerez ve reklam tercihin', exact: true });
      if (await google.count()) await google.getByRole('button', { name: /reddet|izin verme/i }).click();
      assert.equal(await page.locator('[data-player-analytics-notice]').count(), 0, 'No extra measurement permission dialog');
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.ok(received.some(e => e.name === 'landing_visible'));
      assert.equal(await page.evaluate(() => sessionStorage.getItem('astera.player-analytics.v1')), null);
      await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); });
      await page.getByRole('button', { name: /zaten bir komutanım var/i }).click();
      await page.getByRole('dialog', { name: 'Giriş yap', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.ok(received.some(e => e.name === 'landing_visible'));
      assert.ok(received.some(e => e.name === 'login_clicked'));
      assert.ok(!received.some(e => e.name === 'play_clicked'));
      await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); });
      await context.route(url => url.pathname.endsWith('/onboarding/flightSchool/FlightSchool.tsx'), route => route.abort());
      await page.getByTestId('landing-primary').click();
      await page.getByRole('alert').waitFor();
      await new Promise(resolve => setTimeout(resolve, 250));
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      await new Promise(resolve => setTimeout(resolve, 250));
      const play = received.find(e => e.name === 'play_clicked'), failure = received.find(e => e.name === 'training_load_failed');
      assert.ok(play && failure); assert.equal(play.properties.attemptId, failure.properties.attemptId);
      assert.ok(!received.some(e => e.name === 'training_started'));
      await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); });
      // Render the real admin component through a temporary Vite entry, without credentials.
      await page.evaluate(async () => { await import('/src/playerAnalyticsVisual.tmp.tsx'); });
      await page.locator('[data-analytics-admin]').waitFor();
      await page.getByRole('button', { name: 'Nova', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Eğitim adımları').locator('li').count(), 11);
      assert.equal(await page.getByText('Davranış ölçümü yok', { exact: true }).count(), 1);
      assert.ok(await page.getByText(/Ana sayfa: 120 ziyaret/).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow`);
      await page.screenshot({ path: `${output}/${name}-admin.png`, fullPage: true });
      await page.getByRole('button', { name: 'Nova', exact: true }).click();
      await page.getByText('Bu hesap için gözlenen olay yok.', { exact: true }).waitFor();
      await page.evaluate(async () => { (await import('/src/playerAnalyticsVisual.tmp.tsx')).showItem(); });
      await page.getByRole('dialog', { name: 'Teleskop', exact: true }).waitFor();
      await new Promise(resolve => setTimeout(resolve, 250));
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.ok(received.some(event => event.name === 'blocker_visible' && event.properties.code === 'insufficient_resources'));
      assert.ok(!received.some(event => event.name === 'command_attempted'));
      await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); });
      await page.screenshot({ path: `${output}/${name}-visible-requirement.png` });
      await page.evaluate(async () => { (await import('/src/playerAnalyticsVisual.tmp.tsx')).showRecovery(); });
      await new Promise(resolve => setTimeout(resolve, 250));
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.ok(received.some(event => event.name === 'surface_visible' && event.properties.surface === 'password_recovery'));
      await page.screenshot({ path: `${output}/${name}-recovery.png` });
      // The deliberately aborted training import must reach the existing crash boundary.
      assert.ok(errors.every(message => /Failed to fetch dynamically imported module|Importing a module script failed/.test(message)), JSON.stringify(errors));
      results.push({ name, width, noExtraPermissionDialog: true, noPersistentMeasurementIdentifier: true, landing: true, login: true, playFailureCorrelated: true, visibleRequirementWithoutAttempt: true, trainingRows: 11, noHorizontalOverflow: true });
      await context.close();
    }
    await writeFile(`${output}/acceptance.json`, JSON.stringify(results, null, 2));
    console.log('Player analytics browser acceptance PASS');
  } finally { await browser.close(); await unlink(fixturePath).catch(() => undefined); }
}

function report() {
  const now = Date.now(), yesterday = new Date(now - 90000000).toISOString();
  return { measuredAt: new Date(now).toISOString(), windowStart: new Date(now - 30 * 86400000).toISOString(), nextAfter: null,
    quality: { totalAccounts: 120, measuredAccounts: 70, visits: 140, untrusted: 2 },
    landing: { visibleVisits: 120, playVisits: 85, loginVisits: 18, loadFailedVisits: 3, trainingVisits: 82 },
    cohorts: [{ platform: 'web', build: 'afd55bd2-local', locale: 'tr', source: 'twitter', visits: 100, accounts: 55 }], cohortsTruncated: false, daily: [],
    steps: Array.from({ length: 11 }, (_, i) => ({ step: i + 1, attempts: 82 - 4 * i })),
    players: [{ accountId: randomUUID(), username: 'Nova', lastActiveAt: yesterday, lastProgressAt: yesterday, galaxy: 'Silent Space', coverage: 'observed', truncated: false,
      summary: { foregroundMs: 420000, interactionMs: 180000, firstReadyAt: now - 3 * 86400000, commands: 5, untrusted: 0,
        sessions: [{ start: now - 90000000, end: now - 89600000, ending: 'inferred_timeout' }], lastTraining: { step: 11, scene: 'departure', at: now - 3 * 86400000 },
        retention: { d1: { mature: true, returned: true }, d3: { mature: false, returned: null }, d7: { mature: false, returned: null } } } },
      { accountId: randomUUID(), username: 'Vega', lastActiveAt: yesterday, lastProgressAt: null, galaxy: null, coverage: 'unmeasured', truncated: false, summary: null }] };
}
