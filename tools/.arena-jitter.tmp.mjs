import { chromium } from 'playwright';
const jitter = Number(process.argv[2] ?? 0); const stall = Number(process.env.STALL ?? 0); const snapOff = process.argv[3] === 'snap';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan'] });
const page = await browser.newPage({ viewport: { width: 350, height: 812 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
await page.addInitScript(([jitter, stall]) => {
  localStorage.setItem('astera.language', 'tr');
  if (!jitter) return;
  // In-order delivery with random extra delay both ways, like Wi-Fi under load.
  const base = jitter / 3;
  let stallUntil = 0; setInterval(() => { if (stall) stallUntil = performance.now() + stall * (0.6 + Math.random() * 0.8); }, 1500);
  const delay = () => Math.max(base + Math.random() * jitter, stallUntil - performance.now());
  const Native = window.WebSocket;
  // One ordered queue per direction, drained by a single timer: TCP never reorders.
  const pipe = deliver => { const q = []; let last = 0; let timer = null;
    const drain = () => { timer = null; const now = performance.now(); while (q.length && q[0].at <= now) deliver(q.shift().data); if (q.length) timer = setTimeout(drain, q[0].at - now); };
    return data => { last = Math.max(last, performance.now() + delay()); q.push({ at: last, data }); if (!timer) timer = setTimeout(drain, q[0].at - performance.now()); };
  };
  window.WebSocket = class extends Native {
    constructor(...a) { super(...a);
      const send = super.send.bind(this);
      const out = pipe(data => { if (this.readyState === 1) send(data); });
      this.send = data => { if (String(data).startsWith('{"kind":"in"')) window.__sent = (window.__sent ?? 0) + 1; out(data); };
      const inbound = pipe(data => { const copy = new MessageEvent('message', { data }); copy.__delayed = true; this._om?.(copy); });
      this.addEventListener('message', event => { if (event.__delayed) return; event.stopImmediatePropagation(); inbound(event.data); });
    }
    set onmessage(fn) { this._om = fn; } get onmessage() { return this._om; }
  };
}, [jitter, stall]);
await page.goto('http://localhost:5198/?arena=sandbox&mode=online');
await page.waitForSelector('[data-screen="preflight"]', { timeout: 180000 });
await page.click('.ap-launch');
await page.waitForFunction(() => window.__arena?.network?.connected, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__arena.controls.setThrottle(1));
await page.waitForTimeout(2500);
await page.keyboard.down('KeyD');
const s0 = await page.evaluate(() => [window.__sent, performance.now()]);
await page.waitForTimeout(3000);
const s1 = await page.evaluate(() => [window.__sent, performance.now()]);
console.log('inputs/s', ((s1[0] - s0[0]) / (s1[1] - s0[1]) * 1000).toFixed(2));
const r = await page.evaluate(snapOff => new Promise(done => {
  const a = window.__arena; const cam = a.client.camera; const c = a.network.correction;
  const out = []; let lastMag = 0; let events = 0; let peakDeg = 0; let peakM = 0;
  const q = new cam.quaternion.constructor(); const prevQ = new cam.quaternion.constructor(); let first = true; let lastT = 0;
  const tick = t => {
    const mag = Math.hypot(c.x, c.y, c.z); const deg = 2 * Math.acos(Math.min(1, Math.abs(c.q.w))) * 57.3;
    if (mag > lastMag + 0.05 || deg > 0.3 && mag >= lastMag) { events++; peakM = Math.max(peakM, mag); peakDeg = Math.max(peakDeg, deg); }
    lastMag = mag;
    if (snapOff) { c.x = 0; c.y = 0; c.z = 0; c.q.identity(); }
    q.copy(cam.quaternion);
    if (!first) out.push([prevQ.angleTo(q) * 57.3 / Math.max(0.001, (t - lastT) / 1000), t]);
    prevQ.copy(q); first = false; lastT = t;
    if (out.length < 360) requestAnimationFrame(tick); else done({ out, events, peakM, peakDeg });
  };
  requestAnimationFrame(tick);
}), snapOff);
await page.keyboard.up('KeyD');
const diffs = await page.evaluate(() => window.__arena.network.debugDiffs.slice(-90));
console.log(diffs.filter(d => d[3] > 0.01).slice(0, 25).map(d => d.map(v => +v.toFixed(2)).join(' ')).join('\n'), '\nof', diffs.length);
const rates = r.out.map(x => x[0]);
const jerk = rates.slice(1).map((v, i) => Math.abs(v - rates[i]));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sorted = [...jerk].sort((a, b) => a - b);
console.log(`stall ${stall} jitter ${jitter}ms ${snapOff ? 'SNAP' : 'SMOOTH'} · turn ${mean(rates).toFixed(1)}°/s · Δrate mean ${mean(jerk).toFixed(2)} p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(2)} max ${sorted.at(-1).toFixed(1)} °/s · corrections ${r.events} peak ${r.peakM.toFixed(2)} m ${r.peakDeg.toFixed(2)}°`);
await browser.close();
