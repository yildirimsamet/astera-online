/** Real shop, inventory and flight renders, plus top/side nozzle inspections. No payment calls. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');
const ships = [
  ['ship-red-dragon', 'Ejder', 'Korsan'], ['ship-shark', 'Balina', 'Kale'],
  ['ship-scorpion', 'Akrep', 'Engerek'], ['ship-stingray', 'Vatoz', 'Leviathan'],
];
const engines = ['engine-aurora', 'engine-helios', 'engine-singularity', 'engine-titan'];

export async function verifyShipSkins(output) {
  await mkdir(output, { recursive: true });
  await mkdir('apps/web/public/assets/images/cosmetics/ships', { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const results = [], errors = [], models = new Set();
  let page;
  const freshPage = async () => {
    await page?.close();
    page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      if (!new URLSearchParams(location.search).get('view')?.startsWith('cosmetic-card:')) return;
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '[data-cosmetic-stage]{position:fixed!important;inset:0!important;width:600px!important;height:400px!important;z-index:2147483647!important;background:#080f1a!important;}';
        document.head.append(style);
      });
    });
    // Keep SwiftShader's queue short while exercising the real animated renderer.
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(time => { setTimeout(() => { callback(time); }, 150); });
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (request.url().includes('/assets/models/')) models.add(new URL(request.url()).pathname); });
  };
  try {
    for (const id of [...ships.map(([id]) => id), 'probe-ufo', ...engines]) {
      await freshPage();
      await page.goto(`${web}/v2-gallery.html?view=cosmetic-card:${id}&lng=tr`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '[data-cosmetic-stage] {position:fixed!important;inset:0!important;width:600px!important;height:400px!important;z-index:2147483647!important;background:#080f1a!important;}' });
      const stage = page.locator('[data-cosmetic-ready="true"]');
      await stage.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('[data-cosmetic-stage] canvas')?.height === 400);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = await stage.screenshot({ path: `${output}/${id}.png` });
      const folder = id.startsWith('ship-') ? 'cosmetics/ships' : 'cosmetics';
      await sharp(png).webp({ quality: 90 }).toFile(`apps/web/public/assets/images/${folder}/${id}.webp`);
      assert.deepEqual(errors, [], id);
      results.push({ product: id });
      console.log(`PASS product image: ${id}`);
      if (id !== 'probe-ufo') for (const angle of id === 'ship-shark' ? ['top', 'side', 'right', 'rear'] : ['top', 'side']) {
        await freshPage();
        await page.goto(`${web}/v2-gallery.html?view=cosmetic-card:${id}:${angle}&lng=tr`, { waitUntil: 'networkidle' });
        await page.addStyleTag({ content: '[data-cosmetic-stage] {position:fixed!important;inset:0!important;width:600px!important;height:400px!important;z-index:2147483647!important;background:#080f1a!important;}' });
        await page.locator('[data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
        await page.waitForFunction(() => document.querySelector('[data-cosmetic-stage] canvas')?.height === 400);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.locator('[data-cosmetic-stage]').screenshot({ path: `${output}/${id}-${angle}.png` });
        console.log(`PASS inspection: ${id} ${angle}`);
      }
    }
    for (const width of [350, 1280]) {
      await freshPage();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${web}/v2-gallery.html?view=skin-shop&lng=tr`, { waitUntil: 'networkidle' });
      const categories = page.getByRole('navigation', { name: 'Görünüm kategorileri' });
      assert.equal(await categories.getByRole('button', { name: /^Kazıcı/ }).count(), 0);
      await categories.getByRole('button', { name: /^Gemi/ }).click();
      for (const [id, name, hull] of ships) {
        await page.locator('.cosmetic-collection').getByRole('button', { name: new RegExp(`^${name} `) }).click();
        await page.locator(`[data-cosmetic-stage="${id}"][data-cosmetic-ready="true"]`).waitFor({ timeout: 60000 });
        assert.equal(await page.getByText(`${hull} için`, { exact: true }).count(), 2);
        const broken = await page.evaluate(async () => {
          await Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)));
          return Array.from(document.images).filter(image => !image.naturalWidth).map(image => image.src);
        });
        assert.deepEqual(broken, [], `${width} ${id}: broken product image`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: `${output}/${width}-${id}-shop.png`, fullPage: true });
      }
      await page.goto(`${web}/v2-gallery.html?view=ship-skin-inventory&lng=tr`, { waitUntil: 'networkidle' });
      await page.locator('[data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
      assert.equal(await page.getByRole('navigation').getByRole('button').count(), 2);
      assert.equal(await page.getByRole('button', { name: 'Kuşanıldı', exact: true }).isDisabled(), true);
      await page.screenshot({ path: `${output}/${width}-inventory.png`, fullPage: true });
      await page.goto(`${web}/v2-gallery.html?view=skin-inventory-empty&lng=tr`, { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('navigation').getByRole('button').count(), 1);
      assert.equal(await page.getByRole('navigation').getByRole('button', { name: /^Klan bayrağı/ }).getAttribute('aria-pressed'), 'true');
      await page.screenshot({ path: `${output}/${width}-included-inventory.png`, fullPage: true });
      results.push({ viewport: width, brokenImages: [], hullLabels: true, categoryVisibility: true });
      console.log(`PASS shop and inventory: ${width}`);
    }
    await page.setViewportSize({ width: 1000, height: 560 });
    models.clear();
    await page.goto(`${web}/v2-gallery.html?view=ship-skin-fleet&lng=tr`, { waitUntil: 'networkidle' });
    await page.locator('[data-fleet-ready="true"]').waitFor({ timeout: 60000 });
    await page.locator('canvas').screenshot({ path: `${output}/mixed-fleet.png` });
    for (const name of ['red-dragon', 'shark', 'scorpion', 'stingray']) for (const suffix of ['', '_lod']) {
      assert.equal(models.has(`/assets/models/ships/skins/${name}/model${suffix}.glb`), true, `${name}${suffix} in flight`);
    }
    assert.equal([...models].some(path => path.includes('_preview')), false, 'flight never downloads the detailed shop mesh');
    assert.equal(models.has('/assets/models/ships/dart.glb'), true, 'unskinned Dart stays in the formation');
    assert.deepEqual(errors, []);
    results.push({ flight: true, models: [...models], errors });
    console.log('PASS actual mixed flight models');
    await freshPage();
    await page.setViewportSize({ width: 1000, height: 560 });
    await page.goto(`${web}/v2-gallery.html?view=cosmetic-fleet-titan&lng=tr`, { waitUntil: 'networkidle' });
    const titanFleet = page.locator('[data-fleet-ready="true"]');
    await titanFleet.waitFor({ timeout: 60000 });
    const batches = JSON.parse(await titanFleet.getAttribute('data-exhaust-batches'));
    assert.deepEqual(batches, [{ count: 16, triangles: 800, singlePass: true }]);
    await page.locator('canvas').screenshot({ path: `${output}/titan-fleet.png` });
    assert.deepEqual(errors, []);
    results.push({ titanBatches: batches });
    console.log('PASS Titan: 16 ship engines in one 800-triangle instanced batch');
  } catch (error) {
    await page?.screenshot({ path: `${output}/failure.png` }).catch(() => undefined);
    await writeFile(`${output}/failure.json`, JSON.stringify({ errors, message: error.message }, null, 2));
    throw error;
  } finally { await browser.close(); }
  await writeFile(`${output}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
  const frames = await Promise.all(ships.map(async ([id, name, hull], index) => {
    const label = Buffer.from(`<svg width="600" height="50"><text x="20" y="31" fill="#e5edf7" font-size="22" font-family="sans-serif">${hull} · ${name}</text></svg>`);
    return [{ input: await sharp(`${output}/${id}.png`).png().toBuffer(), left: index % 2 * 600, top: Math.floor(index / 2) * 450 },
      { input: label, left: index % 2 * 600, top: Math.floor(index / 2) * 450 + 400 }];
  }));
  await sharp({ create: { width: 1200, height: 900, channels: 4, background: '#080f1a' } }).composite(frames.flat()).png().toFile(`${output}/collection.png`);
}
