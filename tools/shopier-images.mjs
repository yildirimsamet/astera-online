#!/usr/bin/env node
/**
 * SHOPIER PRODUCT IMAGES (owner 2026-10-29). Shopier fetches a product's image from a URL when
 * the product is created and accepts only jpg/png. Each image is a photograph of the game's own
 * 3D preview — the planet with its structures, the ring on its world, the ship with its drive —
 * on the night, stars and thin orbit of the original Shopier product art, 1200 × 1200 jpg.
 * The set is its four worlds in a grid. Needs the web dev server (`WEB`, default :5173).
 *
 *   node tools/shopier-images.mjs [--resume]   (--resume keeps images already shot)
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')))('sharp');
const OUT = join(ROOT, 'apps/web/public/assets/images/shopier');
const ELEMENTS = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'];
const CSS_SIZE = 800;
const SCALE = 1.5;

const template = readFileSync(join(ROOT, '.env.production.example'), 'utf8');
const items = Object.keys(JSON.parse(/^SHOPIER_PRICES='(.*)'$/m.exec(template)?.[1] ?? '{}')).filter(item => item !== 'bundle');

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: CSS_SIZE, height: CSS_SIZE }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=base-fleet&lng=tr`);
  await page.getByRole('tab').first().waitFor();
  await page.evaluate(async size => {
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    const at = pattern => resources.find(name => pattern.test(name));
    const [{ default: { createElement: h } }, { default: { createRoot } }, { SkinPreview }, { CosmeticPreview }, { PLANET_SKIN_CATALOG }] = await Promise.all([
      import(at(/\/react\.js\?/)), import(at(/\/react-dom_client\.js\?/)), import('/src/screens/SkinPreview.tsx'),
      import('/src/screens/CosmeticPreview.tsx'), import('/src/ui/skinCatalog.ts'),
    ]);
    document.getElementById('root').style.display = 'none';
    const style = document.createElement('style');
    // A still frame: nothing breathes, spins or drifts while the shutter is open.
    style.textContent = `*{animation:none!important;transition:none!important}
      #shot [data-cosmetic-stage],#shot [data-skin-stage]{height:100%!important}`;
    document.head.append(style);
    const mount = document.createElement('div');
    mount.id = 'shot';
    mount.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;overflow:hidden;z-index:100;
      background:radial-gradient(circle at 50% 46%,#1f3656 0%,#0e1c30 38%,#060c16 72%,#03060c 100%)`;
    document.body.append(mount);
    // Fixed stars, so every product shares one sky.
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let index = 0; index < 46; index++) {
      const star = document.createElement('span');
      const r = random() < 0.85 ? 1.2 : 2.2;
      star.style.cssText = `position:absolute;left:${random() * 100}%;top:${random() * 100}%;width:${r}px;height:${r}px;
        border-radius:9999px;background:#fff;opacity:${0.35 + random() * 0.55}`;
      mount.append(star);
    }
    const orbit = document.createElement('div');
    orbit.style.cssText = `position:absolute;left:50%;top:50%;width:90%;height:40%;border-radius:9999px;
      border:1.5px solid rgba(150,184,212,.55);transform:translate(-50%,-50%) rotate(-16deg)`;
    mount.append(orbit);
    const stage = document.createElement('div');
    // Room round the look, so a ring's rim or a ship's nose is never cut by the square.
    stage.style.cssText = 'position:absolute;inset:7%';
    mount.append(stage);
    const root = createRoot(stage);
    window.__shoot = id => {
      const planet = id in PLANET_SKIN_CATALOG;
      orbit.style.display = planet ? 'block' : 'none';
      root.render(planet ? h(SkinPreview, { key: id, skinId: id, status: 'NORMAL', still: true, className: 'h-full' })
        // A long drive or a small probe reads tiny in a square: those get the store's product-card framing.
        : h(CosmeticPreview, { key: id, id, still: true, productCard: id.startsWith('engine-') || id === 'probe-ufo' }));
    };
  }, CSS_SIZE);
  for (const item of items) {
  if (process.argv.includes('--resume') && existsSync(join(OUT, `${item}.jpg`))) continue;
    await page.evaluate(id => { window.__shoot(id); }, item);
    await page.locator(`#shot [data-skin-ready="true"], #shot [data-cosmetic-stage="${item}"][data-cosmetic-ready="true"]`).waitFor({ timeout: 60_000 });
    // Textures stream in after the first frames; give them a beat before the shutter.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: CSS_SIZE, height: CSS_SIZE } });
    await sharp(shot).jpeg({ quality: 88, mozjpeg: true }).toFile(join(OUT, `${item}.jpg`));
    console.log(`${item}.jpg`);
  }
  if (errors.length > 0) throw new Error(`Page errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
}

const pixels = Math.round(CSS_SIZE * SCALE);
const half = pixels / 2;
const tiles = await Promise.all(ELEMENTS.map(world => sharp(join(OUT, `${world}.jpg`)).resize(half, half).toBuffer()));
await sharp({ create: { width: pixels, height: pixels, channels: 3, background: '#03060c' } })
  .composite(tiles.map((input, index) => ({ input, left: (index % 2) * half, top: Math.floor(index / 2) * half })))
  .jpeg({ quality: 88, mozjpeg: true }).toFile(join(OUT, 'bundle.jpg'));
console.log('bundle.jpg');
