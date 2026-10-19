import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real bootstrap: rate limits stay manual; outages recover on online. No player data. */
export async function verifySessionRecovery(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) {
      for (const language of ['tr', 'en']) for (const scenario of ['rate-limit', 'outage']) {
        const page = await browser.newPage({ viewport: { width, height: 812 } });
        const errors = [];
        const requests = [];
        let limited = true;
        const session = { accountId: 'commander', username: 'vantage', displayName: 'Vantage', country: 'TR', accessToken: 'fixture-token' };
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(language => { localStorage.setItem('astera.language', language); }, language);
        await page.route(url => url.pathname.startsWith('/api/'), route => {
          const path = new URL(route.request().url()).pathname;
          requests.push(path);
          if (path === '/api/auth/refresh') return route.fulfill({ status: limited ? scenario === 'rate-limit' ? 429 : 503 : 200, json: limited
            ? scenario === 'rate-limit' ? { error: 'RATE_LIMITED', message: 'Try again in 12 seconds', params: { seconds: 12 } }
              : { error: 'UNREACHABLE', message: 'Private upstream diagnostic' } : session });
          if (path === '/api/auth/me') return route.fulfill({ json: { ...session, isAdmin: false, placement: null } });
          if (path === '/api/auth/security') return route.fulfill({ json: { enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null } });
          if (path === '/api/servers') return route.fulfill({ json: { servers: [], placement: null } });
          throw new Error(`Unexpected fixture request: ${path}`);
        });
        await page.goto(process.env.WEB ?? 'http://localhost:5173');
        const retry = page.getByRole('button', { name: language === 'tr' ? 'Tekrar dene' : 'Try again', exact: true });
        await retry.waitFor();
        const message = scenario === 'rate-limit'
          ? language === 'tr' ? 'Çok sık denedin; 12 saniye sonra tekrar dene.' : 'Too many requests. Try again in 12 seconds.'
          : language === 'tr' ? 'Sunucuya ulaşılamadı.' : 'Could not reach the server.';
        await page.getByText(message, { exact: scenario === 'rate-limit' }).waitFor();
        assert(!((await page.locator('body').innerText()).includes('Private upstream diagnostic')));
        assert.equal(await page.locator('input[type="password"]').count(), 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.screenshot({ path: join(output, `${width}-${language}-${scenario}-blocked.png`) });
        limited = false;
        const before = requests.filter(path => path === '/api/auth/refresh').length;
        await page.evaluate(() => { window.dispatchEvent(new Event('online')); });
        if (scenario === 'rate-limit') {
          await page.waitForTimeout(150);
          assert.equal(requests.filter(path => path === '/api/auth/refresh').length, before, 'Rate limit must not auto-retry');
          await retry.click();
        }
        await page.getByRole('heading', { name: 'Vantage', exact: true }).waitFor();
        assert(!requests.includes('/api/auth/login'));
        assert.deepEqual(errors, []);
        assert.equal(requests.filter(path => path === '/api/auth/refresh').length, before + 1);
        await page.screenshot({ path: join(output, `${width}-${language}-${scenario}-recovered.png`) });
        results.push({ width, language, scenario, message, requests, errors, automatic: scenario === 'outage' });
        console.log(`PASS session recovery: ${width}px ${language}, ${scenario}`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
