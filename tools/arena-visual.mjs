import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const emptyTeam = { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, team: null, claims: [] };

/** First real launch: controls follow the owned class even when local practice saved another one. */
export async function verifyArenaLaunch(out = '.dev/arena') {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const proof = [];
  try {
    for (const [stored, owned] of [['akinci', 'muhafiz'], ['akinci', 'kilavuz'], ['kilavuz', 'akinci']]) {
      const context = await browser.newContext({ viewport: { width: 350, height: 812 } });
      const page = await context.newPage();
      await page.route('**/arena/team', route => route.fulfill({ json: emptyTeam }));
      await page.addInitScript(ship => {
        localStorage.setItem('i18nextLng', 'tr'); localStorage.setItem('astera-arena-ship', ship);
        Object.defineProperty(navigator, 'deviceMemory', { value: 2 });
      }, stored);
      const now = Date.now();
      await page.route('**/arena/hangar', route => route.fulfill({ json: {
        core: 9, minCore: 9, ship: { class: owned, changeUntil: null, fuel: 200, ammo: 100, hold: [0, 0, 0],
          readyAt: null, readyReason: null, flying: false, level: 3, xp: 0, xpNext: 150, levelCap: 9,
          abilities: {}, upgrade: { alloy: 450, crystal: 225, deuterium: 0 } },
        refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 100, alloy: 1000, crystal: 1000,
        cap: { alloy: 1000, crystal: 1000, deuterium: 100 }, sent: { alloy: 0, crystal: 0, deuterium: 0 },
        resetsAt: new Date(now + 86400000).toISOString(), entryClosesAt: new Date(now + 864000000).toISOString(),
      } }));
      // Never join a real room; only the local launch/control setup is under test.
      await page.routeWebSocket('**/arena/ws', socket => { socket.onMessage(() => undefined); });
      await page.goto(`${process.env.WEB ?? 'http://127.0.0.1:5199'}/?arena=sandbox&hangar&mode=online`);
      await page.locator('.ap-launch').click({ timeout: 90000 });
      const cast = await page.evaluate(() => {
        const { world, controls } = window.__arena;
        controls.actionDown('signature', 1, 100); controls.actionUp('signature', 1, 140);
        const input = controls.sample(); const first = [input.signature, input.signatureTarget];
        controls.actionDown('signature', 2, 220); controls.actionUp('signature', 2, 260);
        const second = controls.sample();
        return { ship: world.pilot.ship, self: world.pilot.id, first, second: [second.signature, second.signatureTarget] };
      });
      assert.equal(cast.ship, owned);
      if (owned === 'akinci') assert.deepEqual(cast.first, [true, -1], `${stored} → ${owned}: missile fires on one press`);
      else {
        assert.equal(cast.first[0], false, `${stored} → ${owned}: first press aims`);
        assert.deepEqual(cast.second, [true, cast.self], `${stored} → ${owned}: double press shields or repairs self`);
      }
      proof.push({ stored, owned, ...cast });
      await context.close();
    }
    await mkdir(out, { recursive: true });
    await writeFile(`${out}/launch-controls.json`, JSON.stringify(proof, null, 2));
    console.log(JSON.stringify({ launchControls: proof }));
  } finally { await browser.close(); }
}

/** The Y6 hangar and spread reticle. Isolated HTTP fixtures never change a commander's real ship. */
export async function verifyArena(out = '.dev/arena') {
  const web = process.env.WEB ?? 'http://127.0.0.1:5199';
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const proof = []; const errors = [];
  try {
    for (const lng of ['tr', 'en']) for (const width of [350, 1280]) {
      if (process.env.ARENA_VISUAL_ONE && (lng !== 'tr' || width !== 350)) continue;
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, locale: lng });
      const page = await context.newPage();
      await page.route('**/arena/team', route => route.fulfill({ json: emptyTeam }));
      page.on('pageerror', error => errors.push(error.message));
      const now = Date.now();
      const hangar = { core: 12, minCore: 9, ship: { class: 'kilavuz', changeUntil: null, fuel: 250, ammo: 480, hold: [0, 0, 0],
        readyAt: new Date(now + 3600000).toISOString(), readyReason: 'repair', flying: false,
        level: 3, xp: 50, xpNext: 150, levelCap: 12, abilities: { radar: 1 }, upgrade: { alloy: 450, crystal: 225, deuterium: 0 } },
        refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 250, alloy: 5000, crystal: 2000,
        cap: { alloy: 5600, crystal: 2800, deuterium: 120 }, sent: { alloy: 100, crystal: 30, deuterium: 0 },
        resetsAt: new Date(now + 86400000).toISOString(), entryClosesAt: new Date(now + 864000000).toISOString() };
      const purchases = [];
      await page.route('**/arena/hangar', route => route.fulfill({ json: hangar }));
      await page.route('**/arena/ability', async route => {
        const body = route.request().postDataJSON();
        assert.deepEqual(body, { ability: 'smoke' }); purchases.push(body);
        hangar.ship.abilities.smoke = 1;
        await route.fulfill({ json: hangar });
      });
      await page.route('**/arena/repair', async route => {
        hangar.ship.readyAt = new Date(Date.now() + 17 * 60000).toISOString();
        hangar.alloy -= 225; hangar.crystal -= 80;
        await route.fulfill({ json: hangar });
      });
      await page.goto(`${web}/v2-gallery.html?view=arena-hangar&lng=${lng}`);
      await page.locator('[data-part="abilities"]').waitFor();
      await page.locator('.hp-stage canvas').waitFor();
      // Canvas exists before Suspense has loaded its hull. A star-only loading frame proves nothing.
      await page.evaluate(async () => {
        const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
        window.__hangarRoots = _roots;
      });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.hp-stage canvas');
        const state = window.__hangarRoots.get(canvas)?.store.getState();
        let hull = false; let bay = false;
        state?.scene.traverseVisible(node => {
          if (node.name === 'lod0') hull = true;
          if (node.isMesh && node.geometry?.attributes.position?.count > 10000) bay = true;
        });
        return hull && bay;
      }, null, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      const stage = await page.evaluate(async () => {
        const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
        const state = _roots.get(document.querySelector('.hp-stage canvas'))?.store.getState();
        const meshes = [];
        state?.scene.traverse(node => {
          if (!node.isMesh) return;
          node.geometry.computeBoundingBox();
          const box = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
          const centre = box.getCenter(node.position.clone());
          const parents = []; for (let p = node; p; p = p.parent) parents.push([p.name, p.visible]);
          meshes.push({ name: node.name, count: node.geometry.attributes.position?.count, parents, min: box.min.toArray(), max: box.max.toArray(), clip: centre.project(state.camera).toArray() });
        });
        return { camera: state?.camera.position.toArray(), meshes };
      });
      assert.ok(stage.meshes.some(mesh => mesh.parents.some(([name]) => name === 'lod0') && mesh.parents.every(([, visible]) => visible)
        && Math.abs(mesh.clip[0]) < 1 && Math.abs(mesh.clip[1]) < 1 && Math.abs(mesh.clip[2]) < 1), 'the loaded ship must remain visible in the hangar');
      await page.screenshot({ path: `${out}/hangar-${lng}-${width}.png` });
      const repair = page.locator('[data-part="repair"]');
      await repair.scrollIntoViewIfNeeded();
      await repair.screenshot({ path: `${out}/repair-${lng}-${width}.png` });
      const abilities = page.locator('[data-part="abilities"]');
      await abilities.scrollIntoViewIfNeeded();
      await abilities.screenshot({ path: `${out}/abilities-${lng}-${width}.png` });
      await page.getByRole('button', { name: lng === 'tr' ? 'Duman · geliştir' : 'Upgrade Smoke', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-ability="smoke"]')?.textContent.includes('2/5'));
      assert.equal(purchases.length, 1);
      const radar = page.locator('[data-ability="radar"]');
      assert.match(await radar.innerText(), /3\/5/);
      assert.match(await radar.innerText(), /Yarık/);
      assert.ok(await radar.locator('button').isDisabled());
      assert.ok(!(await radar.innerText()).includes('→'));
      await repair.locator('button').click();
      await repair.waitFor({ state: 'detached' });
      const stats = page.locator('[data-part="class"]');
      await stats.scrollIntoViewIfNeeded();
      await stats.screenshot({ path: `${out}/stats-${lng}-${width}.png` });
      const clipped = await page.locator('[data-stat] dt').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent));
      assert.deepEqual(clipped, [], 'stat labels and values must fit');
      proof.push({ lng, width, repair: true, separateRanks: true, rankThreeCap: true, clipped });
      await context.close();
    }
    if (!process.env.ARENA_VISUAL_ONE && !process.env.ARENA_VISUAL_HANGAR) {
    // Real flight/render loop: the level's actual spread changes the ring drawn each frame.
    const page = await browser.newPage({ viewport: { width: 350, height: 812 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('i18nextLng', 'tr'); localStorage.setItem('astera-arena-ship', 'akinci');
      Object.defineProperty(navigator, 'deviceMemory', { value: 2 }); });
    await page.goto(`${web}/?arena=sandbox`);
    await page.locator('.ap-launch').waitFor({ timeout: 90000 });
    await page.locator('.ap-launch').click();
    await page.waitForFunction(() => window.__arena?.client.phase === 'flight', null, { timeout: 30000 });
    await page.evaluate(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      const { world, controls } = window.__arena;
      world.brains.clear(); world.drones.length = 0; world.dronePrevious.length = 0;
      world.pilot.p.x = 0; world.pilot.p.z = 0; world.pilot.p.y = world.layout.halfHeight * 0.8;
      controls.stop(); world.pilot.s = 0;
    });
    await page.waitForFunction(() => parseFloat(document.querySelector('.ah-reticle')?.style.getPropertyValue('--s') ?? '') > 0);
    await page.waitForTimeout(1200);
    const ring = () => page.locator('.ah-reticle').evaluate(node => parseFloat(node.style.getPropertyValue('--s')));
    const first = await ring();
    await page.screenshot({ path: `${out}/reticle-level-1.png` });
    await page.evaluate(() => { window.__arena.world.pilot.level = 20; });
    await page.waitForFunction(before => parseFloat(document.querySelector('.ah-reticle')?.style.getPropertyValue('--s') ?? '') < before * 0.8, first);
    const top = await ring();
    assert.ok(top > 0 && top < first * 0.8);
    assert.equal(await page.locator('.ah-reticle i').count(), 1);
    assert.equal(await page.locator('.ah-reticle b').count(), 1);
    await page.screenshot({ path: `${out}/reticle-level-20.png` });
    proof.push({ reticle: { first, top } });
    }
    assert.deepEqual(errors, []);
    await writeFile(`${out}/checks.json`, JSON.stringify({ proof, errors }, null, 2));
    console.log(JSON.stringify({ proof, errors }));
  } finally { await browser.close(); }
  if (!process.env.ARENA_VISUAL_ONE && !process.env.ARENA_VISUAL_HANGAR) await verifyArenaLaunch(out);
}
