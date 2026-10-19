import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Exercise the actual owner and identified-contact renderers; no server/account mutation. */
export async function verifyFleetTowing(output) {
  await mkdir(output, {recursive: true});
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const results = [], errors = [];
  try {
    const page = await browser.newPage({viewport: {width: 1000, height: 760}, deviceScaleFactor: 1});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    await page.goto(`${process.env.WEB ?? 'http://localhost:5199'}/robots.txt`);
    await page.evaluate(async () => {
      const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => undefined; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const {default: R} = await import('/node_modules/.vite/deps/react.js');
      const {default: {createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js');
      const {Canvas, useFrame} = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const T = await import('/node_modules/.vite/deps/three.js');
      const {OwnFleets, Traffic} = await import('/src/galaxy/Fleets.tsx');
      const {SCENE_LIGHT} = await import('/src/galaxy/planetSurface.ts');
      const {serverNow} = await import('/src/lib/clock.ts');
      const h = R.createElement;
      document.body.innerHTML = '<div id="stage" style="width:100vw;height:100vh"></div>';
      document.body.style.cssText = 'margin:0;background:#050914;overflow:hidden';
      const root = createRoot(document.getElementById('stage'));
      function Probe({mode, expected}) {
        let frames = 0;
        useFrame(({scene, gl, camera}) => {
          const prizes = [];
          scene.traverse(node => {if (node.name === 'towed-prize') prizes.push(node);});
          if (prizes.length !== expected || prizes.some(prize => !prize.getObjectByName(`formation-hulls-${prize.userData.hull.toLowerCase()}`))) return;
          if (++frames < 15) return;
          const chains = []; const engines = []; const positions = [];
          scene.traverse(node => {
            if (node.name === 'tow-chain-links') chains.push({count: node.count, triangles: node.geometry.index.count / 3 * node.count,
              finite: [...node.instanceMatrix.array].every(Number.isFinite), depthTest: node.material.depthTest});
            if (node.name === 'towed-prize') {
              positions.push(node.getWorldPosition(new T.Vector3()).toArray());
              node.traverse(child => {if (/exhaust|wake|engine/i.test(child.name)) engines.push(child.name);});
            }
          });
          window.__towReport = {mode, prizes: prizes.length, chains, engines, positions,
            calls: gl.info.render.calls, triangles: gl.info.render.triangles};
          if (window.__towCamera) {camera.position.set(...window.__towCamera); camera.lookAt(-1.2, -.25, 0);}
        });
        return null;
      }
      window.__renderTow = (mode, count, camera) => {
        window.__towReport = null; window.__towCamera = camera;
        const now = serverNow();
        const towing = count === 1 ? {TALON: 1} : count > 1 ? {TALON: 1, DART: count - 1} : undefined;
        const fleet = {CITADEL: 1, VIPER: 12, DART: 22, COURIER: 2, TALON: count ? 1 : 0};
        if (count > 1) fleet.DART += count - 1;
        const thread = {id: 'tow-preview', kind: 'unknown_signal', targetName: '', minutesRemaining: 30, leg: 'return',
          arriveAt: new Date(now + 1800000), fleet, towing,
          path: {from: {x: -20, y: 0, z: 0}, to: {x: 20, y: 0, z: 0}, departAt: new Date(now - 1800000), arriveAt: new Date(now + 1800000)}};
        const contact = {id: thread.id, kind: 'fleet', fleet, towing, from: {x: -20, y: 0, z: 0},
          to: {x: 20, y: 0, z: 0}, startAt: thread.path.departAt, endAt: thread.path.arriveAt};
        root.render(h(Canvas, {key: `${mode}:${count}`, camera: {position: camera, fov: 42}, dpr: 1, gl: {preserveDrawingBuffer: true}},
          h('color', {attach: 'background', args: ['#070d18']}), h('ambientLight', {intensity: SCENE_LIGHT.ambient}),
          h('directionalLight', {position: [-8, 12, 9], intensity: SCENE_LIGHT.key}),
          h('directionalLight', {position: [10, -3, -12], intensity: .48, color: '#91b5de'}),
          mode === 'owner' ? h(OwnFleets, {pending: [thread], nodes: [], focusedKey: null, onSelect: () => undefined})
            : h(Traffic, {contacts: [contact], nodes: [], focusedId: null, onSelect: () => undefined}),
          h(Probe, {mode, expected: count})));
      };
    });
    for (const [mode, count, angle, viewport, camera] of [
      ['owner', 0, 'baseline', [1000, 760], [4.4, 4.8, 7.2]],
      ['owner', 1, 'single', [1000, 760], [4.4, 4.8, 7.2]],
      ['owner', 2, 'double', [1000, 760], [1.4, 3.2, 3.8]],
      ['owner', 3, 'top', [1000, 760], [1.4, 3.2, 3.8]],
      ['observer', 3, 'side', [1000, 760], [3.8, 1.5, 7.8]],
      ['owner', 3, 'portrait', [350, 812], [4.4, 9, 14]],
    ]) {
      await page.setViewportSize({width: viewport[0], height: viewport[1]});
      await page.evaluate(({mode, count, camera}) => window.__renderTow(mode, count, camera), {mode, count, camera});
      await page.waitForFunction(() => window.__towReport, undefined, {timeout: 60000});
      await page.waitForTimeout(500);
      const report = await page.evaluate(() => window.__towReport);
      assert.equal(report.prizes, count);
      assert.deepEqual(report.engines, []);
      assert.equal(report.chains.length, count ? 1 : 0);
      for (const chain of report.chains) {assert(chain.finite); assert(chain.depthTest); assert(chain.count <= 102);}
      assert.deepEqual(errors, []);
      await page.screenshot({path: `${output}/${mode}-${angle}.png`});
      results.push({...report, angle});
      console.log(`PASS ${mode}/${angle}: ${report.prizes} prizes, ${report.chains[0]?.count ?? 0} links/collars, ${report.calls} draws`);
    }
    await page.setViewportSize({width: 1000, height: 760});
    await page.goto(`${process.env.WEB ?? 'http://localhost:5199'}/v2-gallery.html?view=fleet-towing&lng=tr`);
    for (const count of [2, 3]) {
      await page.getByRole('button', {name: `${count} gemi`}).click();
      await page.locator(`[data-fleet-towing-gallery][data-towing-count="${count}"]`).waitFor({timeout: 60000});
      await page.screenshot({path: `${output}/interactive-${count}-ships.png`});
    }
    await page.getByRole('button', {name: 'Diğer oyuncu'}).click();
    await page.waitForTimeout(500);
    await page.locator('[data-fleet-towing-gallery][data-towing-count="3"]').waitFor({timeout: 60000});
    assert.deepEqual(errors, []);
    console.log('PASS interactive preview: 2/3 prizes and observer toggle');
    await writeFile(`${output}/measurements.json`, JSON.stringify({results, errors}, null, 2));
  } finally {await browser.close();}
}
