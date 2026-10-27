import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const team = () => ({ playerId: id(1), clanId: id(10), canCreate: false, capacity: 5, claims: [],
  team: { id: id(20), state: 'forming', leaderId: id(1), joined: true,
    members: [1, 2, 3, 4, 5].map((n, i) => ({ playerId: id(n), name: ['Yıldırım', 'Aylin', 'Bora', 'Deniz', 'Ece'][i],
      ready: n > 1, tactic: n === 1 ? 'radar' : 'smoke', outcome: null, blocked: null,
      ship: { class: ['kilavuz', 'muhafiz', 'akinci'][i % 3], level: 3 + i, fuel: 180 + i * 10, fuelMax: 250, readyAt: null } })) } });

/** Isolated HTTP/WS fixtures exercise the real loaded renderer without touching a player's resources. */
export async function verifyArenaTeam(out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const web = process.env.WEB ?? 'http://127.0.0.1:5199'; const errors = []; const proof = []; let feedTimer = null; let inspectedPage = null;
  try {
    for (const lng of process.env.ARENA_TEAM_FLIGHT ? [] : ['tr', 'en']) for (const width of [350, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: lng });
      const page = inspectedPage = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const view = team(); const requests = [];
      await page.route(/\/arena\/team(?:\/[^/?]+)?(?:\?.*)?$/, async route => {
        const action = new URL(route.request().url()).pathname.split('/')[3];
        if (action) requests.push([action, route.request().postDataJSON()]);
        if (action === 'ready') view.team.members[0].ready = true;
        if (action === 'start') {
          view.team.state = 'flying';
          view.claims = [{ teamId: id(21), share: { alloy: 150, crystal: 60, deuterium: 3 }, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }];
        }
        if (action === 'claim') { view.claims = []; view.receipt = { deposit: { alloy: 100, crystal: 60, deuterium: 3 }, overflow: { alloy: 50, crystal: 0, deuterium: 0 } }; }
        await route.fulfill({ json: view });
      });
      await page.goto(`${web}/v2-gallery.html?view=arena-team&lng=${lng}`);
      const panel = page.locator('[data-part="arena-team"]'); await panel.getByText('Yıldırım', { exact: false }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${out}/lobby-${lng}-${width}.png` });
      await page.getByRole('button', { name: lng === 'tr' ? 'Hazırım' : 'Ready', exact: true }).click();
      await page.getByRole('button', { name: lng === 'tr' ? 'Birlikte kalk' : 'Launch together' }).click();
      await page.getByRole('button', { name: lng === 'tr' ? 'Payımı al' : 'Claim my share' }).click();
      await page.getByText(lng === 'tr' ? 'Başkente yatırılan' : 'Deposited at capital', { exact: true }).waitFor();
      await page.screenshot({ path: `${out}/claim-${lng}-${width}.png` });
      assert.deepEqual(requests.map(r => r[0]), ['ready', 'start', 'claim']);
      assert.deepEqual(requests[0][1], { teamId: id(20), ready: true, tactic: 'radar' });
      const overflow = await panel.evaluate(node => node.scrollWidth > node.clientWidth + 1); assert.equal(overflow, false);
      proof.push({ lng, width, requests, overflow }); await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 350, height: 812 }, locale: 'tr' });
    const page = inspectedPage = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { localStorage.setItem('i18nextLng', 'tr'); Object.defineProperty(navigator, 'deviceMemory', { value: 2 }); });
    const view = team(); view.team.members = view.team.members.slice(0, 2); view.team.members.forEach(m => { m.ready = true; });
    await page.route(/\/arena\/team(?:\/[^/?]+)?(?:\?.*)?$/, async route => {
      if (route.request().url().endsWith('/start')) view.team.state = 'flying';
      await route.fulfill({ json: view });
    });
    const now = Date.now();
    await page.route('**/arena/hangar', route => route.fulfill({ json: {
      core: 9, minCore: 9, ship: { class: 'kilavuz', level: 3, fuel: 250, ammo: 480, hold: [0, 0, 0], changeUntil: null,
        readyAt: null, readyReason: null, flying: true, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
      refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: zero, sent: zero,
      resetsAt: new Date(now + 86400000).toISOString(), entryClosesAt: new Date(now + 864000000).toISOString(),
    } }));
    let socket = null; let frames = null; let timer = null; let watching = false;
    await page.routeWebSocket('**/arena/ws', ws => {
      socket = ws;
      ws.onMessage(raw => {
        const msg = JSON.parse(String(raw));
        if (msg.kind !== 'hello') return;
        ws.send(JSON.stringify(frames.welcome));
        let tick = 0;
        timer = feedTimer = setInterval(() => {
          ws.send(JSON.stringify({ ...frames[watching ? 'dead' : 'live'], tick: ++tick * 2, ack: 0 }));
        }, 67);
      });
    });
    await page.goto(`${web}/?arena=sandbox&hangar&mode=online`);
    await page.getByRole('button', { name: 'Birlikte kalk' }).waitFor({ timeout: 90000 });
    frames = await page.evaluate(async modulePath => {
      const r = await import(modulePath);
      const { world } = window.__arena;
      const self = r.createPilot(4, 'kilavuz', 'radar', 3); self.clanId = '00000000-0000-4000-8000-000000000010';
      self.p = { x: 0, y: 500, z: 0 }; self.shield = 0;
      const ally = r.createPilot(5, 'muhafiz', 'smoke', 3); ally.clanId = self.clanId; ally.p = { x: 20, y: 500, z: 280 };
      const snap = { kind: 'snap', tick: 2, ack: 0, self: r.packPilot(self), others: [r.packRemote(ally)], mid: [], far: [], scan: [], ...r.keyFeed(world) };
      self.phase = 'dead'; self.hull = 0;
      return { live: snap, dead: { ...snap, self: r.packPilot(self), watching: 5 }, welcome: { kind: 'welcome', v: r.ARENA_PROTOCOL,
        pilotId: 4, teamId: '00000000-0000-4000-8000-000000000020', tick: 0, seq: 0, tickRate: 30, snapshotRate: 15, layoutVersion: r.ARENA_LAYOUT.version,
        pilots: [4, 5].map(n => ({ id: n, name: n === 4 ? 'Yıldırım' : 'Aylin', ship: n === 4 ? 'kilavuz' : 'muhafiz', level: 3,
          clanId: self.clanId, teamId: '00000000-0000-4000-8000-000000000020' })) } };
    }, `/@fs/${resolve('packages/rules/src/arena/index.ts')}`);
    await page.screenshot({ path: `${out}/preflight-tr-350.png` });
    await page.getByRole('button', { name: 'Birlikte kalk' }).click();
    // Markers are zero-size anchors; their label and brackets carry the visible pixels.
    await page.locator('.ah-enemy[data-friend] span').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.ah-enemy[data-friend][data-focus]').count(), 0, 'the gun sight must not track a clan friend');
    await page.screenshot({ path: `${out}/friend-tr-350.png` });
    const tap = await page.evaluate(() => {
      const { controls, client } = window.__arena;
      const node = document.querySelector('.ah-enemy[data-friend]'); const p = node.getBoundingClientRect();
      controls.actionDown('signature', 1, performance.now()); controls.actionUp('signature', 1, performance.now());
      return { x: p.x, y: p.y, friend: client.friendAt(p.x, p.y) };
    });
    assert.equal(tap.friend, 5); await page.mouse.click(tap.x, tap.y);
    const before = await page.evaluate(() => window.__arena.client.camera.position.toArray());
    watching = true;
    await page.locator('[data-screen="spectate"]').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Aylin/ }).waitFor(); await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__arena.client.camera.position.toArray());
    assert.ok(Math.hypot(...after.map((n, i) => n - before[i])) > 100, 'spectator camera follows teammate');
    await page.screenshot({ path: `${out}/spectator-tr-350.png` });
    await page.getByRole('button', { name: 'Sonuca dön' }).click(); await page.locator('[data-screen="result"]').waitFor();
    clearInterval(timer); socket?.close(); await context.close();
    assert.deepEqual(errors, []); proof.push({ tap, before, after, errors });
    await writeFile(`${out}/proof.json`, JSON.stringify(proof, null, 2));
    console.log(JSON.stringify({ teamVisual: proof }));
  } catch (error) {
    console.error(JSON.stringify({ errors, text: await inspectedPage?.locator('body').innerText().catch(() => '') }));
    await inspectedPage?.screenshot({ path: `${out}/failure.png` }).catch(() => undefined);
    throw error;
  } finally { clearInterval(feedTimer); await browser.close(); }
}
