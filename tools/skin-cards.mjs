/**
 * Render the country skin selection cards from the same live GLBs as the shop.
 * Start Vite first: pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1
 * Then run: node tools/skin-cards.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { writePlanetVersions } from './planet-versions.mjs';

const WEB = process.env.WEB ?? 'http://127.0.0.1:5199';
const OUT = 'apps/web/public/assets/images/skins';
const COUNTRIES = ['turkey', 'germany', 'france', 'spain', 'japan'];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const country of COUNTRIES) {
    const page = await browser.newPage({ viewport: { width: 400, height: 320 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const id = `planet-${country}`;
    await page.goto(`${WEB}/v2-gallery.html?view=skin-card:${id}`, { waitUntil: 'networkidle' });
    await page.locator('[data-skin-card] [data-skin-stage][data-skin-ready="true"]')
      .waitFor({ timeout: 20_000 });
    // The model is mounted and has updated its instance matrix. Let the browser
    // paint that frame before capturing the fixed-angle card.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    if (errors.length > 0) throw new Error(`${id}: ${errors.join('; ')}`);
    await page.locator('[data-skin-card]').screenshot({ path: `${OUT}/${id}.png` });
    await page.close();
    console.log(`${id}.png`);
  }
} finally {
  await browser.close();
}
writePlanetVersions();
