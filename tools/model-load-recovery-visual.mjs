import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { commanderEscortsReady } from './commander-sight-visual.mjs';

/** Real GameShell/GalaxyView and GPU renderer; only server data and failed HTTP assets are substituted. */
export async function verifyModelLoadRecovery(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://127.0.0.1:5189';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 1 });
      const errors = [], failures = [];
      let unavailable = true;
      page.on('pageerror', error => { errors.push(error.message); });
      // Keep the existing real HUD/galaxy fixture and seed one mixed fleet beside its capital.
      await page.route('**/src/v2/gallery/CosmeticTrialGallery.tsx*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const marker = 'seed(keys.pending, { pending: [] });';
        assert(source.includes(marker), 'pending fixture marker must exist');
        const body = source.replace(marker, `seed(keys.pending, { pending: [{
          id: 'model-recovery-flight', kind: 'fleet', targetName: 'Vega', minutesRemaining: 30,
          arriveAt: new Date(now + 1800000), fleet: { DART: 5, PIKE: 5 },
          admiral: { ship: 'muhafiz', level: 3 },
          path: { from: { x: 440, y: 0, z: 420 }, to: { x: 600, y: 0, z: 420 },
            departAt: new Date(now - 1800000), arriveAt: new Date(now + 1800000) }
        }] });`);
        await route.fulfill({ response, body });
      });
      await page.route('**/src/v2/gallery/storeDiscoveryApi.ts*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        assert(source.includes('return api;'), 'API fixture marker must exist');
        await route.fulfill({ response, body: source.replace('return api;', `api.galaxyShipModels = async () => ({ models: {
          muhafiz: { url: '/arena/galaxy-ships/muhafiz.glb?v=recovery-test', engines: [], nozzle: 0.03, ktx2: false }
        } }); return api;`) });
      });
      await page.route(/\/(?:assets\/models\/ships\/dart(?:_lod)?\.glb|arena\/galaxy-ships\/muhafiz\.glb)(?:\?.*)?$/, async route => {
        const path = new URL(route.request().url()).pathname;
        if (unavailable) {
          failures.push(path);
          await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"NOT_FOUND"}' });
        } else if (path.endsWith('/muhafiz.glb')) {
          // A valid owned GLB stands in for the private commander asset during this offline fixture test.
          await route.fulfill({ path: fileURLToPath(new URL('../apps/web/public/assets/models/ships/pike.glb', import.meta.url)), contentType: 'model/gltf-binary' });
        } else await route.continue();
      });
      try {
        await page.goto(`${web}/v2-gallery.html?view=store-discovery&lng=tr`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.__galaxy?.scene), { timeout: 60_000 });
        await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 60_000 });
        await page.waitForFunction(() => {
          const scene = window.__galaxy?.scene;
          return scene?.getObjectByName('formation-hulls-pike') && scene.getObjectByName('flight-escort');
        }, undefined, { timeout: 60_000 });
        assert(failures.some(url => url.endsWith('/dart.glb')));
        assert(failures.some(url => url.endsWith('/muhafiz.glb')));
        const snapshot = await page.evaluate(() => {
          const g = window.__galaxy;
          const escort = g.scene.getObjectByName('flight-escort');
          return {
            failedHull: Boolean(g.scene.getObjectByName('formation-hulls-dart')),
            healthyHull: Boolean(g.scene.getObjectByName('formation-hulls-pike')),
            escortMeshes: (() => { let count = 0; escort.traverse(node => { if (node.isMesh && node.name !== 'escort-hit-target') count++; }); return count; })(),
            drawCalls: g.gl.info.render.calls,
            camera: g.camera.position.toArray(),
          };
        });
        assert.equal(snapshot.failedHull, false);
        assert.equal(snapshot.healthyHull, true);
        assert.equal(snapshot.escortMeshes, 0);
        assert.equal(await page.evaluate(commanderEscortsReady, 1), false, 'empty escort must not count as recovered');
        assert(snapshot.drawCalls > 0, 'world must still render');
        assert.equal(await page.getByText('Oyun arayüzü çalışmayı durdurdu', { exact: true }).count(), 0);
        await page.screenshot({ path: join(output, `${width}-model-404-galaxy.png`) });
        const canvas = await page.locator('canvas').first().boundingBox();
        assert(canvas);
        await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .5);
        // Parsing readiness precedes control effects. Confirm input reaches the live canvas before dragging.
        const inputReady = await page.evaluate(({ x, y }) => {
          const g = window.__galaxy;
          window.__modelRecoveryGesture = false;
          const started = () => { window.__modelRecoveryGesture = true; g.controls.removeEventListener('start', started); };
          g.controls.addEventListener('start', started);
          return g.controls.enabled && document.elementFromPoint(x, y) === g.gl.domElement;
        }, { x: canvas.x + canvas.width * .65, y: canvas.y + canvas.height * .5 });
        assert(inputReady, 'the gesture must target the active galaxy canvas');
        await page.mouse.down();
        await page.waitForFunction(() => window.__modelRecoveryGesture);
        await page.mouse.move(canvas.x + canvas.width * .85, canvas.y + canvas.height * .6, { steps: 12 });
        await page.mouse.up();
        await page.waitForFunction(before => window.__galaxy.camera.position.toArray().some((value, i) => Math.abs(value - before[i]) > .001), snapshot.camera);
        const point = await page.evaluate(() => {
          const g = window.__galaxy;
          const targets = g.scene.getObjectByName('formation-hulls-pike').getObjectByName('fleet-hull-hit-targets');
          targets.updateWorldMatrix(true, false);
          const local = targets.matrixWorld.clone();
          targets.getMatrixAt(0, local);
          const at = targets.position.clone().setFromMatrixPosition(targets.matrixWorld.clone().multiply(local));
          g.controls.target.copy(at);
          g.camera.position.copy(at).add(at.clone().set(0, 3, 5));
          g.controls.update(); g.camera.updateMatrixWorld(); g.invalidate();
          at.project(g.camera);
          const rect = g.gl.domElement.getBoundingClientRect();
          return { x: rect.left + (at.x + 1) * rect.width / 2, y: rect.top + (1 - at.y) * rect.height / 2 };
        });
        await page.mouse.click(point.x, point.y);
        const rail = page.locator('[data-focus-rail]');
        await rail.locator('[data-flight-escort]').waitFor();
        assert.match(await rail.innerText(), /Vega/, 'the tap must select the fixture fleet, not a nearby planet');
        await page.screenshot({ path: join(output, `${width}-model-404-fleet-selected.png`) });
        await page.locator('[data-menu-button]').click();
        await page.locator('[data-v2-commander-menu]').waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: join(output, `${width}-model-404-menu-usable.png`) });
        // React development builds also report caught errors; every one must name an injected asset.
        unavailable = false;
        await page.evaluate(() => { window.dispatchEvent(new Event('online')); });
        await page.waitForFunction(() => Boolean(window.__galaxy?.scene.getObjectByName('formation-hulls-dart')), undefined, { timeout: 45_000 });
        await page.waitForFunction(commanderEscortsReady, 1, { timeout: 45_000 });
        assert(await page.locator('[data-v2-commander-menu]').isVisible(), 'recovery must preserve the open menu');
        await page.getByRole('dialog').last().locator('header button').last().click();
        await page.locator('[data-v2-commander-menu]').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => {
          let instances = 0;
          window.__galaxy.scene.traverse(node => {
            if (node.isInstancedMesh && node.name.startsWith('formation-hull-bodies-')) instances += node.count;
          });
          return instances >= 2; // Both the intact Pike and the recovered Dart must resume drawing.
        });
        await rail.locator('[data-flight-escort]').waitFor();
        assert.match(await rail.innerText(), /Vega/);
        await page.screenshot({ path: join(output, `${width}-models-restored.png`) });
        assert(errors.every(message => message.startsWith('Could not load ')
          && message.includes('responded with 404') && failures.some(path => message.includes(path))), errors.join('\n'));
        results.push({ width, failures, snapshot, cameraMoved: true, fleetSelectable: true, menuUsable: true, fatalScreen: false, recoveredModels: true, errors });
        console.log(`PASS ${width}px: failed models hide locally, then restore on reconnect; camera, selection and menu stay usable`);
      } catch (error) {
        await page.screenshot({ path: join(output, `${width}-failure.png`) }).catch(() => undefined);
        results.push({ width, failures, errors, failure: error.message });
        throw error;
      } finally { await page.close(); }
    }
  } finally {
    await writeFile(join(output, 'evidence.json'), `${JSON.stringify(results, null, 2)}\n`);
    await browser.close();
  }
}
