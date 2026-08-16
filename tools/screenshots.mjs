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

// SwiftShader: headless Chromium has no GPU, and the galaxy is WebGL. Slow, but
// it renders the same scene the phone will.
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
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

/** The 3D scene needs a beat to load its textures before it is worth a photo. */
const settle = async (ms = 2500) => {
  await page.waitForTimeout(ms);
};

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
// The galaxy is the home surface, so it is what a cold session opens on.
await settle(3000);
await shot('02-galaxy');

await page.mouse.move(195, 430);
await page.mouse.down();
await page.mouse.move(285, 385, { steps: 14 });
await page.mouse.up();
await settle(1200);
await shot('03-galaxy-orbited');

await page.mouse.move(195, 430);
for (let i = 0; i < 5; i++) {
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(90);
}
await settle(1200);
await shot('04-galaxy-close');

// The tabs are labelled by what they answer, not by their caption — the Planet
// tab's accessible name is "Your planet".
await page.getByRole('button', { name: /^your planet$/i }).click();
await page.waitForTimeout(900);
await shot('05-planet');

await page.mouse.wheel(0, 700);
await page.waitForTimeout(400);
await shot('06-planet-works');

await page.mouse.wheel(0, 700);
await page.waitForTimeout(400);
await shot('07-planet-orbit');

await page.getByRole('button', { name: /what you know/i }).click();
await page.waitForTimeout(1000);
await shot('08-intel');

await browser.close();
