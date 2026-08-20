/**
 * Photograph a planet's hardware, close up.
 *
 * Satellites are a few pixels across at playing distance — which is deliberate,
 * they must not fog the disc — so the only way to judge whether they read as
 * instruments in orbit rather than as dirt on the lens is to fly to one.
 *
 *   node tools/orbit.mjs /path/to/output
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const APP = process.env.ASTERA_APP ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 2 });
page.on('pageerror', (error) => console.log('PAGE EXCEPTION:', error.message));

await page.goto(APP, { waitUntil: 'load' });
await page.getByRole('button', { name: /take a planet/i }).click();
await page.waitForTimeout(3500);
await page.getByRole('button', { name: /continue/i }).click({ timeout: 2500 }).catch(() => undefined);
await page.waitForTimeout(1500);

// A ring with something in it. A fresh commander can afford one instrument, so
// the rest is best-effort — the shot is about how one looks, not how five do.
const report = await page.evaluate(async () => {
  const api = window.__api;
  const attempt = async (fn) => {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  };
  await attempt(() => api.installSatellite('TELESCOPE'));
  await attempt(() => api.upgrade('RING'));
  await attempt(() => api.installSatellite('RADAR'));
  const galaxy = await api.galaxy();
  return galaxy.planets.find((p) => p.isSelf)?.satellites ?? [];
});
console.log('in orbit:', JSON.stringify(report));

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.getByRole('button', { name: /continue/i }).click({ timeout: 2500 }).catch(() => undefined);
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const state = window.__galaxy;
  state.setFrameloop?.('always');
  const controls = state.controls;
  const target = controls.target;
  // Close enough that a satellite is a recognisable object, far enough that the
  // planet is still whole.
  state.camera.position.set(target.x + 2.2, target.y + 1.1, target.z + 2.2);
  state.camera.lookAt(target.x, target.y, target.z);
  state.camera.updateMatrixWorld();
  state.invalidate();
});

for (const n of [1, 2]) {
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/orbit-${n}.png` });
  console.log('shot', n);
}

await browser.close();
