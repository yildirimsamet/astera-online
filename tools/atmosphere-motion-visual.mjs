/** Real convoy and first-frame loading cover; browser-only fixtures, no gameplay writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

export async function verifyAtmosphereMotion(output) {
  await mkdir(output, { recursive: true });
  const web = process.env.WEB ?? 'http://localhost:5176';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const records = [];
  const errors = [];
  try {
    const boot = await browser.newPage({ viewport: { width: 350, height: 812 }, isMobile: true, hasTouch: true });
    // Leave the server's actual first HTML visible while its application bundle waits.
    await boot.route('**/src/main.tsx*', route => route.abort());
    await boot.goto(web, { waitUntil: 'domcontentloaded' });
    const initial = await boot.locator('#brand-boot').evaluate(node => {
      const pinch = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true });
      node.dispatchEvent(pinch);
      const keyboard = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true, bubbles: true });
      node.dispatchEvent(keyboard);
      return { touch: getComputedStyle(node).touchAction, pinchBlocked: pinch.defaultPrevented, keyboardBlocked: keyboard.defaultPrevented, scale: visualViewport.scale };
    });
    assert.equal(initial.touch, 'none');
    assert(initial.pinchBlocked && initial.keyboardBlocked);
    const cdp = await boot.context().newCDPSession(boot);
    await cdp.send('Input.synthesizePinchGesture', { x: 175, y: 350, scaleFactor: 2, relativeSpeed: 400, gestureSourceType: 'touch' });
    const after = await boot.evaluate(() => visualViewport.scale);
    assert.equal(after, initial.scale, 'the first loading frame accepted page pinch zoom');
    await boot.screenshot({ path: join(output, 'loading-boot-350.png') });
    records.push({ name: 'loading-boot', ...initial, after });
    await boot.close();

    for (const width of [350, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${web}/robots.txt`);
      await page.evaluate(async () => {
        const refresh = await import('/@react-refresh');
        refresh.default.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => undefined;
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const { Canvas, useThree, useFrame } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
        const { EffectComposer, Bloom } = await import('/node_modules/.vite/deps/@react-three_postprocessing.js');
        const { IntergalacticConvoy, CONVOY_FOCUS_DISTANCE } = await import('/src/galaxy/IntergalacticConvoy.tsx');
        const { serverNow } = await import('/src/lib/clock.ts');
        const { LoadingScreen } = await import('/src/shell/LoadingScreen.tsx');
        const { lockViewportZoom } = await import('/src/lib/viewport.ts');
        await import('/src/styles.css');
        lockViewportZoom();
        const e = React.createElement;
        const now = serverNow();
        const seasonStart = new Date(now - 60 * 60_000);
        const event = { id: 'visual-convoy', kind: 'INTERGALACTIC_CONVOY', startsAt: seasonStart, endsAt: new Date(now + 60 * 60_000),
          appearsAtMinute: 0, expiresAtMinute: 120, route: { from: { x: 0, y: 0, z: -1000 }, to: { x: 0, y: 0, z: 1000 }, velocity: { x: 0, y: 0, z: 1000 / 60 }, speed: 1000 / 60 }, visual: { formationVersion: 1 } };
        document.body.innerHTML = '<div id="root" style="width:100vw;height:100vh"></div>';
        const root = createRoot(document.getElementById('root'));
        function Review() {
          const { camera, scene, gl } = useThree();
          React.useLayoutEffect(() => {
            const length = CONVOY_FOCUS_DISTANCE;
            gl.info.autoReset = false;
            camera.position.set(0, length * 0.85, -length * 0.527);
            camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
            window.convoySnapshot = () => {
              const convoy = scene.getObjectByName('intergalactic-convoy');
              const jets = scene.getObjectByName('intergalactic-convoy-drives');
              const wind = scene.getObjectByName('intergalactic-convoy-wind');
              let spheres = 0;
              convoy?.traverse(node => { if (node.geometry?.type === 'SphereGeometry') spheres++; });
              return { hulls: convoy?.children.filter(node => node.getObjectByName('craft-hull')).length,
                spheres, engines: jets?.count, windInstances: wind?.geometry.instanceCount,
                windOpacity: wind?.material.uniforms.uOpacity.value, windWidth: wind?.material.uniforms.uWidth.value,
                windSpan: wind?.material.uniforms.uFront.value - wind?.material.uniforms.uBack.value,
                drawCalls: window.convoyRender?.calls, triangles: window.convoyRender?.triangles };
            };
          }, [camera, scene, gl]);
          useFrame(({ clock }) => {
            window.convoyClock = clock.elapsedTime;
            window.convoyRender = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
            gl.info.reset();
          });
          return e(IntergalacticConvoy, { event, seasonStart, focused: true });
        }
        window.showConvoyLoading = visible => root.render(e(React.Fragment, null,
          e(Canvas, { camera: { position: [0, 10, -6], fov: 45, near: 0.01, far: 500 }, gl: { antialias: true }, dpr: 1 },
            e('color', { attach: 'background', args: ['#03070d'] }), e('ambientLight', { intensity: 1.2 }),
            e('directionalLight', { position: [2, 8, -5], intensity: 3 }),
            e(React.Suspense, { fallback: null }, e(Review)),
            e(EffectComposer, { multisampling: 0, enableNormalPass: false }, e(Bloom, { intensity: 0.62, luminanceThreshold: 0.78, mipmapBlur: true }))),
          visible && e(LoadingScreen, { caption: 'Loading convoy', immediateExit: true })));
        window.showConvoyLoading(true);
      });
      await page.locator('[data-loading-screen]').waitFor();
      const reactLoading = await page.locator('[data-loading-screen]').evaluate(node => {
        const wheel = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true }); node.dispatchEvent(wheel);
        const keyboard = new KeyboardEvent('keydown', { key: '-', metaKey: true, cancelable: true, bubbles: true }); node.dispatchEvent(keyboard);
        return { touch: getComputedStyle(node).touchAction, pinchBlocked: wheel.defaultPrevented, keyboardBlocked: keyboard.defaultPrevented };
      });
      assert.equal(reactLoading.touch, 'none'); assert(reactLoading.pinchBlocked && reactLoading.keyboardBlocked);
      await page.evaluate(() => window.showConvoyLoading(false));
      await page.waitForFunction(() => window.convoySnapshot?.().hulls === 22 && window.convoySnapshot?.().engines > 0, null, { timeout: 120_000 });
      await page.waitForTimeout(500);
      const snapshot = await page.evaluate(() => window.convoySnapshot());
      assert.equal(snapshot.spheres, 0); assert.equal(snapshot.windInstances, 12);
      assert(snapshot.windOpacity <= 0.21); assert(snapshot.windWidth / snapshot.windSpan <= 0.0013);
      await page.screenshot({ path: join(output, `convoy-${width}.png`) });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(output, `convoy-${width}-motion.png`) });
      const settled = await page.evaluate(() => {
        const keyboard = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true }); window.dispatchEvent(keyboard);
        return { pageZoomReleased: !keyboard.defaultPrevented, scale: visualViewport.scale };
      });
      assert(settled.pageZoomReleased);
      records.push({ name: 'convoy', width, reactLoading, snapshot, settled });
      await page.close();
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'review.json'), JSON.stringify({ records, errors }, null, 2));
  assert.equal(errors.length, 0, 'the convoy/loading scene reported a browser error');
  console.log(JSON.stringify(records, null, 2));
}
