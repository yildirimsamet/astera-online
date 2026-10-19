import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Actual GalaxyCanvas + GameShell, with only the API replaced by a local fixture. */
export async function verifyUnknownSignalGuide(output) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const measurements = [];
  try {
    const sizes = [[350, 812], [844, 390], [1280, 812]].filter(([width]) => !process.env.SIGNAL_GUIDE_WIDTHS
      || process.env.SIGNAL_GUIDE_WIDTHS.split(',').includes(String(width)));
    assert(sizes.length > 0);
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(`Guide browser error: ${error.message}`); });
      await page.routeWebSocket('**/*', () => undefined);
      await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
      await page.addInitScript(() => {
        const now = Date.now();
        window.__guideData = { tier: 1, radar: null, signals: [{
          id: '00000000-0000-4000-8000-000000000001', at: { x: 1320, y: 0, z: 420 }, status: 'open',
          appearedAt: new Date(now - 60_000), expiresAt: new Date(now + 3_540_000), originPlanetId: null,
          origin: null, fleet: null, damage: null, departAt: null, arriveAt: null,
          returnDepartAt: null, returnAt: null, recalledAt: null, outcome: null, deliveredAt: null,
        }] };
      });
      await page.route(url => url.pathname.includes('/storeDiscoveryApi.'), async route => {
        const response = await route.fetch();
        const body = await response.text();
        const seam = /fetch:\s*\(\)\s*=>\s*Promise\.reject\(new Error\(['"]This gallery has no server connection['"]\)\)/;
        assert(seam.test(body), 'Gallery API fixture seam must exist');
        await route.fulfill({ response, body: body.replace(seam, `fetch: (input) => {
          const url = String(input);
          if (url.endsWith('/dispatch')) {
            const signal = window.__guideData.signals[0];
            Object.assign(signal, {status: 'outbound', departAt: new Date(), arriveAt: new Date(Date.now() + 600000), fleet: {DART: 1, COURIER: 1}});
            return Promise.resolve(new Response(JSON.stringify({signalId: signal.id, arriveAt: signal.arriveAt, fuel: 6}), {headers: {'content-type': 'application/json'}}));
          }
          if (url.endsWith('/api/unknown-signals')) return Promise.resolve(new Response(JSON.stringify(window.__guideData), {headers: {'content-type': 'application/json'}}));
          return Promise.reject(new Error('No server connection in guide verification'));
        }`) });
      });
      await page.route(url => url.pathname.includes('/CosmeticTrialGallery.'), async route => {
        const response = await route.fetch();
        const body = await response.text();
        assert(body.includes('return client;'));
        await route.fulfill({ response, body: body.replace('return client;', `
          window.__guideClient = client;
          const guideWorlds = client.getQueryData(['planets']);
          for (const world of guideWorlds.planets) {
            world.fleet = {DART: 2, COURIER: 2}; world.planet.deuterium = 1000; world.buildings.SHIPYARD = 1;
            client.setQueryData(['planet', world.planet.id], world);
          }
          return client;`) });
      });
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=store-discovery&lng=tr`);
      console.log(`Guide browser loaded: ${width}x${height}`);
      const guide = page.locator('[data-unknown-signal-guide]');
      try { await guide.waitFor({ timeout: 30_000 }); }
      catch (error) {
        await writeFile(`${output}/${width}-failure.json`, JSON.stringify(await page.evaluate(() => ({
          body: document.body.innerText, data: window.__guideData,
          queries: window.__guideClient?.getQueryCache().getAll().map(query => ({ key: query.queryKey, status: query.state.status, error: query.state.error?.message })),
        })), null, 2));
        await page.screenshot({ path: `${output}/${width}-failure.png` });
        throw error;
      }
      await page.waitForFunction(() => Boolean(window.__galaxy?.controls), undefined, { timeout: 90_000 });
      // Shader warmup and the actual opening finish before the fixture takes the camera.
      await page.waitForFunction(() => !document.querySelector('[data-loading-screen]')
        && document.querySelector('[data-unknown-signal-guide]')?.style.visibility === 'visible', undefined, { timeout: 90_000 });
      for (const [name, offset] of [['right', [0, 24, 100]], ['left', [0, 24, -100]], ['above', [60, 40, 0]], ['offscreen', [0, 2, 5]], ['behind', [5, 3, 0]]]) {
        await page.evaluate(offset => {
          const state = window.__galaxy;
          state.controls.enableDamping = false;
          state.controls.dispatchEvent({ type: 'start' });
          state.controls.target.set(10.4, 0, 8.4);
          state.camera.position.set(10.4 + offset[0], offset[1], 8.4 + offset[2]);
          state.controls.update();
          state.advance(performance.now());
          state.invalidate();
        }, offset);
        await page.waitForTimeout(200);
        await page.waitForFunction(() => {
          const element = document.querySelector('[data-unknown-signal-guide]');
          if (!element) return false;
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          const state = window.__galaxy;
          const point = state.scene.getObjectByName(`unknown-signal-${window.__guideData.signals[0].id}`).getWorldPosition(state.camera.position.clone());
          const view = point.clone().applyMatrix4(state.camera.matrixWorldInverse);
          let x, y;
          if (view.z < -1e-6) {
            point.project(state.camera); x = point.x * state.size.width; y = point.y * state.size.height;
          } else {
            x = view.x * state.camera.projectionMatrix.elements[0] * state.size.width;
            y = view.y * state.camera.projectionMatrix.elements[5] * state.size.height;
          }
          const expected = Math.hypot(x, y) < 1e-6 ? view.z < 0 ? 0 : Math.PI : Math.atan2(x, y);
          const actual = Number.parseFloat(element.style.getPropertyValue('--signal-guide-angle'));
          return (hit === element || element.contains(hit)) && Math.cos(actual - expected) > .9999;
        }, undefined, { timeout: 30_000 });
        const current = await guide.evaluate(element => {
          const box = element.getBoundingClientRect();
          const canvas = document.querySelector('canvas').getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return {
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
            angle: element.style.getPropertyValue('--signal-guide-angle'),
            offscreen: element.dataset.offscreen, clickable: hit === element || element.contains(hit),
            visibility: getComputedStyle(element).visibility, covering: hit?.outerHTML.slice(0, 300),
          };
        });
        await page.screenshot({ path: `${output}/${width}-${name}.png`, timeout: 60_000 });
        if (!current.clickable) console.error(JSON.stringify(current));
        assert(current.clickable, `${width} ${name}: arrow must be clickable`);
        assert(current.box.x >= current.canvas.x && current.box.x + current.box.width <= current.canvas.x + current.canvas.width);
        assert(current.box.y >= current.canvas.y && current.box.y + current.box.height <= current.canvas.y + current.canvas.height);
        if (width < 1100) assert(current.box.y + current.box.height < current.canvas.y + current.canvas.height - 64, 'Arrow must stay above the phone dock');
        measurements.push({ width, name, ...current });
      }
      const samples = measurements.filter(sample => sample.width === width);
      assert(new Set(samples.map(sample => sample.angle)).size > 1, 'Camera rotation must rotate the arrow');
      assert(new Set(samples.map(sample => `${sample.box.x}:${sample.box.y}`)).size > 1, 'Camera movement must move the arrow');
      await guide.click();
      await page.locator('[data-unknown-signal-sheet]').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Sinyali incele', exact: true }).click();
      await guide.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
      console.log(`PASS signal guide: ${width}px, camera movement/edges/click/dispatch`);
      await writeFile(`${output}/measurements.json`, `${JSON.stringify(measurements, null, 2)}\n`);
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/measurements.json`, `${JSON.stringify(measurements, null, 2)}\n`);
}
