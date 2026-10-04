/** Real GLTF loading and bounds at phone/desktop sizes, compared with the untouched masters. */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyMonumentModels(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const results = [];
  try {
    for (const [label, viewport] of [
      ['mobile', { width: 350, height: 812 }],
      ['desktop', { width: 1280, height: 900 }],
    ]) {
      for (const master of [false, true]) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        const errors = [];
        page.on('pageerror', (error) => { errors.push(error.message); });
        try {
          if (master) {
            await page.route('**/assets/models/monuments/*.glb', (route) => route.fulfill({
              path: join('assets/source/models/monuments', basename(new URL(route.request().url()).pathname)),
              contentType: 'model/gltf-binary',
            }));
          }
          await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5199'}/v2-gallery.html?view=monument-models`, { waitUntil: 'networkidle' });
          const buttons = page.locator('[aria-label="Choose monument"]').getByRole('button');
          if (await buttons.count() !== 5) throw new Error('Monument selector is missing a model');
          for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
            await buttons.nth(ordinal - 1).click();
            await page.waitForFunction((expected) =>
              document.body.dataset.monumentReady === 'true'
                && Number(document.body.dataset.monumentOrdinal) === expected,
            ordinal, { timeout: 30_000 });
            const scene = await page.evaluate(() => ({
              size: Number(document.body.dataset.monumentSize),
              ship: Number(document.body.dataset.monumentReferenceSize),
              triangles: Number(document.body.dataset.monumentTriangles),
              outlineTriangles: Number(document.body.dataset.monumentOutlineTriangles),
              overflow: document.documentElement.scrollWidth > window.innerWidth,
            }));
            if (!Number.isFinite(scene.size) || Math.abs(scene.size / scene.ship - 3) > 0.001) {
              throw new Error(`Monument ${ordinal}: the visible model is not three times the trade ship (${scene.size}/${scene.ship} = ${scene.size / scene.ship})`);
            }
            if (!master && (scene.triangles < 4_000 || scene.triangles > 5_000)) {
              throw new Error(`Monument ${ordinal}: rendered geometry exceeds its triangle budget`);
            }
            if (scene.overflow || errors.length > 0) throw new Error(`Monument ${ordinal}: ${JSON.stringify({ ...scene, errors })}`);
            const name = `${label}-${ordinal}-${master ? 'master' : 'optimized'}`;
            await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
            results.push({ name, ...scene });
            console.log(`PASS ${name}: ${scene.triangles} body + ${scene.outlineTriangles} rim tris · ${(scene.size / scene.ship).toFixed(2)}× trade`);
          }
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
}
