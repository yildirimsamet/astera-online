/** GPU checks for non-finite propagation and the galaxy's custom material families. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const shader = (source, name) => {
  const match = new RegExp(`const ${name} = (?:/\\* glsl \\*/ )?` + '`([\\s\\S]*?)`;').exec(source);
  assert(match, `Missing shader ${name}`);
  return match[1];
};

export async function verifyRenderArtifacts(output) {
  await mkdir(output, { recursive: true });
  const satellite = await readFile('apps/web/src/galaxy/Satellites.tsx', 'utf8');
  const sensors = await readFile('apps/web/src/galaxy/SensorRings.tsx', 'utf8');
  const fixtures = { shieldVertex: shader(satellite, 'SHIELD_VERT'), shieldFragment: shader(satellite, 'SHIELD_FRAG'),
    shellVertex: shader(sensors, 'SHELL_VERTEX'), radarVertex: shader(sensors, 'RADAR_SWEEP_VERTEX') };
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], results = [];
  const page = await browser.newPage({ viewport: { width: 512, height: 384 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/robots.txt`);
    const report = await page.evaluate(async ({ fixtures, rulesPath }) => {
      const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => undefined; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const T = await import('/node_modules/.vite/deps/three.js');
      const P = await import('/node_modules/postprocessing/build/index.js');
      const { FiniteSceneEffect, guardBloomInput } = await import('/src/galaxy/finiteGuard.ts');
      const { effectProgram, cosmeticEffectRecipe } = await import('/src/galaxy/cosmeticEffects.ts');
      const { createPlumeGeometry } = await import('/src/galaxy/cosmeticPlume.ts');
      const { RING_SPANS, saturnRingProfile } = await import('/src/galaxy/cosmeticRings.ts');
      const { cosmeticsInCategory } = await import(rulesPath);
      const { RADAR_FRAGMENT, SHELL_FRAGMENT, RADAR_SWEEP_FRAGMENT } = await import('/src/galaxy/SensorRings.tsx');
      const { planetSkinVisual } = await import('/src/ui/planetSkins.ts');
      const { createPlanetSkinMaterial } = await import('/src/galaxy/planetSkinMaterial.ts');
      const { addPlanetImpact } = await import('/src/galaxy/planetImpactMaterial.ts');
      const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setSize(127, 127); renderer.autoClear = true;
      document.body.replaceChildren(renderer.domElement);
      const pixels = new Float32Array(127 * 127 * 4);
      const target = new T.WebGLRenderTarget(127, 127, { type: T.FloatType });
      const scene = new T.Scene(); scene.background = new T.Color(.01, .02, .03);
      const camera = new T.PerspectiveCamera(45, 1, .01, 100);
      const results = [];
      const measure = (name, material, geometry, instanced = false) => {
        const mesh = instanced ? new T.InstancedMesh(geometry, material, 1) : new T.Mesh(geometry, material);
        if (instanced) mesh.setMatrixAt(0, new T.Matrix4());
        scene.add(mesh);
        let peak = 0, frames = 0;
        for (const time of [0, 2.7, 3599, 36000]) for (const eye of [[0, 0, 4], [0, 4, .001], [0, 0, .5]]) {
          if (material.uniforms?.uTime) material.uniforms.uTime.value = time;
          camera.position.set(...eye); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
          renderer.setRenderTarget(target); renderer.render(scene, camera);
          renderer.readRenderTargetPixels(target, 0, 0, 127, 127, pixels);
          for (const value of pixels) {
            if (!Number.isFinite(value)) throw new Error(`${name}: non-finite GPU pixel at time ${time}, camera ${eye}`);
            peak = Math.max(peak, Math.abs(value));
          }
          frames++;
        }
        results.push({ name, frames, peak }); scene.remove(mesh); material.dispose(); geometry.dispose();
      };
      const profile = new T.DataTexture(saturnRingProfile(256), 256, 1, T.RGBAFormat); profile.needsUpdate = true;
      const banner = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); banner.needsUpdate = true;
      for (const [kind, category] of [[0, 'RING'], [1, 'ENGINE'], [2, 'FLAG']]) for (const item of cosmeticsInCategory(category)) {
        const recipe = cosmeticEffectRecipe(item.style), span = RING_SPANS[item.style];
        const geometry = kind === 1 ? createPlumeGeometry(item.style) : kind === 0 && span
          ? new T.RingGeometry(span[0], span[1], 64) : new T.PlaneGeometry(kind === 2 ? 1.6 : 3.8, kind === 2 ? 1.03 : 3.8, 16, 16);
        if (!geometry.getAttribute('aEnvelope')) geometry.setAttribute('aEnvelope', new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(1), 1));
        const material = new T.ShaderMaterial({ ...effectProgram(item.style, kind), side: T.DoubleSide,
          uniforms: { uTime: { value: 0 }, uKind: { value: kind }, uStyle: { value: recipe.motion }, uPixelHeight: { value: 127 }, uNozzleCount: { value: 1 },
            uColour: { value: new T.Color(recipe.colour) }, uSecondary: { value: new T.Color(recipe.secondary) }, uProfile: { value: profile },
            uLift: { value: .1 }, uBanner: { value: banner }, uHasBanner: { value: 1 }, uSheen: { value: recipe.sheen ? 1 : 0 } }, toneMapped: false });
        measure(item.id, material, geometry, kind === 1);
      }
      for (const density of [0, 8]) {
        const geometry = new T.SphereGeometry(1, 32, 24);
        for (const [name, values, size] of [['aColour', [.2, .8, 1], 3], ['aOpacity', [.4], 1], ['aBreath', [1], 1], ['aPhase', [0], 1]]) geometry.setAttribute(name, new T.InstancedBufferAttribute(new Float32Array(values), size));
        measure(`Aegis-density-${density}`, new T.ShaderMaterial({ vertexShader: fixtures.shieldVertex, fragmentShader: fixtures.shieldFragment, side: T.DoubleSide,
          uniforms: { uDensity: { value: density }, uTime: { value: 0 } } }), geometry, true);
      }
      const sensorUniforms = () => ({ uTime: { value: 0 }, uColour: { value: new T.Color('#69e59a') }, uFalloff: { value: 3 }, uStrength: { value: .4 }, uBody: { value: .03 }, uGrid: { value: .1 }, uRim: { value: .4 }, uAlpha: { value: .3 }, uAngle: { value: 0 }, uHead: { value: .06 }, uArea: { value: .012 } });
      for (const [name, fragmentShader] of [['telescope', SHELL_FRAGMENT], ['radar-volume', RADAR_FRAGMENT]]) measure(name,
        new T.ShaderMaterial({ vertexShader: fixtures.shellVertex, fragmentShader, side: T.DoubleSide, uniforms: sensorUniforms() }), new T.SphereGeometry(1, 32, 24));
      measure('radar-sweep', new T.ShaderMaterial({ vertexShader: fixtures.radarVertex, fragmentShader: RADAR_SWEEP_FRAGMENT, side: T.DoubleSide, uniforms: sensorUniforms() }), new T.PlaneGeometry(2, 2));
      scene.add(new T.AmbientLight('#ffffff', 1));
      for (const item of cosmeticsInCategory('PLANET')) {
        const visual = planetSkinVisual(item.id);
        for (const level of [0, 3]) {
          const source = new T.MeshStandardMaterial({ color: '#738394', map: banner });
          const material = visual?.finish.kind === 'PALETTE' ? createPlanetSkinMaterial(source, visual.finish).material : source.clone();
          addPlanetImpact(material, level, { value: 3600 });
          measure(`${item.id}-impact-${level}`, material, new T.SphereGeometry(1, 32, 24)); source.dispose();
        }
      }
      // Deliberately inject invalid scene values. This checks the actual GPU, not shader text.
      const injected = new T.ShaderMaterial({ uniforms: { uFault: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform float uFault;void main(){gl_FragColor=vec4(.1,.2,.3,1.);if(abs(vUv.x-.5)<.025&&abs(vUv.y-.5)<.025)gl_FragColor.r=uFault;}' });
      const faultScene = new T.Scene(); const faultMesh = new T.Mesh(new T.PlaneGeometry(2, 2), injected); faultScene.add(faultMesh);
      const runFault = (guarded, value) => {
        const bloom = new P.BloomEffect({ luminanceThreshold: .78, mipmapBlur: true, levels: 6 }); guardBloomInput(bloom);
        const composer = new P.EffectComposer(renderer, { frameBufferType: T.FloatType, multisampling: 0 });
        composer.autoRenderToScreen = false;
        composer.addPass(new P.RenderPass(faultScene, camera));
        const effects = guarded ? [new FiniteSceneEffect(), bloom] : [bloom];
        composer.addPass(new P.EffectPass(camera, ...effects)); composer.setSize(127, 127);
        injected.uniforms.uFault.value = value;
        renderer.info.autoReset = false; renderer.info.reset(); composer.render(0);
        const calls = renderer.info.render.calls;
        // RenderPass fills inputBuffer; the single merged EffectPass writes outputBuffer.
        // Composer swaps local variables, not these public buffer properties.
        renderer.readRenderTargetPixels(composer.outputBuffer, 0, 0, 127, 127, pixels);
        const invalid = [...pixels].filter(value => !Number.isFinite(value)).length;
        const copy = [...pixels]; composer.dispose(); renderer.info.autoReset = true;
        return { invalid, calls, copy };
      };
      const unguarded = runFault(false, NaN);
      if (!unguarded.invalid) throw new Error('Fault injection did not reproduce invalid scene pixels');
      const normal = runFault(false, .1), protectedNormal = runFault(true, .1);
      if (normal.calls !== protectedNormal.calls) throw new Error('Finite guard added a fullscreen draw');
      const delta = Math.max(...normal.copy.map((value, i) => Math.abs(value - protectedNormal.copy[i])));
      if (delta > 1e-5) throw new Error(`Finite guard changed the healthy image: ${delta}`);
      for (const [name, value] of [['NaN', NaN], ['Infinity', Infinity], ['negative-Infinity', -Infinity], ['half-float-overflow', 70000]]) {
        const result = runFault(true, value);
        if (result.invalid) throw new Error(`Scene guard leaked ${name}: ${result.invalid} invalid channels`);
        results.push({ name: `fault-${name}`, invalid: result.invalid, calls: result.calls });
      }
      results.push({ name: 'guard-baseline', unguardedInvalid: unguarded.invalid, healthyImageDelta: delta, calls: normal.calls });
      profile.dispose(); banner.dispose(); injected.dispose(); faultMesh.geometry.dispose(); target.dispose(); renderer.dispose();
      return results;
    }, { fixtures, rulesPath: `/@fs/${resolve('packages/rules/src/index.ts')}` });
    results.push(...report);
    assert.deepEqual(errors, []);
    await writeFile(`${output}/gpu-review.json`, JSON.stringify({ results, errors, renderer: 'Headless SwiftShader; real driver reproduction still requires owner observation.' }, null, 2));
    console.log(`PASS ${results.length} shader families and injected-fault cases`);
    console.log(JSON.stringify(results.filter(row => row.name.startsWith('fault-') || row.name === 'guard-baseline'), null, 2));
  } finally { await browser.close(); }
}
