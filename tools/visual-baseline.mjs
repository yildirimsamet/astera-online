/**
 * A repeatable visual baseline for the galaxy.
 *
 * This deliberately stops inside the write-free onboarding rehearsal. It renders
 * the production GalaxyCanvas with a real public payload, but it never creates an
 * account or consumes a seat. Both portrait and landscape captures are produced,
 * together with the renderer counters needed to catch an effect that quietly
 * multiplies draw calls or GPU memory.
 *
 *   WEB=http://localhost:5199 pnpm visual:baseline -- out/visual-premium/baseline
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://localhost:5199';
const OUT = process.argv.slice(2).find((argument) => argument !== '--') ?? 'out/visual-baseline';
const REDUCED_MOTION = process.env.REDUCED_MOTION === '1';
const ALL_SCENARIOS = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, mobile: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, mobile: false },
];
const SCENARIOS = process.env.SCENARIO
  ? ALL_SCENARIOS.filter((scenario) => scenario.name === process.env.SCENARIO)
  : process.env.INCLUDE_DESKTOP === '1'
    ? ALL_SCENARIOS
    : ALL_SCENARIOS.filter((scenario) => scenario.name === 'phone');

await mkdir(OUT, { recursive: true });

const results = [];
let failed = false;

for (const scenario of SCENARIOS) {
  console.log(`capturing ${scenario.name}…`);
  // A fresh browser also means a fresh WebGL process. SwiftShader can retain the
  // first context's allocations after its page closes, which made the second
  // viewport intermittently open with an empty scene in CI.
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor,
    isMobile: scenario.mobile,
    hasTouch: scenario.mobile,
    locale: 'en-US',
    colorScheme: 'dark',
    reducedMotion: REDUCED_MOTION ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  const calls = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('401')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) calls.push(`${request.method()} ${url.pathname}`);
  });

  const startedAt = Date.now();
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  const door = page.locator('button.enter').first();
  await door.waitFor({ timeout: 40_000 });
  const doorBox = await door.boundingBox();
  if (!doorBox) throw new Error('The galaxy entry control has no visible bounds');
  await page.mouse.click(doorBox.x + doorBox.width / 2, doorBox.y + doorBox.height / 2);
  await page.locator('[data-beat-card]').first().waitFor({ timeout: 40_000 });
  await page.waitForFunction(
    () => {
      const galaxy = window.__galaxy;
      if (!galaxy) return false;
      let instances = 0;
      galaxy.scene.traverse((object) => {
        if (object.isInstancedMesh) instances += object.count;
      });
      return instances > 0;
    },
    undefined,
    { timeout: 45_000 },
  );
  await page.waitForTimeout(3000);

  const widePath = `${OUT}/${scenario.name}-galaxy-wide.png`;
  await page.screenshot({ path: widePath });

  const metrics = await page.evaluate(() => {
    const galaxy = window.__galaxy;
    if (!galaxy) throw new Error('Galaxy debug bridge is unavailable');
    const { gl, scene, camera } = galaxy;
    // EffectComposer resets renderer.info for each internal pass, so reading it
    // after bloom reports only the final fullscreen triangle. Draw the scene once
    // directly, after the screenshot, to measure the galaxy itself.
    gl.setRenderTarget(null);
    gl.info.reset();
    gl.render(scene, camera);
    let objects = 0;
    let meshes = 0;
    let sprites = 0;
    let points = 0;
    let instancedMeshes = 0;
    let instances = 0;
    scene.traverse((object) => {
      if (!object.visible) return;
      objects += 1;
      if (object.isMesh) meshes += 1;
      if (object.isSprite) sprites += 1;
      if (object.isPoints) points += 1;
      if (object.isInstancedMesh) {
        instancedMeshes += 1;
        instances += object.count;
      }
    });
    const context = gl.getContext();
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    return {
      canvas: {
        cssWidth: gl.domElement.getBoundingClientRect().width,
        cssHeight: gl.domElement.getBoundingClientRect().height,
        bufferWidth: gl.domElement.width,
        bufferHeight: gl.domElement.height,
        pixelRatio: gl.getPixelRatio(),
      },
      render: {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        frame: gl.info.render.frame,
      },
      memory: { ...gl.info.memory },
      scene: { objects, meshes, sprites, points, instancedMeshes, instances },
      capabilities: {
        webgl2: gl.capabilities.isWebGL2,
        maxTextureSize: gl.capabilities.maxTextureSize,
        maxSamples: gl.capabilities.maxSamples,
        renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      },
    };
  });

  const showHome = page.getByRole('button', { name: /^(show me my world|gezegenimi göster)$/i });
  if (await showHome.isVisible().catch(() => false)) {
    await showHome.click();
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${scenario.name}-galaxy-home.png` });
  }

  // Interaction must remain at native resolution. Dropping DPR on touch made the
  // ship silhouette and thin trails visibly blur until the debounce recovered.
  // Sample the gesture itself so that regression cannot return unnoticed.
  const canvasBox = await page.locator('canvas').boundingBox();
  let interactionDpr = null;
  if (canvasBox) {
    const before = await page.evaluate(() => ({
      dpr: window.__galaxy?.get().gl.getPixelRatio(),
    }));
    const x = canvasBox.x + canvasBox.width * 0.72;
    const y = canvasBox.y + canvasBox.height * 0.38;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(16);
    const during = await page.evaluate(() => ({
      dpr: window.__galaxy?.get().gl.getPixelRatio(),
    }));
    await page.screenshot({ path: `${OUT}/${scenario.name}-galaxy-interaction.png` });
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(250);
    const recovered = await page.evaluate(() => ({
      dpr: window.__galaxy?.get().gl.getPixelRatio(),
    }));
    interactionDpr = { before, during, recovered };
    if (during.dpr !== before.dpr || recovered.dpr !== before.dpr) failed = true;
  }

  const allowed = new Set(['GET /api/preview', 'GET /api/servers', 'POST /api/auth/refresh']);
  const unexpectedCalls = calls.filter((call) => !allowed.has(call));
  if (errors.length > 0 || unexpectedCalls.length > 0) failed = true;
  results.push({
    scenario: scenario.name,
    reducedMotion: REDUCED_MOTION,
    viewport: scenario.viewport,
    readyMs: Date.now() - startedAt,
    metrics,
    interactionDpr,
    errors,
    unexpectedCalls,
    screenshots: {
      wide: `${scenario.name}-galaxy-wide.png`,
      home: `${scenario.name}-galaxy-home.png`,
      interaction: `${scenario.name}-galaxy-interaction.png`,
    },
  });
  await context.close();
  await browser.close();
}

await writeFile(`${OUT}/metrics.json`, `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`);

for (const result of results) {
  const { render, memory } = result.metrics;
  console.log(
    `${result.scenario}: ${render.calls} calls · ${render.triangles} triangles · ` +
      `${memory.textures} textures · ${result.readyMs}ms ready`,
  );
  for (const error of result.errors) console.log(`  ERROR ${error}`);
  for (const call of result.unexpectedCalls) console.log(`  WRITE ${call}`);
}

process.exitCode = failed ? 1 : 0;
