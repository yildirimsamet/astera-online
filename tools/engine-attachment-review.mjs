/** Rear/top/side evidence using the live hull and engine components, without the galaxy backdrop. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const output = process.argv[2] ?? 'out/premium-assets/engine-calibration/with-engines';
const web = process.env.WEB ?? 'http://localhost:5174';
const engines = process.env.ENGINE_REVIEW_ENGINES !== 'off';
const views = process.env.ENGINE_REVIEW_VIEWS?.split(',') ?? ['rear', 'top', 'side'];
const motion = process.env.ENGINE_REVIEW_MOTION?.split(',') ?? [];
const engineIds = process.env.ENGINE_REVIEW_ENGINE?.split(',');
const requireCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
const sharp = requireCli('sharp');
await mkdir(output, { recursive: true });
const errors = [], captures = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => { errors.push(error.message); });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${web}/robots.txt`);
  await page.evaluate(async ({ engines }) => {
    const refresh = await import('/@react-refresh');
    refresh.default.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => undefined;
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { Canvas, useThree } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const { useGLTF } = await import('/node_modules/.vite/deps/@react-three_drei.js');
    const { Hull, Exhaust, FormationLightField } = await import('/src/galaxy/Fleets.tsx');
    const { StrategicExhaust } = await import('/src/galaxy/StrategicExhaust.tsx');
    const { FormationCosmeticEngines } = await import('/src/galaxy/CosmeticEffects.tsx');
    const A = await import('/src/ui/assets.ts');
    const { FLEET_V2_ASSET_MANIFEST } = await import('/src/ui/fleet-v2-assets.ts');
    const { hullVisualScale, HULL_LIGHT } = await import('/src/galaxy/flightVisual.ts');
    const { shipHullModels } = await import('/src/galaxy/shipCosmetics.ts');
    const skinHulls = { 'ship-red-dragon': 'CORSAIR', 'ship-scorpion': 'VIPER', 'ship-shark': 'CITADEL', 'ship-stingray': 'LEVIATHAN' };
    const { Bloom, EffectComposer } = await import('/node_modules/.vite/deps/@react-three_postprocessing.js');
    document.body.innerHTML = '<div id="root" style="width:480px;height:480px"></div>';
    document.body.style.margin = '0';
    const root = createRoot(document.getElementById('root')), e = React.createElement;
    function Subject({ id, view, engineId }) {
      const hull = skinHulls[id] ?? id;
      const shipSkins = React.useMemo(() => skinHulls[id] ? { [hull]: id } : undefined, [id, hull]);
      const url = id === 'probe-ufo' ? A.MODEL.probeUfo : id === 'probe' ? A.MODEL.probe : id === 'death-star' ? A.MODEL.deathStar : id === 'trade-ship' ? A.MODEL.tradeShip : shipHullModels(hull, shipSkins).model;
      const lift = A.MODEL_POSE[url]?.height ?? 0;
      useGLTF(url, false);
      const camera = useThree(state => state.camera), scene = useThree(state => state.scene), renderer = useThree(state => state.gl), aim = React.useRef(1000);
      const special = id === 'probe' || id === 'probe-ufo' || id === 'death-star' || id === 'trade-ship';
      const markers = React.useMemo(() => special ? [] : [{ hull, filled: 1, ordinal: 0 }], [hull, special]);
      React.useLayoutEffect(() => {
        camera.zoom = 480 / (view === 'rear' ? 1.3 : 2);
        const z = view === 'rear' ? 0 : -0.2;
        camera.position.set(...(view === 'rear' ? [0, lift, -5] : view === 'side' ? [5, lift, z] : view === 'right' ? [-5, lift, z] : view === 'bottom' ? [0, lift - 5, z + 0.00001] : [0, lift + 5, z + 0.00001]));
        camera.lookAt(0, lift, z); camera.updateProjectionMatrix();
        window.engineReady = `${id}:${view}:${engineId ?? 'native'}`;
        window.engineSnapshot = () => {
          const batches = [];
          scene.traverse(node => {
            if (!node.isInstancedMesh) return;
            const material = Array.isArray(node.material) ? node.material[0] : node.material;
            const program = renderer.properties.get(material).currentProgram;
            const source = program?.fragmentShader ? renderer.getContext().getShaderSource(program.fragmentShader) ?? '' : '';
            const compiledStyle = source.includes('vBolts') ? 'tempest' : source.includes('float disperse') ? 'prism' : source.includes('float hot =') ? 'shared' : null;
            batches.push({ name: node.name, count: node.count, order: node.renderOrder, depthTest: material.depthTest, depthWrite: material.depthWrite, compiledStyle });
          });
          let hullOrder = 0;
          scene.getObjectByName('craft-hull')?.traverse(node => { if (node.isMesh) hullOrder = Math.max(hullOrder, node.renderOrder); });
          return { id, view, url, engineId, hullOrder, batches };
        };
      }, [id, view, lift, camera, scene, renderer, engineId]);
      const colour = id === 'probe' || id === 'probe-ufo' ? '#9dffc4' : special ? '#ffe9b8' : HULL_LIGHT[hull].flame;
      return e(React.Fragment, null, e(Hull, { url, scale: 1, glow: '#18212b', focused: false, fog: false }),
        engines && (id === 'death-star' ? e(StrategicExhaust, { scale: 1 }) : special ? e(Exhaust, { url, scale: 1, colour })
          : engineId ? e(FormationCosmeticEngines, { id: engineId, markers, slots: [[0, 0, 0]], scale: 1 / hullVisualScale(hull, 1), aimDistance: aim, shipSkins })
          : e(FormationLightField, { markers, slots: [[0, 0, 0]], scale: 1 / hullVisualScale(hull, 1), aimDistance: aim, focused: false, showPips: false, shipSkins })));
    }
    window.renderEngine = (id, view, engineId) => {
      window.engineReady = null;
      root.render(e(Canvas, { orthographic: true, camera: { position: [0, 0, -5], zoom: 480 / 1.3, near: 0.01, far: 100 },
        gl: { antialias: false, preserveDrawingBuffer: true }, dpr: 1, style: { width: '480px', height: '480px' } },
      e('color', { attach: 'background', args: ['#05090f'] }), e('ambientLight', { intensity: 1.2 }),
      e('directionalLight', { position: [2, 3, -5], intensity: 3 }), e('directionalLight', { position: [-4, 1, 3], intensity: 2, color: '#97baff' }),
      e(React.Suspense, { fallback: null }, e(Subject, { id, view, engineId })),
      e(EffectComposer, { enableNormalPass: false, multisampling: 0 }, e(Bloom, { intensity: 0.62, luminanceThreshold: 0.78, luminanceSmoothing: 0.22, mipmapBlur: true, radius: 0.72, levels: 6 }))));
    };
    window.engineShips = [...Object.keys(FLEET_V2_ASSET_MANIFEST), 'PROSPECTOR', 'probe', 'death-star', 'trade-ship', ...Object.keys(skinHulls), 'probe-ufo'];
  }, { engines });
  const allShips = await page.evaluate(() => window.engineShips);
  const requested = process.env.ENGINE_REVIEW_CRAFT?.split(',');
  const ships = requested ? allShips.filter(id => requested.includes(id)) : allShips;
  if (!ships.length) throw new Error('No matching craft for engine review');
  for (const engineId of engineIds ?? [undefined]) {
    const folder = engineIds?.length > 1 ? join(output, engineId) : output;
    await mkdir(folder, { recursive: true });
    for (const id of ships) {
      const layers = [];
      for (const [index, view] of views.entries()) {
        await page.evaluate(({ id, view, engineId }) => { window.renderEngine(id, view, engineId); }, { id, view, engineId });
        await page.waitForFunction(key => window.engineReady === key, `${id}:${view}:${engineId ?? 'native'}`, { timeout: 30_000 });
        await page.waitForTimeout(view === 'rear' ? 600 : 160);
        const { data, snapshot } = await page.evaluate(() => ({ data: document.querySelector('canvas').toDataURL('image/png').split(',')[1], snapshot: window.engineSnapshot() }));
        if (engines && id !== 'probe-ufo' && !snapshot.batches.some(batch => batch.count > 0)) throw new Error(`${id}: no engine instances rendered`);
        if (engineId && !['probe', 'probe-ufo', 'death-star', 'trade-ship'].includes(id)) {
          const batch = snapshot.batches.find(batch => batch.name === 'formation-cosmetic-exhaust');
          const expected = engineId === 'engine-tempest' ? 'tempest' : engineId === 'engine-prism' ? 'prism' : 'shared';
          if (batch?.compiledStyle !== expected) errors.push(`${engineId}/${id}/${view}: requested ${expected}, GPU still uses ${batch?.compiledStyle}`);
          if (!batch || batch.order <= snapshot.hullOrder || !batch.depthTest || batch.depthWrite) errors.push(`${engineId}/${id}/${view}: foreground flame cannot occlude the hull correctly`);
        }
        const bytes = Buffer.from(data, 'base64');
        await writeFile(join(folder, `${id}-${view}.png`), bytes);
        layers.push({ input: bytes, left: index * 480, top: 0 });
        captures.push(snapshot);
      }
      await sharp({ create: { width: views.length * 480, height: 480, channels: 3, background: '#05090f' } }).composite(layers).png().toFile(join(folder, `${id}-views.png`));
      console.log(`${engineId ?? 'native'}/${id}: ${views.join('/')}`);
      if (motion.includes(id)) {
        const frames = join(folder, `${id}-motion`);
        await mkdir(frames, { recursive: true });
        if (views.at(-1) !== 'side') {
          await page.evaluate(({ id, engineId }) => { window.renderEngine(id, 'side', engineId); }, { id, engineId });
          await page.waitForFunction(key => window.engineReady === key, `${id}:side:${engineId ?? 'native'}`);
        }
        const images = new Set();
        for (let frame = 0; frame < 12; frame++) {
          await page.waitForTimeout(120);
          const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
          images.add(data);
          await writeFile(join(frames, `${String(frame).padStart(2, '0')}.png`), Buffer.from(data, 'base64'));
        }
        if (images.size < 6) throw new Error(`${id}: live flow appears frozen`);
        execFileSync('ffmpeg', ['-y', '-threads', '1', '-filter_threads', '1', '-framerate', '6', '-i', join(frames, '%02d.png'), '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', '0', join(folder, `${id}-motion.gif`)], { stdio: 'pipe' });
        captures.push({ id, engineId, motionFrames: 12, uniqueFrames: images.size });
        console.log(`${id}: 12 live flow frames (${images.size} distinct)`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
  await writeFile(join(output, 'review.json'), JSON.stringify({ captures, errors, renderer: 'Live components, diagnostic orthographic camera and lighting; SwiftShader, not device FPS.' }, null, 2));
}
