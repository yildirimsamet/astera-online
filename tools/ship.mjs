/**
 * Photograph a craft in flight, close up, from every side.
 *
 * A ship is a centimetre across at the framing the galaxy actually uses, which is
 * no use at all for judging whether it is pointed the right way or whether its
 * exhaust survives being looked at from above. This flies the camera to the craft
 * and takes the three shots that answer those questions.
 *
 *   node tools/ship.mjs /path/to/output
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '.';
const APP = process.env.BLINDSPACE_APP ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 2 });
page.on('pageerror', (error) => console.log('PAGE EXCEPTION:', error.message));

await page.goto(APP, { waitUntil: 'load' });
await page.getByRole('button', { name: /take a planet/i }).click();
await page.waitForTimeout(3500);
await page.getByRole('button', { name: /continue/i }).click({ timeout: 2500 }).catch(() => undefined);
await page.waitForTimeout(1500);

const report = await page.evaluate(async () => {
  const api = window.__api;
  const galaxy = await api.galaxy();
  const me = galaxy.planets.find((p) => p.isSelf);
  const others = galaxy.planets.filter((p) => !p.isSelf);
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const far = others.sort((a, b) => gap(me.position, b.position) - gap(me.position, a.position))[0];
  await api.probe(far.id);
  return far.name;
});
console.log('probing', report);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.getByRole('button', { name: /continue/i }).click({ timeout: 2500 }).catch(() => undefined);
await page.waitForTimeout(4000);

// Angles chosen for what each one proves: the side shows the silhouette and the
// plume's length, the top shows whether the plume exists at all off-axis, and the
// tail shows the nozzle.
const ANGLES = {
  side: [1.1, 0.25, 0],
  top: [0.15, 1.2, 0.15],
  tail: [0, 0.3, -1.2],
};

for (const [name, offset] of Object.entries(ANGLES)) {
  const found = await page.evaluate(
    ([offset]) => {
      const state = window.__galaxy;
      if (!state) return 'no galaxy handle';
      state.setFrameloop?.('always');
      let target = null;
      state.scene.traverse((o) => {
        if (o.name === 'flight') target = o;
      });
      if (!target) return 'no craft in flight';
      // Read the position straight out of the world matrix, so the page does not
      // need a THREE handle it would otherwise only expose for this.
      target.updateWorldMatrix(true, false);
      const m = target.matrixWorld.elements;
      const at = { x: m[12], y: m[13], z: m[14] };
      state.camera.position.set(at.x + offset[0], at.y + offset[1], at.z + offset[2]);
      state.camera.lookAt(at.x, at.y, at.z);
      state.camera.updateProjectionMatrix();
      state.camera.updateMatrixWorld();
      state.invalidate();

      /**
       * Where the craft THINKS it is going, in pixels.
       *
       * A screenshot cannot tell you whether a hull is pointed forwards or
       * backwards — both look like a ship. Projecting the heading into screen
       * space turns that into something a picture can answer: the nose should be
       * on this side of the ship.
       */
      const e = target.matrixWorld.elements;
      // Third column of the world matrix is the group's own +Z: the heading.
      const ahead = { x: at.x + e[8] * 0.4, y: at.y + e[9] * 0.4, z: at.z + e[10] * 0.4 };
      const project = (p) => {
        const v = { ...p };
        const m = state.camera.matrixWorldInverse.elements;
        const pm = state.camera.projectionMatrix.elements;
        const apply = (mat, q) => {
          const w = mat[3] * q.x + mat[7] * q.y + mat[11] * q.z + mat[15];
          return {
            x: (mat[0] * q.x + mat[4] * q.y + mat[8] * q.z + mat[12]) / w,
            y: (mat[1] * q.x + mat[5] * q.y + mat[9] * q.z + mat[13]) / w,
            z: (mat[2] * q.x + mat[6] * q.y + mat[10] * q.z + mat[14]) / w,
          };
        };
        const c = apply(pm, apply(m, v));
        const size = state.size;
        return {
          x: Math.round(((c.x + 1) / 2) * size.width),
          y: Math.round(((1 - c.y) / 2) * size.height),
        };
      };
      return { craft: project(at), nose: project(ahead) };
    },
    [offset],
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ship-${name}.png` });
  console.log(name, found);
}

await browser.close();
