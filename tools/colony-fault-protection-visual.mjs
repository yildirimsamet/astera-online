import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyColonyFaultProtection(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      // Fixtures mount real components outside the gallery root; Vite reloads
      // from other workspace edits would discard that mount mid-assertion.
      await page.routeWebSocket('**', socket => socket.close());
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=${language}`);
      await page.getByRole('tab').first().waitFor();
      await page.evaluate(async language => {
        const urls = performance.getEntriesByType('resource').map(entry => entry.name);
        const moduleUrl = path => urls.findLast(url => new URL(url).pathname === path) ?? path;
        const [{ default: { createElement: h } }, { default: { createRoot } }, { PlanetHero }, { planetView }, { default: i18n }] = await Promise.all([
          import(urls.find(url => /\/react\.js\?/.test(url))),
          import(urls.find(url => /\/react-dom_client\.js\?/.test(url))),
          import(moduleUrl('/src/ui/PlanetHero.tsx')), import(moduleUrl('/test/fixtures.ts')),
          import(moduleUrl('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        document.getElementById('root').style.display = 'none';
        const mount = document.createElement('main');
        mount.style.cssText = 'max-width:480px;margin:16px auto;padding:12px;background:#0b1522';
        document.body.append(mount);
        const now = Date.now();
        const state = (until, broken = false, vacationUntil = null) => planetView({
          buildings: { CORE: 12, REFINERY: 6, EXTRACTOR: 6, VAULT: 4, SHIPYARD: 4 },
          faultProtectedUntil: until, vacationUntil, loyalty: { value: 100, minutesLeft: null },
          faults: broken ? [{ id: 'existing', kind: 'EXTRACTOR_OUTAGE', startedAt: new Date(now - 3600000),
            cost: { alloy: 100, crystal: 0, deuterium: 0 }, repair: null }] : [],
        }, { kind: 'COLONY', name: language === 'tr' ? 'Ufuk Kolonisi' : 'Horizon Colony' });
        const section = (title, data) => h('section', { style: { marginBottom: 24 } },
          h('h2', { style: { color: '#e9f3ff', marginBottom: 8 } }, title), h(PlanetHero, { planet: data }));
        createRoot(mount).render(h('div', null,
          section(language === 'tr' ? 'Korunan koloni' : 'Protected colony', state(new Date(now + 12 * 3600000))),
          section(language === 'tr' ? 'Koruma sona ermiş' : 'Protection expired', state(new Date(now - 1000))),
          section(language === 'tr' ? 'Mevcut arızası olan koloni' : 'Colony with an existing fault', state(new Date(now + 6 * 3600000), true)),
          section(language === 'tr' ? 'Tatilde koruma duraklatıldı' : 'Protection paused on vacation',
            state(new Date(now + 36 * 3600000), false, new Date(now + 24 * 3600000))),
        ));
      }, language);
      const cards = page.getByTestId('fault-protection');
      await cards.first().waitFor();
      assert.equal(await cards.count(), 4);
      assert.match(await cards.nth(0).innerText(), language === 'tr' ? /yeni arıza oluşmaz/ : /No new faults for/);
      assert.doesNotMatch(await cards.nth(1).innerText(), language === 'tr' ? /yeni arıza oluşmaz/ : /No new faults for/);
      assert.match(await cards.nth(2).innerText(), language === 'tr' ? /Mevcut arızaları onarman/ : /Existing faults still need repairs/);
      const paused = await cards.nth(3).innerText();
      assert.match(paused, language === 'tr' ? /Arıza koruması duraklatıldı · 12 sa 00 dk/ : /Fault protection paused · 12h 00m/);
      await page.waitForTimeout(1100);
      assert.equal(await cards.nth(3).innerText(), paused);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      const file = `colony-protection-${language}-${width}.png`;
      await page.screenshot({ path: join(output, file), fullPage: true });
      results.push({ width, language, file, passed: true });
      await page.close();
    }
    await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log('Colony fault protection: four responsive visual cases passed.');
  } finally { await browser.close(); }
}
