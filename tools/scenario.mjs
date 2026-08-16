/**
 * Put the galaxy into a state worth photographing.
 *
 * Installs a Telescope, points it at the nearest world, and sends a probe — so the
 * watch beam and a probe in flight are both on screen. Uses the dev-only API handle
 * rather than clicking through the interface, which is slow and breaks whenever a
 * button moves.
 *
 *   node tools/scenario.mjs /path/to/output
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const APP = process.env.BLINDSPACE_APP ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
page.on('pageerror', (error) => {
  console.log('PAGE EXCEPTION:', error.message);
});

await page.goto(APP, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /take a planet/i }).click();
await page.waitForTimeout(3500);
await page
  .getByRole('button', { name: /continue/i })
  .click({ timeout: 2500 })
  .catch(() => undefined);
await page.waitForTimeout(1500);

const report = await page.evaluate(async () => {
  const api = window.__api;
  if (!api) return 'no api handle';

  await api.installSatellite('TELESCOPE');

  const galaxy = await api.galaxy();
  const me = galaxy.planets.find((p) => p.isSelf);
  const others = galaxy.planets.filter((p) => !p.isSelf);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const sorted = others.sort(
    (a, b) => distance(me.position, a.position) - distance(me.position, b.position),
  );

  const watched = sorted[0];
  const probed = sorted[1] ?? sorted[0];
  await api.watch(watched.id, 0);
  await api.probe(probed.id);
  // Hardware is public now, so the disc should be showing it. A fresh commander
  // can only afford so much, so raise the Ring and install whatever fits rather
  // than failing the whole run on an empty wallet.
  const tryTo = async (fn) => {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  };
  await tryTo(() => api.upgrade('RING'));
  for (const type of ['RADAR', 'AEGIS', 'VEIL']) await tryTo(() => api.installSatellite(type));

  return { watching: watched.name, probing: probed.name };
});
console.log('scenario:', JSON.stringify(report));

// Reload rather than wait: the reads are deliberately lazy — nothing polls, so a
// change made behind the cache's back will not appear for up to a minute. The
// refresh cookie survives, so the same commander comes back.
// Not `networkidle`: the event stream holds a connection open for as long as the
// player is signed in, so the network is never idle and the wait never resolves.
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
await page
  .getByRole('button', { name: /continue/i })
  .click({ timeout: 2500 })
  .catch(() => undefined);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/s1-watch-and-probe.png` });
console.log('shot s1');

await page.mouse.move(195, 430);
await page.mouse.down();
await page.mouse.move(250, 400, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/s2-angled.png` });
console.log('shot s2');

// Drag well past the disc plane: the camera must be able to come up underneath
// the galaxy and look back at it, which used to be walled off at 0.46pi.
await page.mouse.move(195, 300);
await page.mouse.down();
await page.mouse.move(195, 700, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/s3-underneath.png` });
console.log('shot s3');

await browser.close();
