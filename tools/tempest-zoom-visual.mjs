/**
 * Real GPU regression for Tempest's emission budget as its nozzles become subpixel.
 * node tools/visual.mjs out/tempest-zoom --tempest-zoom
 * TEMPEST_BASELINE=1 records pre-change measurements without enforcing the new budget.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyTempestZoom(output) {
  await mkdir(output, { recursive: true });
  const baseline = process.env.TEMPEST_BASELINE === '1';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let samples;
  try {
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/robots.txt`);
    samples = await page.evaluate(async () => {
      const T = await import('/node_modules/.vite/deps/three.js');
      const { createPlumeGeometry } = await import('/src/galaxy/cosmeticPlume.ts');
      const { effectProgram } = await import('/src/galaxy/cosmeticEffects.ts');
      const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setSize(640, 480); document.body.replaceChildren(renderer.domElement);
      const scene = new T.Scene();
      const geometry = createPlumeGeometry('tempest');
      const material = new T.ShaderMaterial({ ...effectProgram('tempest', 1), uniforms: {
        uTime: { value: 0 }, uStyle: { value: 40 }, uPixelHeight: { value: 480 }, uNozzleCount: { value: 1 },
      }, transparent: true, depthWrite: false, side: T.DoubleSide, forceSinglePass: true, blending: T.AdditiveBlending, toneMapped: false });
      const mesh = new T.InstancedMesh(geometry, material, 17);
      for (let i = 0; i < 17; i++) mesh.setMatrixAt(i, new T.Matrix4());
      mesh.count = 1; scene.add(mesh);
      const preview = new T.Mesh(geometry, material); scene.add(preview);
      const target = new T.WebGLRenderTarget(640, 480, { type: T.FloatType });
      const pixels = new Float32Array(640 * 480 * 4);
      const samples = [];
      for (const orthographic of [false, true]) {
        mesh.visible = !orthographic; preview.visible = orthographic;
        for (const distance of [4, 40, 160, 640]) {
          const camera = orthographic ? new T.OrthographicCamera(-distance * 2 / 3, distance * 2 / 3, distance / 2, -distance / 2, .01, 1000)
            : new T.PerspectiveCamera(45, 640 / 480, .01, 1000);
          camera.position.set(0, distance * .8, distance * .6 - 1.5); camera.lookAt(0, 0, -1.5); camera.updateMatrixWorld();
          let peak = 0, energy = 0, warmFrames = 0, maxWarmPixels = 0, flashImage, flashTime;
          // Sweep the actual reseeding animation, including sparse arc and bright ignition frames.
          for (let frame = 0; frame < 24; frame++) {
            material.uniforms.uTime.value = 2 + frame / 12;
            renderer.setRenderTarget(target); renderer.render(scene, camera);
            renderer.readRenderTargetPixels(target, 0, 0, 640, 480, pixels);
            let warmPixels = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const light = pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722;
              if (!Number.isFinite(light)) throw new Error('Non-finite Tempest emission');
              peak = Math.max(peak, light); energy += light;
              if (light > .05 && pixels[i] > pixels[i + 1] * 1.02 && pixels[i + 1] > pixels[i + 2] * 1.25) warmPixels++;
            }
            if (warmPixels) warmFrames++;
            if (warmPixels > maxWarmPixels) {
              flashTime = material.uniforms.uTime.value;
              renderer.setRenderTarget(null); renderer.render(scene, camera);
              flashImage = renderer.domElement.toDataURL('image/png').split(',')[1];
            }
            maxWarmPixels = Math.max(maxWarmPixels, warmPixels);
          }
          renderer.setRenderTarget(null); renderer.render(scene, camera);
          samples.push({ orthographic, distance, peak, energy, warmFrames, maxWarmPixels, flashTime, image: flashImage ?? renderer.domElement.toDataURL('image/png').split(',')[1] });
        }
      }
      // At map range several nozzles can cover the same pixel; test their combined flash.
      preview.visible = false; mesh.visible = true; mesh.count = 17;
      material.uniforms.uNozzleCount.value = 17;
      const camera = new T.PerspectiveCamera(45, 640 / 480, .01, 1000);
      camera.position.set(0, 128, 94.5); camera.lookAt(0, 0, -1.5); camera.updateMatrixWorld();
      let peak = 0, energy = 0;
      for (let frame = 0; frame < 24; frame++) {
        material.uniforms.uTime.value = 2 + frame / 12;
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 640, 480, pixels);
        for (let i = 0; i < pixels.length; i += 4) {
          const light = pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722;
          if (!Number.isFinite(light)) throw new Error('Non-finite combined Tempest emission');
          peak = Math.max(peak, light); energy += light;
        }
      }
      if (peak >= .78) throw new Error(`17 overlapping distant nozzles still bloom: ${peak}`);
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      samples.push({ orthographic: false, distance: 160, nozzles: 17, peak, energy, image: renderer.domElement.toDataURL('image/png').split(',')[1] });
      target.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
      return samples;
    });
    for (const sample of samples) {
      await writeFile(`${output}/${sample.orthographic ? 'ortho' : 'perspective'}-${sample.distance}${sample.nozzles ? `-${sample.nozzles}-nozzles` : ''}.png`, Buffer.from(sample.image, 'base64'));
      delete sample.image;
    }
    assert.deepEqual(errors, []);
    if (baseline) await writeFile(`${output}/baseline.json`, JSON.stringify(samples, null, 2));
    else {
      for (const sample of samples) {
        assert(sample.peak > .015, `Tempest vanished: ${JSON.stringify(sample)}`);
        if (sample.distance === 4) assert(sample.peak > 3, 'Near-view lightning lost its HDR flash');
        // Galaxy bloom begins at .78. A distant nozzle must remain visible below that threshold.
        if (sample.distance >= 160) assert(sample.peak < .78, `Subpixel Tempest still overfeeds bloom: ${JSON.stringify(sample)}`);
        if (!sample.nozzles) {
          assert(sample.warmFrames > 0 && sample.warmFrames < 18, `Missing intermittent white-yellow flash: ${JSON.stringify(sample)}`);
          if (sample.distance >= 160) assert(sample.maxWarmPixels >= 8 && sample.maxWarmPixels <= 80, `Map lightning must remain readable but compact: ${JSON.stringify(sample)}`);
        }
      }
    }
    // Check the real React uniform wiring and photograph the actual formation too.
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=cosmetic-fleet:engine-tempest`);
    await page.locator('[data-fleet-ready="true"]').waitFor({ timeout: 60_000 });
    await page.evaluate(async flashTime => {
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const { HalfFloatType } = await import('/node_modules/.vite/deps/three.js');
      const { EffectComposer, RenderPass, EffectPass, BloomEffect } = await import('/node_modules/postprocessing/build/index.js');
      const { guardBloomInput } = await import('/src/galaxy/finiteGuard.ts');
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      state.setFrameloop('never');
      const position = state.camera.position.clone();
      const bloom = new BloomEffect({ intensity: .62, luminanceThreshold: .78, luminanceSmoothing: .22, mipmapBlur: true, radius: .72, levels: 6 });
      guardBloomInput(bloom);
      const composer = new EffectComposer(state.gl, { frameBufferType: HalfFloatType, multisampling: 0 });
      composer.addPass(new RenderPass(state.scene, state.camera));
      composer.addPass(new EffectPass(state.camera, bloom));
      composer.setSize(state.size.width, state.size.height);
      window.tempestZoom = factor => {
        state.camera.position.copy(position).multiplyScalar(factor);
        state.camera.lookAt(0, 0, 0); state.camera.updateMatrixWorld();
        state.scene.traverse(node => {
          if (node.name === 'formation-cosmetic-exhaust') node.material.uniforms.uTime.value = flashTime;
        });
        composer.render(0);
        let height = 0, nozzles = 0, expectedNozzles = 0;
        state.scene.traverse(node => {
          if (node.name === 'formation-cosmetic-exhaust') {
            height = node.material.uniforms.uPixelHeight.value;
            nozzles = node.material.uniforms.uNozzleCount.value;
            expectedNozzles = node.count;
          }
        });
        return { actual: height, expected: state.size.height, nozzles, expectedNozzles };
      };
    }, samples[0].flashTime);
    for (const factor of [1, 10, 40]) {
      const height = await page.evaluate(factor => window.tempestZoom(factor), factor);
      assert.equal(height.actual, height.expected, 'Live exhaust did not receive CSS viewport height');
      assert(height.nozzles > 1, 'Formation regression requires multiple motors');
      assert.equal(height.nozzles, height.expectedNozzles, 'Live emission budget did not receive the motor count');
      await page.screenshot({ path: `${output}/fleet-${factor}.png` });
    }
    assert.deepEqual(errors, []);
    await writeFile(`${output}/review.json`, JSON.stringify({ samples, errors, renderer: 'Actual shaders, deterministic animation sweep; SwiftShader, not device FPS.' }, null, 2));
    console.log(JSON.stringify(samples, null, 2));
  } finally { await browser.close(); }
}
