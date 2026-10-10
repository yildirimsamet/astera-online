/** Verify motion on the actual store with a stationary engine inspection camera. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');
export async function verifyCosmeticMotion(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 760, height: 950 }, recordVideo: { dir: output, size: { width: 760, height: 950 } } });
  const page = await context.newPage();
  const video = page.video();
  const errors = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  try {
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=skin-shop&lng=en`);
    await page.getByRole('button', { name: /^Engines/ }).click();
    for (const [id, name] of [['engine-aurora','Aurora Drive'], ['engine-helios','Solar Forge'], ['engine-singularity','Void Pulse'], ['engine-titan','Titan Drive'], ['engine-tempest','Tempest Drive'], ['engine-prism','Prism Drive']]) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
      const stage = page.locator(`[data-cosmetic-stage="${id}"][data-cosmetic-ready="true"]`);
      await stage.waitFor({ timeout: 60000 });
      const first = await stage.screenshot({ path: `${output}/${id}-a.png` });
      await page.waitForTimeout(900);
      const second = await stage.screenshot({ path: `${output}/${id}-b.png` });
      const a = await sharp(first).removeAlpha().raw().toBuffer();
      const b = await sharp(second).removeAlpha().raw().toBuffer();
      let changed = 0;
      for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 25) changed++;
      const fraction = changed / (a.length / 3);
      assert(fraction > .002, `${id}: exhaust appears frozen (${fraction})`);
      results.push({ id, movingPixelFraction: fraction });
      console.log(`PASS animated exhaust: ${id} (${(fraction * 100).toFixed(2)}% moving pixels)`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    try { await video?.saveAs(`${output}/engines.webm`); }
    finally { await browser.close(); }
  }
  await writeFile(`${output}/motion-results.json`, JSON.stringify({ results, errors }, null, 2));
}
