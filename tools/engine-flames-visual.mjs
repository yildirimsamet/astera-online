import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { chromium } from 'playwright';

const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');

export async function verifyEngineFlameTails(page, output) {
  const results = [];
  for (const variant of ['solar', 'cryo', 'vacuum', 'siege']) {
    const samples = await page.evaluate(variant => {
      const r = window.__engineFlameReview;
      r.renderer.setAnimationLoop(null);
      r.scene.traverse(node => { if (node.isMesh && node !== r.batch.mesh) node.visible = false; });
      r.batch.set(0, { variant, matrix: r.batch.mesh.matrix.clone().makeRotationY(-Math.PI / 2).setPosition(-2.3, 0, 0),
        length: 4.6, nozzleRadius: .28, throttle: 1, seed: 17.13 });
      r.batch.mesh.count = 1;
      r.camera.position.set(0, 0, 12); r.camera.lookAt(0, 0, 0); r.camera.updateMatrixWorld();
      r.setTime(2.5); r.render();
      const canvas = r.renderer.domElement;
      const scale = canvas.height / (2 * Math.tan(r.camera.fov * Math.PI / 360) * 12);
      return [.64, .78, .9, .97].map(t => ({ t, x: Math.round(canvas.width / 2 + (-2.3 + t * 4.6) * scale), y: Math.round(canvas.height / 2) }));
    }, variant);
    const buffer = await page.locator('canvas').screenshot({ path: `${output}/tail-${variant}.png` });
    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const levels = samples.map(sample => {
      let sum = 0;
      for (let y = sample.y - 1; y <= sample.y + 1; y++) for (let x = sample.x - 1; x <= sample.x + 1; x++) {
        const start = (y * info.width + x) * 3;
        sum += Math.max(0, data[start] - 4, data[start + 1] - 7, data[start + 2] - 12);
      }
      return { t: sample.t, light: sum / 9 };
    });
    results.push({ variant, levels });
    assert(levels[0].light > 15, `${variant}: control sample lost the live flame`);
    assert(levels[3].light < 8, `${variant}: exposed hot rod at 97%: ${JSON.stringify(levels)}`);
    assert(levels[2].light < levels[0].light * .5, `${variant}: tail does not fade gradually: ${JSON.stringify(levels)}`);
  }
  return results;
}

export async function verifyEngineFlames(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=512'] });
  const errors = [], measurements = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 1120 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  async function setup(query = '') {
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/engine-flame-preview.html${query}`);
    await page.waitForFunction(() => window.__engineFlameReview?.ready);
    await page.evaluate(() => { window.__engineFlameReview.setTime(2.5); });
  }
  async function capture(name) {
    await page.evaluate(() => { window.__engineFlameReview.render(); });
    return page.locator('canvas').screenshot({ path: `${output}/${name}.png` });
  }
  async function pixels(buffer) { return sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true }); }
  function difference(a, b) {
    assert.equal(a.data.length, b.data.length);
    let changed = 0, total = 0;
    for (let i = 0; i < a.data.length; i += 3) {
      const delta = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (delta > 18) changed++;
      total += delta;
    }
    return { fraction: changed / (a.data.length / 3), mean: total / a.data.length };
  }
  try {
    await setup();
    const lengths = await page.evaluate(() => {
      const batch = window.__engineFlameReview.batch;
      return Array.from({ length: batch.mesh.count }, (_, index) => batch.mesh.geometry.getAttribute('aDimensions').getY(index));
    });
    for (const length of lengths) assert(Math.abs(length - 4.6) < .00001, `Full-throttle length was not halved: ${length}`);
    measurements.push({ scenario: 'full-throttle-length', lengths });
    const full = await pixels(await capture('01-full-burn'));
    await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
    await page.evaluate(() => { window.__engineFlameReview.setTime(3.1); });
    const later = await pixels(await capture('02-moving-flow'));
    const motion = difference(full, later);
    assert(motion.fraction > .005, `Expected advecting turbulence: ${JSON.stringify(motion)}`);
    await page.evaluate(() => { window.__engineFlameReview.setThrottle(0); });
    const off = await pixels(await capture('03-shutdown'));
    assert(difference(full, off).fraction > .015, 'Full throttle should light a substantial plume');
    await page.evaluate(() => { window.__engineFlameReview.setTime(9); });
    assert.deepEqual(await pixels(await capture('04-shutdown-later')), off, 'Zero throttle leaked animated light');
    await page.evaluate(() => { window.__engineFlameReview.setThrottle(.35); });
    const low = await pixels(await capture('05-low-throttle'));
    assert(difference(off, low).fraction > .005, 'Low throttle lost its flame');
    assert(difference(full, low).fraction > .01, 'Throttle did not change the plume');
    await page.evaluate(() => { window.__engineFlameReview.setThrottle(1); window.__engineFlameReview.setTime(2.5); });
    for (const view of ['oblique', 'rear']) {
      await page.evaluate(view => { window.__engineFlameReview.setView(view); }, view);
      const image = await pixels(await capture(`06-${view}`));
      let lit = 0;
      for (let i = 0; i < image.data.length; i += 3) if (image.data[i] + image.data[i + 1] + image.data[i + 2] > 140) lit++;
      assert(lit > 150, `${view} view lost the volume`);
    }
    await page.evaluate(() => { window.__engineFlameReview.setView('side'); window.__engineFlameReview.setOccluder(true); });
    const covered = await pixels(await capture('07-opaque-occlusion'));
    assert(difference(full, covered).fraction > .015, 'Opaque foreground did not cover the exhaust');
    await page.evaluate(() => {
      const r = window.__engineFlameReview;
      r.setOccluder(false); r.setCount(128); r.render();
    });
    await capture('08-mixed-128-engines');
    const counters = await page.evaluate(() => {
      const r = window.__engineFlameReview;
      r.render();
      return { engines: r.batch.mesh.count, calls: r.renderer.info.render.calls,
        triangles: r.renderer.info.render.triangles, textures: r.renderer.info.memory.textures,
        samples: r.batch.mesh.material.defines.FLAME_STEPS };
    });
    assert.equal(counters.calls, 1);
    assert.equal(counters.engines, 128);
    assert.equal(counters.triangles, 128 * 12);
    measurements.push({ scenario: 'mixed-128', ...counters, motion });

    await page.setViewportSize({ width: 390, height: 844 });
    await setup('?quality=mobile');
    await capture('09-phone-mobile-quality');
    await page.screenshot({ path: `${output}/phone.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Phone layout overflows');
    assert.equal(await page.evaluate(() => window.__engineFlameReview.batch.mesh.material.defines.FLAME_STEPS), 8);
    // An axial wide plume must not reveal bright square corners of its proxy.
    const rearProbe = await page.evaluate(() => {
      const r = window.__engineFlameReview;
      r.renderer.setAnimationLoop(null);
      r.scene.traverse(node => { if (node.isMesh && node !== r.batch.mesh) node.visible = false; });
      r.batch.set(0, { variant: 'vacuum', matrix: r.batch.mesh.matrix.clone().identity(),
        length: 4, nozzleRadius: .16, throttle: 1, seed: 17.13 });
      r.batch.mesh.count = 1;
      r.camera.position.set(0, 0, -12); r.camera.lookAt(0, 0, -2); r.camera.updateMatrixWorld();
      r.render();
      const radius = .16 * r.batch.mesh.material.uniforms.uPeak.value[2] / .18;
      const radiusPixels = radius * r.renderer.domElement.height / (2 * Math.tan(r.camera.fov * Math.PI / 360) * 8);
      return { radiusPixels };
    });
    const axial = await pixels(await capture('10-rear-round-silhouette'));
    const cx = Math.floor(axial.info.width / 2), cy = Math.floor(axial.info.height / 2);
    const valueAt = (x, y) => [...axial.data.subarray((y * axial.info.width + x) * 3, (y * axial.info.width + x) * 3 + 3)];
    assert(valueAt(cx, cy).reduce((sum, value) => sum + value, 0) > 180, 'Rear view lost its white-hot throat');
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const corner = valueAt(Math.round(cx + x * rearProbe.radiusPixels * .81), Math.round(cy + y * rearProbe.radiusPixels * .81));
      assert(corner.every((value, channel) => Math.abs(value - [4, 7, 12][channel]) < 7), `Proxy corner leaked: ${corner}`);
    }
    measurements.push({ scenario: 'tails', results: await verifyEngineFlameTails(page, output) });
    assert.deepEqual(errors, []);
    await writeFile(`${output}/results.json`, `${JSON.stringify({ renderer: 'Chromium SwiftShader; not a phone FPS benchmark', measurements, errors }, null, 2)}\n`);
    console.log(`PASS engine flames: four variants, advection, throttle/off, rear/oblique, depth, phone, 128 engines in one draw. ${output}`);
  } finally { await browser.close(); }
}
