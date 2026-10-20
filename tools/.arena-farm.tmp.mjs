import { chromium } from 'playwright';
const out = process.argv[2]; const only = process.argv[3];
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 300)));
await page.addInitScript(() => localStorage.setItem('astera.language', 'tr'));
await page.goto('http://localhost:5199/?arena=sandbox');
await page.waitForSelector('[data-screen="preflight"]', { timeout: 180000 });
await page.screenshot({ path: `${out}/00-preflight.png` });
await page.click('.ap-launch');
await page.waitForTimeout(800);
const fps = () => page.evaluate(() => { const m = window.__arena.client.metrics; return `fps ${m.fps.toFixed(0)} calls ${m.calls} tris ${m.triangles}`; });
const shot = async (name, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name, await fps()); };
await page.evaluate(() => {
  window.__place = (pilot, p, target, previous) => {
    const dx = target.x - p.x, dy = target.y - p.y, dz = target.z - p.z; const l = Math.hypot(dx, dy, dz);
    const fx = dx / l, fy = dy / l, fz = dz / l;
    const yaw = Math.atan2(fx, fz), pitch = -Math.asin(fy);
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    Object.assign(pilot.p, p); pilot.q.x = cy * sp; pilot.q.y = sy * cp; pilot.q.z = -sy * sp; pilot.q.w = cy * cp;
    pilot.landed = 0; pilot.liftoff = 0; pilot.omegaYaw = 0; pilot.omegaPitch = 0; pilot.s = 0;
    if (previous) { Object.assign(previous.p, pilot.p); Object.assign(previous.q, pilot.q); }
  };
});
const run = name => !only || only.split(',').includes(name);
if (run('cruise')) { await shot('10-cruise', 2500); }
if (run('field')) {
  for (const [name, pick] of [['20-cluster', 'many'], ['21-single', 'one']]) {
    const ok = await page.evaluate(pick => {
      const a = window.__arena; const w = a.world;
      const live = w.cargoDrops.filter(d => d.field && d.amount > 0);
      const groups = new Map(); live.forEach((d, i) => { const g = Math.floor(w.cargoDrops.indexOf(d) / 4); groups.set(g, [...(groups.get(g) ?? []), d]); });
      const entry = [...groups.values()].find(g => pick === 'many' ? g.length >= 3 : g.length === 1);
      if (!entry) return false;
      const c = entry[0].p;
      window.__place(w.pilot, { x: c.x - 25, y: c.y + 12, z: c.z - 70 }, c, w.previous); a.controls.setThrottle(0);
      return true;
    }, pick);
    if (ok) await shot(name, 1200); else console.log(name, 'no group');
  }
}
if (run('close')) {
  for (const [name, kind] of [['25-close-alloy', 0], ['26-close-crystal', 1], ['27-close-deut', 2]]) {
    const ok = await page.evaluate(kind => {
      const a = window.__arena; const w = a.world;
      const d = w.cargoDrops.find(d => d.field && d.active && d.amount > 0 && d.kind === kind) ?? w.cargoDrops.find(d => d.field && d.active);
      if (!d) return false; if (d.kind !== kind) { d.kind = kind; }
      window.__place(w.pilot, { x: d.p.x - 6, y: d.p.y + 6, z: d.p.z - 32 }, d.p, w.previous); a.controls.setThrottle(0); return true;
    }, kind);
    if (ok) await shot(name, 900);
  }
}
if (run('mine')) {
  for (const [name, kind] of [['30-alloy', 0], ['31-crystal', 1], ['32-deut', 2]]) {
    await page.evaluate(kind => {
      const a = window.__arena; const w = a.world; const L = w.layout;
      const slot = L.depositKinds.findIndex(k => k === kind);
      const c = L.obstacles[L.deposits[slot]];
      window.__place(w.pilot, { x: c.p.x, y: c.p.y + c.radius + 60, z: c.p.z - c.radius - 120 }, c.p, w.previous); a.controls.setThrottle(0);
    }, kind);
    await shot(name, 1200);
  }
  await page.evaluate(() => {
    const a = window.__arena; const w = a.world; const L = w.layout; const c = L.obstacles[L.deposits[L.depositKinds.indexOf(0)]];
    window.__place(w.pilot, { x: c.p.x, y: c.p.y + c.radius + 30, z: c.p.z - 40 }, c.p, w.previous);
    a.controls.setThrottle(0.12); w.pilot.s = 14;
  });
  await page.waitForFunction(() => window.__arena.world.pilot.landed > 0, null, { timeout: 30000 }).catch(() => console.log('no landing'));
  await shot('33-mining', 2500);
}
if (run('combat')) {
  await page.evaluate(() => {
    const a = window.__arena; const w = a.world; const hunter = w.drones[0];
    w.pilot.shield = 0; w.pilot.liftoff = 0; w.pilot.landed = 0;
    window.__place(w.pilot, { x: 600, y: 0, z: 1600 }, { x: 600, y: 0, z: 1900 }, w.previous);
    window.__place(hunter, { x: 612, y: 8, z: 1800 }, { x: 900, y: 8, z: 1800 }, w.dronePrevious[0]);
    hunter.hold = [12, 8, 4]; hunter.shield = 0; hunter.hull = 4; a.controls.setThrottle(0.1);
  });
  await page.keyboard.down('Space'); await shot('40-firing', 500); await page.keyboard.up('Space');
  await shot('41-burst', 400); await shot('42-scatter', 1500);
}
if (run('shield')) {
  await page.evaluate(() => { const a = window.__arena; const w = a.world; window.__place(w.pilot, { x: 0, y: 40, z: -900 }, { x: 0, y: 0, z: 0 }, w.previous); a.controls.setThrottle(0); });
  await shot('50-shield-on', 1200);
  await page.evaluate(() => { window.__arena.world.pilot.shield = 0; });
  await shot('51-shield-off', 600);
}
if (run('fps')) {
  await page.evaluate(() => { const a = window.__arena; const w = a.world; window.__place(w.pilot, { x: 0, y: 40, z: -900 }, { x: 0, y: 0, z: 0 }, w.previous); a.controls.setThrottle(0.6); });
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(1000); console.log('fly', await fps()); }
}
console.log(logs.slice(0, 8).join('\n'));
await browser.close();
