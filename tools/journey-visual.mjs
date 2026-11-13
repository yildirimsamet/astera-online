import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Exercise the actual admin tab and API parser with synthetic records; never creates production players. */
export async function verifyJourney(output) {
  await mkdir(output, { recursive: true });
  const htmlPath = new URL('../apps/web/journey-visual.tmp.html', import.meta.url);
  const entryPath = new URL('../apps/web/src/journeyVisual.tmp.tsx', import.meta.url);
  const origin = process.env.ASTERA_VISUAL_WEB ?? 'http://127.0.0.1:5201';
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    await writeFile(htmlPath, '<html lang="tr"><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="root"></div><script type="module" src="/src/journeyVisual.tmp.tsx"></script></body></html>');
    await writeFile(entryPath, `import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from './api/client';
import { ApiProvider } from './api/context';
import AdminPanel from './screens/AdminPanel';
import i18n, { i18nReady } from './i18n/index';
import './styles.css';
await i18nReady;
await i18n.changeLanguage('tr');
document.body.style.overflow = 'auto';
document.getElementById('root')!.style.cssText = 'max-width:1280px;margin:0 auto;padding:12px;min-height:100vh';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ApiProvider api={new Api()}><AdminPanel /></ApiProvider></QueryClientProvider>);
`);
    for (const [name, width, height] of [['mobile', 350, 740], ['phone', 390, 844], ['desktop', 1440, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR' });
      const calls = [], errors = [];
      await context.route(url => url.pathname.startsWith('/api/'), async route => {
        const path = new URL(route.request().url());
        calls.push(path.pathname + path.search);
        await route.fulfill({ status: path.pathname === '/api/admin/analytics/journey' ? 200 : 404,
          contentType: 'application/json', body: JSON.stringify(path.pathname === '/api/admin/analytics/journey' ? fixture(Number(path.searchParams.get('hours') ?? 24)) : {}) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/journey-visual.tmp.html`);
      await page.getByRole('tab', { name: 'Oyuncu yolculuğu', exact: true }).click();
      await page.getByRole('heading', { name: 'İlerleme haritası', exact: true }).waitFor();
      assert.equal(await page.locator('.journey-stage').count(), 10);
      assert.equal(await page.locator('.journey-player').count(), 24);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow`);
      await page.screenshot({ path: `${output}/${name}-overview.png`, fullPage: true });
      await page.getByRole('button', { name: /^İlk zafer / }).click();
      assert.ok(await page.locator('.journey-player').count() < 24);
      await page.locator('.journey-player-toggle').first().click();
      await page.getByText('Son rehber adımı', { exact: true }).waitFor();
      await page.locator('.journey-detail').screenshot({ path: `${output}/${name}-player.png` });
      await page.getByRole('button', { name: 'Ara verme noktaları', exact: true }).click();
      const nextReport = page.waitForResponse(response => response.url().includes('/api/admin/analytics/journey?hours=4'));
      await page.getByRole('button', { name: 'Son 4 saat', exact: true }).click();
      await nextReport;
      assert.ok(calls.some(path => path.includes('hours=4')));
      await page.getByText('Özel kayıt aralığı', { exact: true }).click();
      await page.getByLabel('Kayıt başlangıcı', { exact: true }).fill('2026-11-10T18:26');
      await page.getByLabel('Kayıt bitişi', { exact: true }).fill('2026-11-10T23:26');
      await page.getByRole('button', { name: 'Aralığı uygula', exact: true }).click();
      await page.waitForTimeout(200);
      assert.ok(calls.some(path => path.includes('from=') && path.includes('to=')));
      assert.deepEqual(errors, []);
      results.push({ name, width, normalAdminTab: true, cohortFiltering: true, playerDetail: true, dateRange: true, noHorizontalOverflow: true, noPageErrors: true });
      await context.close();
    }
    await writeFile(`${output}/result.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
    await Promise.all([unlink(htmlPath), unlink(entryPath)]);
  }
}

function fixture(hours) {
  const now = Date.now(), from = now - hours * 3600000;
  const stages = ['registered', 'enlisted', 'refinery', 'mining', 'probe', 'yard', 'built', 'battle', 'victory', 'departed'];
  const players = Array.from({ length: 24 }, (_, i) => {
    const stage = stages[Math.min(9, Math.floor(i / 2.5))];
    const joinedAt = from + (i + 1) / 25 * (now - from), lastActiveAt = i > 19 ? now - 60000 : joinedAt + 120000;
    const quality = i % 8 === 0 ? 'missing' : i % 7 === 0 ? 'partial' : 'observed';
    const errors = i % 6 === 0 ? [{ at: lastActiveAt, code: 'react_render' }] : [];
    return { accountId: randomUUID(), username: ['Nova', 'Orbit', 'Aster', 'Lyra', 'Zenith'][i % 5] + String(i + 1), joinedAt,
      galaxy: 'Vantage · Starter ' + String(i % 2 + 1), stage, milestones: stages.slice(0, stages.indexOf(stage) + 1), guideSkipped: i % 5 === 0,
      lastTutorial: { at: joinedAt, code: i % 5 === 0 ? 'collect' : 'farewell' }, lastActiveAt, lastClientAt: lastActiveAt,
      lastCommand: { at: lastActiveAt, code: 'PROBE' }, lastSurface: { at: lastActiveAt, code: 'intel' }, activity: i > 19 ? 'recent' : 'absent',
      foregroundMs: quality === 'missing' ? null : (i + 1) * 110000, interactionMs: quality === 'missing' ? null : (i + 1) * 80000,
      sampledForegroundMs: (i + 1) * 110000, durationQuality: quality, sessionCount: quality === 'missing' ? null : 1,
      waitingAtLastActivity: i % 3 === 0 ? { count: 1, nextAt: lastActiveAt + 180000 } : null,
      blockers: i % 4 === 0 ? [{ at: lastActiveAt, code: 'INSUFFICIENT_RESOURCES' }] : [], errors,
      history: [{ at: joinedAt, code: 'online', kind: 'guide' }, { at: lastActiveAt - 60000, code: 'PROBE', kind: 'command' },
        { at: lastActiveAt - 10000, code: 'PROBE_REPORT', kind: 'result' }, { at: lastActiveAt, code: 'background', kind: 'background' }],
    };
  });
  return { measuredAt: now, from, to: now, absentMinutes: 30, totalAccounts: 24, truncated: false, players };
}
