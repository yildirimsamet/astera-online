import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Actual GalaxyView/Canvas renderers; only server state is supplied by a local query fixture. */
export async function verifyCommanderPresence(out = 'out/commander-presence') {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const evidence = [];
  try {
    const page = await browser.newPage({ viewport: { width: 350, height: 812 }, locale: 'tr-TR' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && message.text().includes('THREE.WebGLProgram')) errors.push(message.text()); });
    await page.route('**/src/v2/gallery/CosmeticTrialGallery.tsx*', async route => {
      const response = await route.fetch(); const source = await response.text();
      const needle = 'seed(keys.planets,'; assert(source.includes(needle));
      const fixture = `seed(keys.commanderShip, {capitalPlanetId:'trial-home',rulesetVersion:19,ship:{class:'muhafiz',level:3,status:'ready',readyAt:null}});
        ${needle}`;
      await route.fulfill({ response, body: source.replace(needle, fixture) });
    });
    await page.route('**/src/v2/gallery/StoreDiscoveryGallery.tsx*', async route => {
      const response = await route.fetch(); const source = await response.text();
      const needle = 'const [api] = useState'; assert(source.includes(needle));
      await route.fulfill({ response, body: source.replace(needle, `window.__commanderClient = client; ${needle}`) });
    });
    await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5297'}/v2-gallery.html?view=store-discovery`);
    await page.waitForFunction(() => window.__galaxy?.scene.getObjectByName('commander-drive'), null, { timeout: 120000 });
    await page.locator('[data-loading-screen]').waitFor({ state: 'hidden', timeout: 90000 });
    const inspect = async (name, width, tag, detail = false) => {
      await page.setViewportSize({ width, height: width === 350 ? 812 : 900 });
      await page.waitForFunction(name => {
        const subject = window.__galaxy?.scene.getObjectByName(name);
        let hull = false;
        subject?.traverse(node => { if (node.isMesh && node.material?.isMeshPhysicalMaterial) hull = true; });
        return hull;
      }, name);
      const proof = await page.evaluate(({ name, detail }) => {
        const g = window.__galaxy; const subject = g.scene.getObjectByName(name);
        subject.updateWorldMatrix(true, true);
        const at = subject.getWorldPosition(subject.position.clone());
        if (name === 'commander-ship' && !detail) at.lerp(at.clone().set(10.4, 0, 8.4), 0.5);
        g.controls.dispatchEvent({ type: 'start' });
        const offset = detail ? at.clone().set(1.7, 1.6, -2.3).applyQuaternion(subject.getWorldQuaternion(subject.quaternion.clone())) : at.clone().set(0, 3.7, 5.4);
        g.controls.target.copy(at); g.camera.position.copy(at).add(offset);
        g.controls.update(); g.camera.updateMatrixWorld(); g.invalidate();
        const materials = []; const tails = [];
        subject.traverse(node => {
          if (node.isMesh && node.material?.isMeshPhysicalMaterial) materials.push({ coat: node.material.clearcoat, roughness: node.material.roughness });
          if (node.name === 'commander-exhaust') tails.push(node.scale.z);
        });
        const hullRoot = name === 'homeward-escort' ? subject.children[0] : subject;
        return { scale: hullRoot.getWorldScale(hullRoot.scale.clone()).toArray(), materials, tails };
      }, { name, detail });
      assert(proof.materials.length > 0);
      assert(proof.materials.every(m => m.coat === 0.65 && m.roughness <= 0.46));
      if (name !== 'commander-ship') assert(proof.scale.every(value => Math.abs(value - 1.656) < .00001));
      if (tag !== 'repair') assert.equal(proof.tails.length, 2); else assert.equal(proof.tails.length, 0);
      await page.waitForTimeout(650);
      await page.screenshot({ path: `${out}/${width}-${tag}.png` });
      await page.evaluate(() => window.__galaxy.controls.dispatchEvent({ type: 'end' }));
      evidence.push({ tag, width, ...proof });
    };
    for (const ship of ['muhafiz', 'akinci', 'kilavuz']) {
      await page.evaluate(ship => window.__commanderClient.setQueryData(['commander-ship'], old => ({ ...old, ship: { ...old.ship, class: ship } })), ship);
      await page.locator('[data-part="commander-ship-tag"]').filter({ hasText: { muhafiz: 'Muhafız', akinci: 'Akıncı', kilavuz: 'Kılavuz' }[ship] }).waitFor();
      await inspect('commander-ship', 350, ship);
      await inspect('commander-ship', 350, `${ship}-detail`, true);
    }
    await page.evaluate(() => window.__commanderClient.setQueryData(['commander-ship'], old => ({ ...old, ship: { ...old.ship, status: 'repair', readyAt: new Date(Date.now() + 600000).toISOString() } })));
    await page.waitForFunction(() => !window.__galaxy.scene.getObjectByName('commander-drive'));
    await inspect('commander-ship', 350, 'repair');
    await page.evaluate(() => {
      const client = window.__commanderClient; const now = Date.now();
      client.setQueryData(['commander-ship'], old => ({ ...old, ship: { ...old.ship, status: 'admiral', readyAt: null } }));
      client.setQueryData(['pending'], { pending: [{ id: 'commander-preview', kind: 'fleet', targetName: 'Vega', leg: 'outbound', minutesRemaining: 20,
        arriveAt: new Date(now + 1200000), fleet: { CITADEL: 1, DART: 3 }, admiral: { ship: 'muhafiz', level: 3 },
        path: { from: { x: 520, y: 0, z: 420 }, to: { x: 1020, y: 0, z: 870 }, departAt: new Date(now - 1200000), arriveAt: new Date(now + 1200000) } }] });
    });
    await inspect('flight-escort', 1280, 'fleet');
    await page.evaluate(() => {
      const client = window.__commanderClient; const now = Date.now(); client.setQueryData(['pending'], { pending: [] });
      client.setQueryData(['commander-ship'], old => ({ ...old, homeward: { from: { x: 1020, y: 0, z: 870 }, to: { x: 520, y: 0, z: 420 },
        departAt: new Date(now - 1200000).toISOString(), arriveAt: new Date(now + 1200000).toISOString() } }));
    });
    await inspect('homeward-escort', 1280, 'homeward');
    await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5297'}/v2-gallery.html?view=commander-presence&lng=tr`);
    await page.getByRole('status').waitFor({ state: 'hidden', timeout: 120000 });
    for (const name of ['Muhafız', 'Yakın inceleme', 'Akıncı', 'Akıncı', 'Filo ile', 'Filo ile', 'Eve dönüş', 'Gezegen yanında']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('status').waitFor({ state: 'hidden', timeout: 120000 });
    }
    for (const name of ['Yakınlaştır', 'Uzaklaştır', 'Kamerayı sıfırla']) await page.getByRole('button', { name, exact: true }).click();
    await page.screenshot({ path: `${out}/interactive-page-review.png` });
    assert.deepEqual(errors, []);
    await writeFile(`${out}/proof.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally { await browser.close(); }
}
