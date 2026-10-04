/** Real live-season haze, camera-inside rendering and shared GPU resource checks. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyRadiationHaze(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5173';
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const measurements = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const login = await context.request.post(`${web}/api/auth/login`, { data: {
      username: process.env.VISUAL_COMMANDER ?? 'monument_local',
      password: process.env.VISUAL_PASSWORD ?? 'MonumentLocal2026!',
    } });
    if (!login.ok()) throw new Error(`Visual account login failed: HTTP ${login.status()}`);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text().slice(0, 400));
    });
    await page.goto(web, { waitUntil: 'domcontentloaded' });
    const ready = () => page.waitForFunction(() => {
      const galaxy = window.__galaxy;
      if (!galaxy?.controls || !galaxy.scene.getObjectByName('monument-model-4')) return false;
      let count = 0;
      galaxy.scene.traverse((object) => { if (object.name.startsWith('radiation-haze-')) count += 1; });
      return count === 5;
    }, undefined, { timeout: 60_000 });
    await ready();
    await page.waitForTimeout(2000);
    await page.mouse.move(650, 450);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 5000);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1200);

    for (const [name, offset, viewport, extreme] of [
      ['desktop-focusless', null, null, false],
      ['desktop-near', [2.8, 0.45, 0.7], null, false],
      ['desktop-inside', [0.4, 0.08, 0.15], null, false],
      ['desktop-boundary', [0.96, 0.1, 0.1], null, false],
      ['desktop-outside-boundary', [1.04, 0.1, 0.1], null, false],
      ['desktop-extreme', [2.8, 0.45, 0.7], null, true],
      ['mobile-near', [2.8, 0.45, 0.7], { width: 350, height: 812 }, false],
    ]) {
      if (viewport) await page.setViewportSize(viewport);
      await ready();
      const result = await page.evaluate(({ offset, extreme }) => {
        const galaxy = window.__galaxy;
        const { scene, camera, controls, gl } = galaxy;
        // Capture a settled real frame on software WebGL without continuous
        // galaxy rendering competing with the compositor's readback.
        galaxy.setFrameloop('never');
        controls.enableDamping = false;
        const clouds = [];
        scene.traverse((object) => { if (object.name.startsWith('radiation-haze-')) clouds.push(object); });
        if (offset) {
          const gate = scene.getObjectByName('monument-model-4');
          const centre = gate.getWorldPosition(camera.position.clone());
          clouds.sort((a, b) => a.position.distanceTo(centre) - b.position.distanceTo(centre));
          const cloud = clouds[0];
          controls.target.copy(cloud.position);
          camera.position.copy(cloud.position).add(camera.position.clone().set(...offset).multiplyScalar(cloud.scale.x));
          controls.update();
        }
        for (const cloud of clouds) cloud.material.uniforms.uAlpha.value = extreme ? 0.0675 : 0.024;
        for (let frame = 0; frame < 3; frame += 1) galaxy.advance(galaxy.clock.elapsedTime + 1 / 30);
        return {
          clouds: clouds.length,
          geometries: new Set(clouds.map((cloud) => cloud.geometry.uuid)).size,
          volumes: new Set(clouds.map((cloud) => cloud.material.uniforms.uDensity.value.uuid)).size,
          densityBytes: clouds[0].material.uniforms.uDensity.value.image.data.byteLength,
          radius: clouds[0].scale.x,
          alpha: clouds[0].material.uniforms.uAlpha.value,
          target: controls.target.toArray(),
          contextLost: gl.getContext().isContextLost(),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      }, { offset, extreme });
      await page.waitForTimeout(1000);
      const shaderLinked = await page.evaluate(() => {
        const renderer = window.__galaxy.gl;
        const context = renderer.getContext();
        const programs = renderer.info.programs.filter((program) => program.name === 'RadiationHaze');
        return programs.length > 0 && programs.every((program) => context.getProgramParameter(program.program, context.LINK_STATUS));
      });
      if (result.clouds !== 5 || result.geometries !== 1 || result.volumes !== 1 || result.densityBytes > 128 * 1024
        || result.radius !== 20 || result.alpha > 0.0675 || result.contextLost || result.overflow || !shaderLinked || errors.length > 0) {
        throw new Error(`${name}: ${JSON.stringify({ ...result, shaderLinked, errors })}`);
      }
      await page.screenshot({ path: join(output, `${name}.png`) });
      measurements.push({ name, ...result, shaderLinked });
      console.log(`PASS ${name}: 5 clouds · 1 density volume · 1 geometry · alpha ${result.alpha}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
}
