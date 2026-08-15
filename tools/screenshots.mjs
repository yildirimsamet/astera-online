/**
 * Walk the client and photograph it.
 *
 * UI work cannot be judged from a passing typecheck. This drives the real app
 * against the real server in a portrait viewport, so every screen can be looked
 * at rather than imagined.
 *
 *   pnpm dev:server      # or however the API is running
 *   pnpm --filter @blindspace/web dev
 *   node tools/screenshots.mjs /path/to/output
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const APP = process.env.BLINDSPACE_APP ?? 'http://localhost:5173/';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, // portrait phone — the only shape that matters
  deviceScaleFactor: 2,
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};

page.on('pageerror', (error) => {
  console.log('PAGE EXCEPTION:', error.message);
});

await page.goto(APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('01-entry');

await page.getByRole('button', { name: /take a planet/i }).click();
await page.waitForTimeout(2000);

// A brand-new commander has never left, so there is no return to report. Only an
// account with history gets the overlay.
const dismiss = page.getByRole('button', { name: /continue/i });
if (await dismiss.count()) {
  await shot('02-return-overlay');
  await dismiss.click();
}
await page.waitForTimeout(800);
await shot('03-planet');

await page.mouse.wheel(0, 700);
await page.waitForTimeout(400);
await shot('04-planet-works');

await page.mouse.wheel(0, 700);
await page.waitForTimeout(400);
await shot('05-planet-orbit');

await page.getByRole('button', { name: /everyone else/i }).click();
await page.waitForTimeout(1200);
await shot('06-galaxy');

await page.locator('button:has-text("tier")').first().click();
await page.waitForTimeout(700);
await shot('07-target');

await page.getByRole('button', { name: /plan an attack/i }).click();
await page.waitForTimeout(600);
await shot('08-launch-empty');

const more = page.getByRole('button', { name: /more wasp/i }).first();
for (let i = 0; i < 6; i++) await more.click();
await page.waitForTimeout(400);
await shot('09-launch-chosen');

await page.getByRole('button', { name: /send \d+ ships/i }).click();
await page.waitForTimeout(400);
await shot('10-launch-confirm');

// Twice: backing out of the launch sheet returns you to the target sheet, which
// is intended — you land back on what you know about them.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.getByRole('button', { name: /what you know/i }).click();
await page.waitForTimeout(1000);
await shot('11-intel');

await browser.close();
