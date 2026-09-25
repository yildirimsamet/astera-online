/**
 * THE SIXTEEN WORLD CARDS, RENDERED FROM THE MODELS. F9 · K7.
 *
 * Owner, 2026-09-25: "kartları 3B'den render et". The cards (the Base hero, the dossier,
 * Intel, the galaxy's specks) and the worlds on the disc must be the same planet, and the
 * default models are a different set of looks from the painted renders they replace. So
 * each card is captured from its model, under the disc's own light and surface
 * (`galaxy/planetSurface.ts`), filling the square as the billboard expects.
 *
 *   pnpm --filter @astera/web dev        # or any running web dev server
 *   node tools/planet-cards.mjs           # writes apps/web/public/assets/images/planets/planet_N.png
 *   node tools/planet-cards.mjs --only=10 # one card
 *   CARDS_URL=http://127.0.0.1:5199 node tools/planet-cards.mjs
 *
 * Paletted on the way out (sharp, which gltf-transform already brings): a 350px world
 * quantised at quality 72 is indistinguishable from the true-colour capture at a third
 * of the weight — and all sixteen are in the opening preload, whose byte budget
 * (`test/fleet-v2-assets.test.ts`) they must stay inside: 908 KB against the painted
 * renders' 936 KB.
 *
 * Offline, like `models.mjs`: nothing here ships to the browser.
 */
import { createRequire } from 'node:module';
import { realpathSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// Resolved beside the CLI that depends on it: the pnpm store keeps it out of the root.
const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');

const BASE = process.env.CARDS_URL ?? 'http://127.0.0.1:5173';
const OUT = 'apps/web/public/assets/images/planets';
const SIZE = 350;
const COUNT = 16;
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const cards = only ? [Number(only)] : Array.from({ length: COUNT }, (_, i) => i + 1);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** One capture on a fresh page: a WebGL context left over from the last card cannot stall this one. */
async function capture(n) {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${BASE}/v2-gallery.html?view=planet-card&n=${String(n)}&size=${String(SIZE)}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.cardReady === 'true', undefined, { timeout: 30_000 });
    await page.waitForTimeout(300);
    return await page.locator('[data-planet-card] canvas').screenshot({ omitBackground: true });
  } finally {
    await page.close();
  }
}

for (const n of cards) {
  let shot = null;
  for (let attempt = 1; attempt <= 3 && shot === null; attempt += 1) {
    shot = await capture(n).catch((error) => {
      console.log(`  planet_${String(n)} attempt ${String(attempt)} failed: ${String(error).slice(0, 80)}`);
      return null;
    });
  }
  if (shot === null) throw new Error(`planet_${String(n)}: no capture`);
  const png = await sharp(shot).png({ palette: true, quality: 72, effort: 10 }).toBuffer();
  writeFileSync(`${OUT}/planet_${String(n)}.png`, png);
  console.log(`planet_${String(n)}.png · ${String(Math.round(png.length / 1024))} KB`);
}
await browser.close();
