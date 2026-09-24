/**
 * PHOTOGRAPH THE GÖZLEMEVİ v2 GALLERY.
 *
 * Owner instruction (2026-09-23): the redesign is never built blind. Every v2 kit
 * and HUD piece is drawn by `apps/web/v2-gallery.html` with fixture data; this
 * photographs it at the 350 px target (DPR 2) and at 1280 px, section by section
 * and with each sheet view open, in the languages asked for. No account is made,
 * so it never touches the signup limit that `tools/visual.mjs` runs into.
 *
 *   pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1
 *   node tools/v2-gallery.mjs out/v2 en tr de
 *
 * Then read the PNGs. Console errors are printed; a gallery that logs one is a bug.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://127.0.0.1:5199';
const OUT = process.argv[2] ?? 'out/v2';
const LANGUAGES = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ['en'];
const VIEWS = ['peek', 'queue', 'bell', 'view', 'fleet', 'fleet-home', 'fleet-room', 'launch', 'launch-pirate', 'transfer', 'settlement', 'convoy', 'trade', 'wave', 'strike'];
const SIZES = [
  { name: '350', viewport: { width: 350, height: 812 }, scale: 2 },
  { name: '1280', viewport: { width: 1280, height: 900 }, scale: 1 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const lng of LANGUAGES) {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size.viewport, deviceScaleFactor: size.scale });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto(`${WEB}/v2-gallery.html?lng=${lng}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Freeze pulses so a photograph never lands on the dim half of one.
    await page.addStyleTag({ content: '*{animation:none!important}' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${lng}-${size.name}-all.png`, fullPage: true });

    if (size.name === '350') {
      const sections = await page.$$('section');
      let index = 0;
      for (const section of sections) {
        index += 1;
        await section.screenshot({ path: `${OUT}/${lng}-${size.name}-section-${String(index).padStart(2, '0')}.png` });
      }
    }

    // A fresh page per view: after the full-page shot and the sections, one long-lived
    // page ran out of capture surface around the thirteenth view ("Unable to capture
    // screenshot"), and every view photographed alone was fine.
    for (const view of VIEWS) {
      const shot = await browser.newPage({ viewport: size.viewport, deviceScaleFactor: size.scale });
      shot.on('pageerror', (error) => errors.push(String(error)));
      shot.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await shot.goto(`${WEB}/v2-gallery.html?lng=${lng}&view=${view}`, { waitUntil: 'networkidle' });
      await shot.evaluate(() => document.fonts.ready);
      await shot.waitForTimeout(300);
      await shot.screenshot({ path: `${OUT}/${lng}-${size.name}-${view}.png` });
      await shot.close();
    }

    if (errors.length > 0) console.log(`console errors (${lng}, ${size.name}):`, errors.slice(0, 5));
    await page.close();
  }
}

await browser.close();
console.log(`photographed into ${OUT}`);
