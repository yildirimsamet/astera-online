import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real launch components in an isolated gallery; no account, API or gameplay writes. */
export async function verifyPirateProfit(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5207';
  const vite = process.env.WEB ? null : spawn(process.execPath,
    ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '5207', '--strictPort'],
    { cwd: process.cwd() + '/apps/web', stdio: ['ignore', 'pipe', 'pipe'] });
  let viteLog = '';
  vite?.stdout.on('data', chunk => { viteLog = (viteLog + String(chunk)).slice(-3000); });
  vite?.stderr.on('data', chunk => { viteLog = (viteLog + String(chunk)).slice(-3000); });
  let browser;
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (vite && vite.exitCode !== null) throw new Error(viteLog);
      try {
        if ((await fetch(`${web}/v2-gallery.html`)).ok) break;
      } catch { /* Startup has not opened its loopback socket yet. */ }
      if (attempt === 119) throw new Error(`Gallery did not start: ${viteLog}`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ args: ['--renderer-process-limit=1', '--num-raster-threads=1'] });
    const measurements = [];
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: width === 350 ? 812 : 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${web}/v2-gallery.html?view=launch-pirate&lng=${language}`, { timeout: 120000 });
      await page.getByRole('dialog').waitFor({ timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      const set = async (hull, count) => {
        const field = page.locator(`[data-hull-row="${hull}"] input`);
        await field.fill(String(count)); await field.blur();
      };
      const capture = async scenario => {
        const card = page.getByTestId('pirate-profit');
        await card.locator('[data-profit-net="deuterium"]').waitFor();
        await card.evaluate(element => {
          const body = element.closest('[data-sheet-body]');
          const sticky = body.querySelector('[data-force-ruler]').parentElement;
          body.scrollTop += element.getBoundingClientRect().top - sticky.getBoundingClientRect().bottom - 8;
        });
        const layout = await card.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const values = [...element.querySelectorAll('[data-profit-net]')].map(node => ({
            resource: node.dataset.profitNet, text: node.textContent,
          }));
          const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 12);
          return { width: rect.width, top: rect.top, bottom: rect.bottom, values,
            visible: rect.top >= 0 && rect.bottom <= innerHeight,
            headerVisible: element.contains(center),
            fits: element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth,
            text: element.textContent };
        });
        assert(layout.visible && layout.fits && layout.headerVisible, JSON.stringify(layout));
        assert.equal(layout.values.length, 3);
        assert(!layout.text.includes('pirate.profit.'), 'untranslated key');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, `${width}-${language}-${scenario}.png`) });
        measurements.push({ width, language, scenario, ...layout });
      };
      const armed = ['CATACLYSM', 'CORSAIR', 'CITADEL', 'PALADIN'];
      for (const hull of armed) await set(hull, 2);
      await capture('profit');
      if (language === 'tr' || language === 'en') {
        for (const hull of armed) await set(hull, 0);
        await set('DART', 1);
        await capture('loss');
        await set('DART', 0);
        for (const hull of armed) await set(hull, 2);
        await set('GARBAGE_COLLECTOR', 1);
        await capture('collector');
      }
      await page.close();
      process.stdout.write(`PASS pirate estimate: ${width}px ${language}\n`);
    }
    await writeFile(join(output, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
  } finally {
    await browser?.close();
    vite?.kill('SIGTERM');
  }
}
