/** Read-only screenshot review of the premium art pass. Uses real game components with gallery data. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function capturePremiumVisuals(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({ args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ] });
  const captures = [];
  const issues = [];
  const pageFor = async (width, height = 812) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, locale: 'tr-TR',
      isMobile: width < 600, hasTouch: width < 600 });
    page.on('pageerror', (error) => { issues.push({ url: page.url(), error: error.message }); });
    page.on('console', (message) => {
      if (message.type() === 'error') issues.push({ url: page.url(), error: message.text() });
    });
    return page;
  };
  const shot = async (page, name) => {
    await page.screenshot({ path: join(output, `${name}.png`), timeout: 90_000 });
    const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    captures.push({ name, layout });
    console.log(`  · ${name}.png`);
  };
  try {
    for (const width of [350, 585, 1280]) {
      const page = await pageFor(width, width === 585 ? 1266 : 812);
      try {
        await page.goto(`${web}/v2-gallery.html?view=base-fleet&lng=tr`);
        await page.locator('[data-planet-portrait] img').first().waitFor({ timeout: 60_000 });
        await page.waitForTimeout(400);
        await shot(page, `base-${width}`);
        await page.getByRole('tab', { name: 'Üretim', exact: true }).click();
        await shot(page, `production-${width}`);
      } finally { await page.close(); }
    }
    for (const width of [350, 1280]) {
      const page = await pageFor(width);
      try {
        await page.goto(`${web}/v2-gallery.html?view=base-research&lng=tr`);
        await page.getByRole('button', { name: /^Endüstri\b/ }).click();
        await page.waitForTimeout(400);
        await shot(page, `research-${width}`);
        await page.getByRole('button', { name: 'Ayrıntılar', exact: true }).click();
        await page.waitForTimeout(400);
        await shot(page, `research-detail-${width}`);
      } finally { await page.close(); }
    }
    for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      const page = await pageFor(350);
      try {
        await page.goto(`${web}/v2-gallery.html?view=menu&lng=${language}`);
        await page.getByRole('slider').nth(1).scrollIntoViewIfNeeded();
        await shot(page, `settings-${language}`);
      } finally { await page.close(); }
    }
    for (const width of [350, 1280]) {
      const page = await pageFor(width, width === 350 ? 812 : 900);
      try {
        await page.goto(`${web}/v2-gallery.html?view=premium-space&lng=tr`);
        await page.locator('[data-premium-scene-ready="true"]').waitFor({ timeout: 120_000 });
        for (const [label, name] of [
          ['Enkaz', 'wreck'], ['İzotop asteroidi', 'isotope'], ['Filo', 'fleet'], ['Anıt', 'station'],
        ]) {
          await page.getByRole('button', { name: label, exact: true }).click();
          await page.waitForTimeout(1800);
          await shot(page, `${name}-${width}`);
        }
        await page.getByRole('button', { name: 'Savaş', exact: true }).click();
        // First play prepares the missile/atlas programs; repeat photographs the animation itself.
        await page.waitForTimeout(12_000);
        await page.getByRole('button', { name: 'Savaş', exact: true }).click();
        for (let frame = 0; frame < 3; frame++) {
          await page.waitForTimeout(frame === 0 ? 3300 : 500);
          await shot(page, `battle-${width}-${frame}`);
        }
        await page.getByRole('button', { name: 'Stratejik çarpma', exact: true }).click();
        await page.waitForTimeout(2300);
        await shot(page, `strategic-${width}`);
        await page.getByRole('button', { name: 'Enkaz', exact: true }).click();
        await page.waitForTimeout(1800);
        await page.getByRole('button', { name: 'Madencilik', exact: true }).click();
        await page.waitForTimeout(2800);
        await shot(page, `mining-${width}`);
        captures.push({ name: `scene-${width}`, metrics: await page.evaluate(() => window.__galaxyMetrics?.snapshot()) });
      } finally { await page.close(); }
    }
  } finally {
    await browser.close();
    await writeFile(join(output, 'review.json'), JSON.stringify({ captures, issues, renderer: 'Headless SwiftShader; device FPS is not measured.' }, null, 2));
  }
  if (issues.length) throw new Error(`Premium review reported ${issues.length} browser errors. See review.json.`);
}
