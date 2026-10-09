/** Capture real 3D products and verify category navigation without calling a payment provider. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { chromium } from 'playwright';
const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
const sharp = fromCli('sharp');
const ids = ['ring-aurora', 'ring-helios', 'ring-singularity', 'engine-aurora', 'engine-helios', 'engine-singularity', 'engine-titan', 'flag-vanguard', 'flag-orbit', 'flag-aurora', 'flag-helios', 'flag-singularity', 'flag-reaper', 'flag-ravager', 'flag-serpent', 'flag-phoenix', 'flag-ironfang', 'probe-ufo'];

export async function verifyCosmeticCollections(output) {
  await mkdir(output, { recursive: true });
  await mkdir('apps/web/public/assets/images/cosmetics', { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const results = [];
  try {
    for (const id of ids) {
      const page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
      await page.goto(`${web}/v2-gallery.html?view=cosmetic-card:${id}&lng=en`, { waitUntil: 'domcontentloaded' });
      await page.addStyleTag({ content: '[data-cosmetic-stage] {position:fixed!important;inset:0!important;width:600px!important;height:400px!important;z-index:2147483647!important;background:#080f1a!important;}' });
      const stage = page.locator('[data-cosmetic-ready="true"]');
      await stage.waitFor({ timeout: 60000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = await stage.screenshot({ path: `${output}/${id}.png` });
      await sharp(png).webp({ quality: 90 }).toFile(`apps/web/public/assets/images/cosmetics/${id}.webp`);
      assert.deepEqual(errors, [], id);
      results.push({ id, errors });
      await page.close();
      console.log(`PASS product: ${id}`);
    }
    for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${web}/v2-gallery.html?view=skin-shop&lng=tr`);
      for (const label of ['Gezegen halkası', 'Motor alevi', 'Klan bayrağı', 'Probe', 'Gemi']) {
        await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
        await page.locator('[data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: ${label}`);
        await page.screenshot({ path: `${output}/${width}-${label.replaceAll(' ', '-')}.png`, fullPage: true });
      }
      await page.goto(`${web}/v2-gallery.html?view=skin-inventory&lng=tr`);
      await page.getByRole('button', { name: /^Klan bayrağı/ }).click();
      await page.locator('[data-cosmetic-ready="true"]').waitFor({ timeout: 60000 });
      assert.equal(await page.getByRole('button', { name: 'Görünümü kuşan', exact: true }).isDisabled(), true);
      await page.screenshot({ path: `${output}/${width}-inventory.png`, fullPage: true });
      assert.deepEqual(errors, [], `layout ${width}`);
      results.push({ width, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
}
