/**
 * THE COLONY SHIP'S FIRST THREE MINUTES, THROUGH REAL CONTROLS. No account is created by the walk.
 * Needs a server with STARTER_GALAXY_ENABLED=true behind WEB. A failed step leaves a photo.
 *
 *   node tools/starter-visual.mjs [out] [--tr] [--wide]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const WEB = process.env.WEB ?? 'http://localhost:5173';
const PROFILES = { phone: { width: 350, height: 812, isMobile: true, deviceScaleFactor: 2 }, tall: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }, wide: { width: 1440, height: 900, isMobile: false, deviceScaleFactor: 1 } };

export async function verifyStarter(out, { language = 'en', profiles = ['phone', 'tall', 'wide'] } = {}) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const failures = [];
  for (const name of profiles) {
    const { width, height, isMobile, deviceScaleFactor } = PROFILES[name];
    const context = await browser.newContext({ viewport: { width, height }, isMobile, deviceScaleFactor, hasTouch: isMobile, locale: language === 'tr' ? 'tr-TR' : 'en-US' });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    const asked = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/') && !['/api/auth/capabilities', '/api/auth/refresh', '/api/analytics/grant', '/api/analytics/events', '/api/maintenance', '/api/announcements'].includes(path)) asked.push(path);
    });
    const shot = (tag) => page.screenshot({ path: `${out}/${name}-${tag}.png` });
    const press = () => page.getByTestId('prologue-action').click();
    try {
      await page.goto(WEB, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('prologue').waitFor({ timeout: 40_000 });
      await page.waitForTimeout(800);
      await shot('1-dark');
      await press();
      await page.waitForTimeout(1800);
      await shot('2-powered');
      await press();
      await page.waitForTimeout(3000);
      await shot('3-burning');
      await page.getByTestId('prologue-action').waitFor();
      await page.waitForTimeout(400);
      await shot('4-batch');
      await press();
      await page.waitForTimeout(500);
      await shot('5-collected');
      await press();
      await page.waitForTimeout(3500);
      await shot('6-patching');
      await page.getByTestId('prologue-signal').waitFor();
      await page.waitForTimeout(800);
      await shot('7-signal');
      await press();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(500);
      await shot('8-claim');
      // The page's width is the budget: a sideways scroll on a phone is a bug, whatever it looks like.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 0) throw new Error(`${name}: ${overflow}px of sideways scroll`);
      if (asked.length > 0) throw new Error(`${name}: the prologue asked the server for ${asked.join(', ')}`);
      if (errors.length > 0) throw new Error(`${name}: ${errors.join(' | ')}`);
    } catch (error) {
      failures.push(error);
      await shot('failed').catch(() => undefined);
    }
    await context.close();
  }
  await browser.close();
  if (failures.length > 0) throw failures[0];
}

if (process.argv[1]?.endsWith('starter-visual.mjs')) {
  const profiles = process.argv.includes('--wide') ? ['wide'] : undefined;
  await verifyStarter(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'out/starter', { language: process.argv.includes('--tr') ? 'tr' : 'en', ...(profiles ? { profiles } : {}) });
  console.log('prologue verified');
}
