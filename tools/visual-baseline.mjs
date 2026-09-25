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
const STRESS_MODE = process.env.STRESS ?? '';
const SAMPLE_MS = Number(process.env.SAMPLE_MS ?? 5_000);
const STRESS_MODES = new Set(['', 'formations', 'late-season']);
if (!STRESS_MODES.has(STRESS_MODE)) {
  throw new Error(`Unknown STRESS mode: ${STRESS_MODE}`);
}

const STRESS_SKINS = ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert'];
const FORMATION_CONTACTS = 1;

/** Installs a development-only transformer for the Academy's in-memory API. */
function installStressAcademyFixture({ mode, skins, formationContacts }) {
  const fallbackHome = { x: 180, y: 0, z: 0 };
  window.__asteraAcademyVisualFixture = (path, payload) => {
    if (mode === 'formations' && path === '/api/galaxy/traffic') {
      const now = Date.now();
      return {
        ...payload,
        contacts: Array.from({ length: formationContacts }, (_, index) => ({
          id: `stress-heavy-${String(index)}`,
          kind: 'fleet',
          mass: 'HEAVY',
          from: {
            x: fallbackHome.x - 420 + index * 120,
            y: fallbackHome.y - 260 + index * 130,
            z: fallbackHome.z - 900 - index * 120,
          },
          to: {
            x: fallbackHome.x + 420 - index * 80,
            y: fallbackHome.y + 260 - index * 110,
            z: fallbackHome.z - 1_100 - index * 120,
          },
          startAt: new Date(now - 10 * 60_000).toISOString(),
          endAt: new Date(now + 10 * 60_000).toISOString(),
        })),
      };
    }
    if (mode === 'late-season' && path === '/api/galaxy') {
      const home = payload.planets.find((planet) => planet.isSelf)?.position ?? fallbackHome;
      const depths = [1_000, 4_500, 14_000];
      const spreads = [250, 1_100, 3_500];
      const stressPlanets = Array.from({ length: 30 }, (_, index) => {
        const band = Math.floor(index / 10);
        const angle = (index % 10) / 10 * Math.PI * 2 + band * 0.19;
        const dyson = index % 5 < 2;
        return {
          id: `stress-world-${String(index)}`,
          name: `Stress ${String(index + 1)}`,
          owner: 'Performance fixture',
          kind: 'CAPITAL',
          controller: {
            kind: 'PLAYER',
            playerId: `stress-player-${String(index)}`,
            displayName: 'Performance fixture',
          },
          position: {
            x: home.x + Math.cos(angle) * spreads[band],
            y: home.y + Math.sin(angle) * spreads[band],
            z: home.z - depths[band],
          },
          intel: 'RESOLVED',
          coreTier: dyson ? 8 : 4,
          coreLevel: dyson ? 22 : 11,
          satellites: [],
          shielded: false,
          isSelf: false,
          isOwned: true,
          isCapital: true,
          state: { kind: 'NORMAL' },
          skin: {
            id: skins[index % skins.length],
            status: index % 7 === 0 ? 'RECOVERY_SHIELD' : 'NORMAL',
          },
        };
      });
      return { ...payload, planets: [...payload.planets, ...stressPlanets] };
    }
    return payload;
  };
}

/**
 * Chromium's compositor screenshot can stall behind a busy SwiftShader process.
 * Draw the production scene once and read its own framebuffer in the same task;
 * this keeps visual evidence without asking the desktop compositor for pixels.
 */
async function captureGalaxyCanvas(page, path) {
  const dataUrl = await page.evaluate(() => {
    const galaxy = window.__galaxy;
    if (!galaxy) throw new Error('Galaxy debug bridge is unavailable');
    const { gl, scene, camera } = galaxy;
    const previousTarget = gl.getRenderTarget();
    gl.setRenderTarget(null);
    gl.render(scene, camera);
    const png = gl.domElement.toDataURL('image/png');
    gl.setRenderTarget(previousTarget);
    galaxy.invalidate();
    return png;
  });
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('Galaxy canvas did not produce PNG data');
  await writeFile(path, Buffer.from(dataUrl.slice(prefix.length), 'base64'));
}

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
  try {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor,
    isMobile: scenario.mobile,
    hasTouch: scenario.mobile,
    locale: 'en-US',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
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

  if (STRESS_MODE) await page.addInitScript(
    installStressAcademyFixture,
    { mode: STRESS_MODE, skins: STRESS_SKINS, formationContacts: FORMATION_CONTACTS },
  );

  const startedAt = Date.now();
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  const beatCard = page.locator('[data-beat-card]').first();
  for (let attempt = 0; attempt < 3 && !(await beatCard.isVisible().catch(() => false)); attempt += 1) {
    const door = page.getByRole('button', {
      name: /check your planet|gezegenini incele/i,
    }).first();
    await door.waitFor({ timeout: 40_000 });
    await door.click({ noWaitAfter: true });
    try {
      await beatCard.waitFor({ timeout: 20_000 });
    } catch (error) {
      if (attempt === 2) throw error;
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
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

  let stressHomeFocused = false;
  if (STRESS_MODE) {
    await captureGalaxyCanvas(page, `${OUT}/${scenario.name}-galaxy-wide.png`);
    const showHome = page.getByRole('button', { name: /^(show me my world|gezegenimi göster)$/i });
    if (await showHome.isVisible().catch(() => false)) {
      await showHome.click();
      await page.waitForTimeout(2200);
      stressHomeFocused = true;
      await captureGalaxyCanvas(page, `${OUT}/${scenario.name}-galaxy-home.png`);
    }
  }

  /**
   * Five seconds of deliberately continuous rendering. The production scene is
   * demand-driven, so an idle tab's frame intervals describe the ambient ticker
   * rather than rendering capacity. This drives the existing development bridge
   * at requestAnimationFrame cadence and records both its p95 and peak JS heap.
   */
  const performanceSample = await page.evaluate(async (sampleMs) => {
    const bridge = window.__galaxyMetrics;
    const galaxy = window.__galaxy;
    if (!bridge || !galaxy) return null;
    bridge.reset();
    let peakHeapUsedBytes = 0;
    const started = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const memory = performance.memory;
        if (memory) peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.usedJSHeapSize);
        galaxy.invalidate();
        if (performance.now() - started >= sampleMs) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    return { ...bridge.snapshot(), peakHeapUsedBytes };
  }, SAMPLE_MS);

  const widePath = `${OUT}/${scenario.name}-galaxy-wide.png`;
  if (!STRESS_MODE) await captureGalaxyCanvas(page, widePath);

  const metrics = await page.evaluate(() => {
    const galaxy = window.__galaxy;
    if (!galaxy) throw new Error('Galaxy debug bridge is unavailable');
    const { gl, scene, camera } = galaxy;
    // EffectComposer resets renderer.info for each internal pass, so reading it
    // after bloom reports only the final fullscreen triangle. Draw the scene once
    // directly, after the screenshot, to measure the galaxy itself.
    gl.setRenderTarget(null);
    gl.info.reset();
    let clearDepthCalls = 0;
    const clearDepth = gl.clearDepth;
    gl.clearDepth = function measuredClearDepth() {
      clearDepthCalls += 1;
      return clearDepth.call(this);
    };
    try {
      gl.render(scene, camera);
    } finally {
      gl.clearDepth = clearDepth;
    }
    let objects = 0;
    let meshes = 0;
    let sprites = 0;
    let points = 0;
    let instancedMeshes = 0;
    let instances = 0;
    const namedInstances = {};
    scene.traverse((object) => {
      if (!object.visible) return;
      objects += 1;
      if (object.isMesh) meshes += 1;
      if (object.isSprite) sprites += 1;
      if (object.isPoints) points += 1;
      if (object.isInstancedMesh) {
        instancedMeshes += 1;
        instances += object.count;
        const name = object.name || 'unnamed';
        const bucket = namedInstances[name] ?? { meshes: 0, instances: 0 };
        bucket.meshes += 1;
        bucket.instances += object.count;
        namedInstances[name] = bucket;
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
      scene: {
        objects,
        meshes,
        sprites,
        points,
        instancedMeshes,
        instances,
        namedInstances,
        clearDepthCalls,
      },
      capabilities: {
        webgl2: gl.capabilities.isWebGL2,
        maxTextureSize: gl.capabilities.maxTextureSize,
        maxSamples: gl.capabilities.maxSamples,
        renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      },
    };
  });

  const showHome = page.getByRole('button', { name: /^(show me my world|gezegenimi göster)$/i });
  if (!stressHomeFocused && await showHome.isVisible().catch(() => false)) {
    await showHome.click();
    await page.waitForTimeout(2200);
    await captureGalaxyCanvas(page, `${OUT}/${scenario.name}-galaxy-home.png`);
  }

  // Interaction must remain at native resolution. Dropping DPR on touch made the
  // ship silhouette and thin trails visibly blur until the debounce recovered.
  // Sample the gesture itself so that regression cannot return unnoticed.
  const canvasBox = await page.locator('canvas').boundingBox();
  let interactionDpr = null;
  if (canvasBox) {
    const before = await page.evaluate(() => ({
      dpr: window.__galaxy?.gl.getPixelRatio(),
    }));
    const x = canvasBox.x + canvasBox.width * 0.72;
    const y = canvasBox.y + canvasBox.height * 0.38;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(16);
    const during = await page.evaluate(() => ({
      dpr: window.__galaxy?.gl.getPixelRatio(),
    }));
    await captureGalaxyCanvas(page, `${OUT}/${scenario.name}-galaxy-interaction.png`);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(250);
    const recovered = await page.evaluate(() => ({
      dpr: window.__galaxy?.gl.getPixelRatio(),
    }));
    interactionDpr = { before, during, recovered };
    if (during.dpr !== before.dpr || recovered.dpr !== before.dpr) failed = true;
  }

  const allowed = new Set(['GET /api/preview', 'GET /api/servers', 'POST /api/auth/refresh']);
  const unexpectedCalls = calls.filter((call) => !allowed.has(call));
  if (errors.length > 0 || unexpectedCalls.length > 0) failed = true;
  results.push({
    scenario: scenario.name,
    stressMode: STRESS_MODE || null,
    viewport: scenario.viewport,
    readyMs: Date.now() - startedAt,
      metrics,
      performanceSample,
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
  } finally {
    await browser.close().catch(() => undefined);
  }
}

await writeFile(`${OUT}/metrics.json`, `${JSON.stringify({
  capturedAt: new Date().toISOString(),
  stressMode: STRESS_MODE || null,
  results,
}, null, 2)}\n`);

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
