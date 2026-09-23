/**
 * THE ACADEMY'S TELESCOPE EXERCISE, IN A REAL BROWSER.
 *
 * The Academy's unit tests stub `GalaxyView`, so they cannot see whether the real
 * disc still offers what a lesson points at. The v2 shell moved the Telescope
 * switch into the View sheet; this opens the Academy at its Telescope step (a saved
 * lesson, no account) and walks chip → switch, photographing each beat.
 *
 *   ASTERA_API=http://localhost:3199 pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1
 *   node tools/v2-academy-telescope.mjs out/academy
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://127.0.0.1:5199';
const OUT = process.argv[2] ?? 'out/academy';
const TELESCOPE_STEP = 14;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ locale: 'en-GB', viewport: { width: 350, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 160)}`));

await page.addInitScript((step) => {
  const now = Date.now();
  localStorage.setItem('astera.academy.v1', JSON.stringify({
    version: 2, step, startedAt: now - 60_000, orderAt: null, flight: null, journeys: [], seenSignals: [],
  }));
}, TELESCOPE_STEP);
await page.goto(WEB, { waitUntil: 'domcontentloaded' });
const door = page.getByRole('button', { name: /check your planet|start a new commander/i }).first();
await door.waitFor({ timeout: 40_000 });
await door.click({ noWaitAfter: true });
await page.waitForSelector('[data-academy-step="telescope"]', { timeout: 40_000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/1-telescope-step.png` });

const chip = page.locator('[data-view-chip]');
console.log('chip visible:', await chip.isVisible());
await chip.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/2-view-open.png` });

const toggle = page.locator('[data-sensor-toggle="telescope"]');
console.log('switch visible:', await toggle.isVisible());
await toggle.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/3-after-switch.png` });
console.log('step now:', await page.locator('[data-academy]').getAttribute('data-academy-step'));
console.log(problems.length ? problems.join('\n') : 'no page errors');
await browser.close();
