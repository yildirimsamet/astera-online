import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright';

export async function verifyPlanetMarkerSize(out = 'out/planet-marker-size') {
  await mkdir(out, { recursive: true });
  const before = ts.transpileModule(execFileSync('git', ['show', 'HEAD:apps/web/src/galaxy/planetMarkerLayout.ts'], { encoding: 'utf8' }).replace('return { pinScale,', 'return { pinWidthScale: pinScale, pinScale,'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const evidence = [];
  try {
    for (const version of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'tr-TR' }); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (version === 'before') await page.route('**/src/galaxy/planetMarkerLayout.ts*', route => route.fulfill({ contentType: 'application/javascript', body: before }));
      await page.route('**/src/v2/gallery/CosmeticTrialGallery.tsx*', async route => {
        const response = await route.fetch(); const source = await response.text(); const needle = 'seed(keys.season,'; assert(source.includes(needle));
        const fixture = `const markerField = client.getQueryData(keys.galaxy); const markerBody = markerField.planets[0];
          seed(keys.galaxy, {...markerField, planets:[...markerField.planets,
            {...markerBody,id:'marker-rival',owner:'Rakip',isSelf:false,isOwned:false,kind:'CAPITAL',intel:'RESOLVED',position:{x:420,y:0,z:420}},
            {...markerBody,id:'marker-neutral',owner:'',isSelf:false,isOwned:false,kind:'NEUTRAL',intel:'RESOLVED',position:{x:620,y:0,z:420}},
            {...markerBody,id:'marker-eye',isSelf:false,isOwned:false,intel:'UNKNOWN',position:{x:520,y:0,z:320}},
            {...markerBody,id:'marker-memory',owner:'Rakip',isSelf:false,isOwned:false,kind:'COLONY',intel:'REMEMBERED',position:{x:520,y:0,z:520}}
          ]}); ${needle}`;
        await route.fulfill({ response, body: source.replace(needle, fixture) });
      });
      await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5297'}/v2-gallery.html?view=store-discovery&lng=tr`);
      await page.waitForFunction(() => window.__galaxy?.scene.getObjectByName('eye-shut'), null, { timeout: 120000 });
      await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 90000 });
      await page.locator('[data-academy-home-ready="true"]').waitFor({ state: 'attached', timeout: 90000 });
      for (const distance of [12, 80, 400]) {
        const frame = await page.evaluate(distance => {
          const g = window.__galaxy; g.controls.dispatchEvent({ type: 'start' });
          g.controls.target.set(10.4, 0, 8.4); g.camera.position.set(10.4, distance * .5, 8.4 + distance * .8660254);
          g.controls.update(); g.camera.updateMatrixWorld(); g.invalidate();
          return g.gl.info.render.frame;
        }, distance);
        await page.waitForFunction(frame => {
          const g = window.__galaxy;
          if (g.gl.info.render.frame >= frame + 3) return true;
          g.invalidate(); return false;
        }, frame, { timeout: 30000 });
        const rows = await page.evaluate(() => {
          const g = window.__galaxy; const rows = [];
          g.scene.traverse(mesh => {
            const pin = mesh.isInstancedMesh && mesh.geometry?.type === 'ConeGeometry' && mesh.geometry.parameters.height === .2;
            const eye = mesh.name === 'eye-shut'; if (!pin && !eye) return;
            const matrix = mesh.matrix.clone(), position = mesh.position.clone(), scale = mesh.scale.clone(), rotation = mesh.quaternion.clone();
            mesh.updateWorldMatrix(true, false);
            for (let i = 0; i < mesh.count; i++) {
              mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld); matrix.decompose(position, rotation, scale);
              const depth = -position.clone().applyMatrix4(g.camera.matrixWorldInverse).z;
              const pixel = 2 * depth * Math.tan(g.camera.fov * Math.PI / 360) / g.size.height;
              rows.push({ kind: pin ? 'pin' : 'eye', depth, width: scale.x * (pin ? .13 * Math.sqrt(3) : 1) / pixel, height: scale.y * (pin ? .2 : 1) / pixel });
            }
          }); return rows;
        });
        assert(rows.some(row => row.kind === 'pin') && rows.some(row => row.kind === 'eye'));
        for (const row of rows) {
          const oldHeight = row.kind === 'pin' ? 4 + 6 / (1 + row.depth / 25) : 9 + 22 / (1 + row.depth / 25);
          const oldWidth = row.kind === 'pin' ? oldHeight * (.13 * Math.sqrt(3)) / .2 : oldHeight;
          const reduction = version === 'after' ? 2 : 0;
          assert(Math.abs(row.height - (oldHeight - reduction)) < .03, JSON.stringify(row));
          assert(Math.abs(row.width - (oldWidth - reduction)) < .03, JSON.stringify(row));
        }
        evidence.push({ version, distance, rows });
        await page.screenshot({ path: `${out}/${version}-${distance}.png` });
        await page.evaluate(() => window.__galaxy.controls.dispatchEvent({ type: 'end' }));
      }
      assert.deepEqual(errors, []); await page.close();
    }
    await writeFile(`${out}/proof.json`, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
  } finally { await browser.close(); }
}
