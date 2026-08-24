#!/usr/bin/env node
/**
 * Browser-side capacity probe for the 351-world D99 staging galaxy.
 *
 * Start the web client with continuous visual instrumentation:
 *   VITE_VISUAL_TEST=1 ASTERA_API=http://127.0.0.1:3380 pnpm --filter @astera/web dev
 * Then:
 *   CAPACITY_PASSWORD=... node tools/capacity-client.mjs --duration-seconds 60
 *
 * This is a repeatable desktop/mobile-emulation diagnostic. The plan's real
 * Android acceptance remains a real-device profile and is never inferred here.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === '--') cliArgs.shift();
const { values } = parseArgs({
  args: cliArgs,
  options: {
    web: { type: 'string', default: 'http://127.0.0.1:5173' },
    username: { type: 'string', default: 'cap0001' },
    worlds: { type: 'string', default: '351' },
    'duration-seconds': { type: 'string', default: '60' },
    report: { type: 'string' },
    screenshot: { type: 'string' },
    headed: { type: 'boolean', default: false },
  },
});

const integer = (name, raw, min, max) => {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} must be ${String(min)}..${String(max)}`);
  }
  return parsed;
};
const expectedWorlds = integer('worlds', values.worlds, 1, 1000);
const durationSeconds = integer('duration-seconds', values['duration-seconds'], 10, 3600);
const password = process.env.CAPACITY_PASSWORD;
if (!password || password.length < 8 || password.length > 200) {
  throw new Error('CAPACITY_PASSWORD must contain 8–200 characters.');
}
const web = new URL(values.web);
if (!['127.0.0.1', 'localhost', '::1'].includes(web.hostname)) {
  throw new Error('The browser capacity probe only runs against a loopback web client.');
}

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const reportPath = resolve(values.report ?? `artifacts/capacity/${stamp}-client.json`);
const screenshotPath = resolve(values.screenshot ?? `artifacts/capacity/${stamp}-client.png`);
await mkdir(dirname(reportPath), { recursive: true });
await mkdir(dirname(screenshotPath), { recursive: true });

const browser = await chromium.launch({
  headless: values.headed !== true,
  args: ['--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const errors = [];
const startupWarnings = [];
let gameRequestStarted = false;
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const target = gameRequestStarted ? errors : startupWarnings;
  target.push(`console: ${message.text()}`);
});

try {
  await page.goto(web.origin, { waitUntil: 'domcontentloaded' });
  const signInDoor = page.getByRole('button', { name: /already have a commander/i }).first();
  await signInDoor.waitFor({ timeout: 40_000 });
  await signInDoor.click();
  await page.getByLabel(/commander name/i).fill(values.username);
  await page.getByLabel(/password/i).fill(password);
  gameRequestStarted = true;
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await page.waitForSelector('canvas', { timeout: 45_000 });
  await page.waitForFunction(
    (wanted) => {
      const debug = window.__galaxy;
      const metrics = window.__galaxyMetrics;
      if (!debug || !metrics) return false;
      let worlds = 0;
      debug.scene.traverse((object) => {
        if (object.isInstancedMesh && object.name === 'planet-worlds') worlds += object.count;
      });
      return worlds === wanted && metrics.snapshot().frameIntervalMs.samples > 30;
    },
    expectedWorlds,
    { timeout: 90_000 },
  );

  // Shader compilation, model parsing and the login transition are cold-start
  // work, not steady galaxy rendering. Let them settle, then clear both bounded
  // windows so the acceptance sample cannot be failed by work that happened
  // before the measured interval began.
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.__galaxyMetrics.reset());

  const snapshots = [];
  const started = Date.now();
  while (Date.now() - started < durationSeconds * 1000) {
    snapshots.push(await page.evaluate(() => {
      let worlds = 0;
      window.__galaxy.scene.traverse((object) => {
        if (object.isInstancedMesh && object.name === 'planet-worlds') worlds += object.count;
      });
      return { at: new Date().toISOString(), worlds, ...window.__galaxyMetrics.snapshot() };
    }));
    await page.waitForTimeout(5000);
  }
  const final = snapshots.at(-1);
  const gpu = await page.evaluate(() => {
    const context = window.__galaxy?.gl?.getContext?.();
    if (!context) return null;
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: String(context.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR)),
      renderer: String(context.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER)),
    };
  });
  await page.screenshot({ path: screenshotPath });

  const heapSamples = snapshots.map((sample) => sample.heap?.usedBytes).filter(Number.isFinite);
  const resourceSpan = snapshots.length < 2 ? null : {
    objects: final.scene.objects - snapshots[0].scene.objects,
    geometries: final.renderer.geometries - snapshots[0].renderer.geometries,
    textures: final.renderer.textures - snapshots[0].renderer.textures,
    heapBytes: heapSamples.length < 2 ? null : heapSamples.at(-1) - heapSamples[0],
  };
  const gates = {
    exactWorldCount: final.worlds === expectedWorlds,
    continuousInstrumentation: final.continuous === true,
    frameInterval: final.frameIntervalMs.p95 <= 33,
    noLongFreeze: final.longTaskMs.max <= 100,
    noBrowserErrors: errors.length === 0,
  };
  const report = {
    schemaVersion: 1,
    proof: 'desktop-mobile-emulation; real Android acceptance still required',
    browserMode: values.headed === true ? 'headed' : 'headless',
    gpu,
    web: web.origin,
    username: values.username,
    expectedWorlds,
    durationSeconds,
    gates,
    passed: Object.values(gates).every(Boolean),
    resourceSpan,
    errors,
    startupWarnings,
    final,
    snapshots,
    screenshot: screenshotPath,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ report: reportPath, passed: report.passed, gates }, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser.close();
}
