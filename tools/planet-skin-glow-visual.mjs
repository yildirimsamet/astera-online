/** Read-only comparison of elemental skins at the real galaxy's three detail tiers. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

export async function verifyPlanetSkinGlow(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const source = await (await fetch(`${web}/src/v2/gallery/main.tsx`)).text();
  const react = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/);
  const dom = source.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/);
  assert(react && dom, 'Vite must expose the React imports');
  const browser = await chromium.launch({ args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-features=LocalNetworkAccessChecks',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ] });
  const results = [];
  try {
    for (const width of [723, 350]) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        // Keep dependency optimisation and unrelated edits from reloading a capture.
        await page.route('**/@vite/client', async route => {
          const response = await route.fetch();
          const client = await response.text();
          const connection = 'transport.connect(createHMRHandler(handleMessage));';
          assert(client.includes(connection), 'Vite HMR startup must be identifiable');
          await route.fulfill({ response, body:client.replace(connection, '') });
        });
        await page.route('**/__planet-skin-glow.html', route => route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html><head><meta charset="UTF-8"></head>
            <body style="margin:0;background:#080e19"><div id="root" style="height:100vh"></div>
            <script type="module">
              import '/src/styles.css';
              import RefreshRuntime from '/@react-refresh';
              RefreshRuntime.injectIntoGlobalHook(window);
              window.$RefreshReg$ = () => {};
              window.$RefreshSig$ = () => type => type;
              window.__vite_plugin_react_preamble_installed__ = true;
              const [{default: React}, {default: ReactDOM}, {GalaxyCanvas}, {planetNodes, SCALE}] = await Promise.all([
                import(${JSON.stringify(react[1])}), import(${JSON.stringify(dom[1])}),
                import('/src/galaxy/GalaxyCanvas.tsx'), import('/src/galaxy/scene.ts'),
              ]);
              const ids = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'];
              const names = ['LAV', 'BUZ', 'TOKSIK', 'COL'];
              const planets = ids.flatMap((id, index) => ['NORMAL', 'DEFAULT', 'RECOVERY_SHIELD'].map((status, row) => ({
                id: id + ':' + status, name: names[index], owner: status === 'DEFAULT' ? 'NORMAL' : names[index],
                kind: 'COLONY', isSelf: false, isOwned: false, coreTier: 2, coreLevel: 6,
                position: {x: index * 120, y: 0, z: row * 120},
                satellites: [], shielded: false, intel: 'RESOLVED', state: {kind: 'NORMAL'},
                ...(status === 'DEFAULT' ? {} : {skin: {id, status}}),
              })));
              const root = ReactDOM.createRoot(document.getElementById('root'));
              window.drawComparison = diameter => {
                const columns = innerWidth < 600 ? 2 : 4;
                const rows = 12 / columns;
                const height = 812;
                const fov = 50;
                const radius = planetNodes(planets)[0].radius;
                const distance = radius * 0.96 * height / (Math.tan(fov * Math.PI / 360) * diameter);
                const unitsPerPixel = 2 * distance * Math.tan(fov * Math.PI / 360) / height;
                const gapX = innerWidth / (columns + 0.5) * unitsPerPixel;
                const gapZ = Math.min(170, height / (rows + 1)) * unitsPerPixel;
                const arranged = planets.map(planet => {
                  const [skin, status] = planet.id.split(':');
                  const palette = ids.indexOf(skin);
                  const band = status === 'NORMAL' ? 0 : status === 'DEFAULT' ? 1 : 2;
                  const column = palette % columns;
                  const row = band * (4 / columns) + Math.floor(palette / columns);
                  return {...planet, position: {
                    x: (column - (columns - 1) / 2) * gapX * SCALE,
                    y: 0, z: (row - (rows - 1) / 2) * gapZ * SCALE,
                  }};
                });
                window.comparisonNodes = planetNodes(arranged);
                root.render(React.createElement(GalaxyCanvas, {
                  planets: arranged, pending: [], contacts: [], asteroids: [], runs: [], wrecks: [],
                  homePosition: {x:0,y:0,z:0}, aegisLevel:0, seasonStart:undefined,
                  focus:null, onFocus:() => {}, homeSignal:0, openingDataReady:true,
                  onReady:() => {window.comparisonReady = true;},
                }));
                window.comparisonCamera = () => {
                  const g = window.__galaxy;
                  g.camera.fov = fov;
                  g.camera.up.set(0,0,-1);
                  g.camera.position.set(0,distance,0.001);
                  g.camera.lookAt(0,0,0);
                  g.camera.updateProjectionMatrix();
                  g.controls.target.set(0,0,0);
                  g.controls.minPolarAngle = 0;
                  g.controls.maxDistance = Infinity;
                  g.controls.enableDamping = false;
                  g.controls.update();
                  g.clock.stop();
                  g.clock.elapsedTime = 5;
                  g.advance(performance.now());
                  g.invalidate();
                };
              };
              window.drawComparison(72);
            </script></body></html>`,
        }));
        await page.goto(`${web}/__planet-skin-glow.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.comparisonReady && window.__galaxy?.controls, undefined, { timeout: 60000 });
        await page.waitForTimeout(1200);
        for (const [tier, diameter] of [['full', 72], ['low', 32], ['billboard', 14]]) {
          await page.evaluate(size => { window.drawComparison(size); }, diameter);
          await page.waitForTimeout(200);
          await page.evaluate(() => { window.comparisonCamera(); });
          await page.waitForFunction(expected => {
            const active = [];
            window.__galaxy.scene.traverse(object => {
              if ((object.name === 'planet-skin-models-full' || object.name === 'planet-skin-models-low') && object.visible && object.count > 0) active.push(object.name);
            });
            return expected === 'billboard' ? active.length === 0 : active.length === 8 && active.every(name => name === 'planet-skin-models-' + expected);
          }, tier, {timeout:60000});
          const measured = await page.evaluate(() => {
            const g = window.__galaxy;
            const meshes = [];
            g.scene.traverse(object => {
              if (object.name === 'planet-skin-models-full' || object.name === 'planet-skin-models-low') {
                meshes.push({ name:object.name, count:object.count, visible:object.visible });
              }
            });
            const nodes = window.comparisonNodes.map(node => {
              const point = g.camera.position.clone().set(...node.position).project(g.camera);
              return {id:node.id, x:(point.x + 1) * innerWidth / 2, y:(1 - point.y) * innerHeight / 2};
            });
            return {meshes, nodes, camera:g.camera.position.toArray(), metrics:window.__galaxyMetrics.snapshot()};
          });
          const active = measured.meshes.filter(mesh => mesh.visible && mesh.count > 0);
          if (tier === 'billboard') assert.equal(active.length, 0);
          else {
            assert.equal(active.length, 8);
            assert(active.every(mesh => mesh.name === `planet-skin-models-${tier}`), JSON.stringify(measured));
          }
          assert(measured.nodes.every(node => node.x > 0 && node.x < width && node.y > 0 && node.y < 812));
          assert.deepEqual(errors, []);
          await page.screenshot({ path: `${output}/${width}-${tier}.png` });
          results.push({width, tier, diameter, ...measured, errors:[...errors]});
          console.log(`PASS ${width}px ${tier}: four skins, four defaults, four recovery skins; no Dyson shells`);
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/measurements.json`, `${JSON.stringify(results, null, 2)}\n`);
}
