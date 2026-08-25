/**
 * VISUAL VERIFICATION HARNESS.
 *
 * `pnpm verify` proves the code compiles and the rules hold. It cannot tell you a
 * rock has stopped moving, a panel never opened, or a ship is flying sideways —
 * every one of which has shipped from this repo on a green typecheck. This drives
 * the real client against the real API, photographs it, and MEASURES the scene
 * through the `DevBridge` rather than guessing from the picture.
 *
 *   pnpm --filter @astera/server dev
 *   pnpm --filter @astera/web dev
 *   node tools/visual.mjs out/visual
 *
 * WebGL runs on SwiftShader here, so everything is given time to settle.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://localhost:5173';
const OUT = process.argv[2] ?? 'out/visual';
const PHONE = { width: 390, height: 844 };

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: PHONE,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 140)}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('401')) problems.push(`console: ${t.slice(0, 140)}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  · ${name}.png`);
};
const settle = (ms) => page.waitForTimeout(ms);
/**
 * Close anything modal. One of the focus taps may have opened your own world.
 *
 * Matches BOTH handles a sheet can carry: the icon button with an aria-label, and
 * the worded CLOSE the planet surface uses. Only the first was checked, so a
 * planet panel opened by a stray tap sat over the galaxy and every later step
 * failed with "intercepts pointer events" — which reads as a broken control
 * rather than as an open sheet.
 */
const dismiss = async () => {
  for (let i = 0; i < 5; i += 1) {
    const button = page.getByRole('button', { name: /^close$/i }).first();
    if (!(await button.isVisible().catch(() => false))) return;
    await button.click({ force: true }).catch(() => undefined);
    await settle(700);
  }
};
const check = (label, ok, detail = '') =>
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);

console.log(`opening ${WEB}`);
await page.goto(WEB, { waitUntil: 'domcontentloaded' });

/**
 * GET A COMMANDER ONTO A PLANET.
 *
 * This used to be one click on "Take a planet", back when that was a guest door.
 * D21 made it a form and D22/D23 put a loading screen in front of it, and this
 * harness silently stopped working at the first of those — it sat waiting for a
 * canvas that was never going to appear behind a login it did not know about, and
 * reported a timeout that looked like a broken scene.
 *
 * A fresh commander every run is also the right subject: it is the state a real
 * first session is in, and it needs no fixture in the database.
 */
const COMMANDER = `visual${String(Date.now()).slice(-8)}`;
const PASSWORD = 'correct-horse-battery';

/**
 * THE FRONT DOOR MOVED, AND THIS HARNESS SAT WAITING AT THE OLD ONE. D68.
 *
 * "Take a planet" is no longer a control on the landing page; it is the HEADING of
 * the register form, and the form is reached through one of the two doors D56/D68
 * put there — the rehearsal ("Check your planet") or sign-in ("I already have a
 * commander"). This harness clicked a button that had not existed for two
 * decisions and reported a forty-second timeout that read like a broken scene.
 *
 * The sign-in door is the one taken here, then switched to register: it is two
 * clicks and it does not enter the ninety-second onboarding rehearsal, which is
 * its own flow with its own harness (`tools/onboarding.mjs`).
 */
// The front door waits for its own sky (D23), so the buttons are not there at once.
const signInDoor = page.getByRole('button', { name: /already have a commander/i }).first();
const commanderField = page.getByLabel(/commander name/i);
for (let attempt = 0; attempt < 3 && !(await commanderField.isVisible().catch(() => false)); attempt += 1) {
  await signInDoor.waitFor({ timeout: 40_000 });
  // Vite may optimise a dependency and reload the first page opened after a code
  // change. Do not let Playwright wait on that dev-only navigation forever; if it
  // resets the front door, this loop simply walks through it again.
  await signInDoor.click({ noWaitAfter: true });
  const registerDoor = page.getByRole('button', { name: /i need a commander/i }).first();
  await registerDoor.waitFor({ timeout: 20_000 });
  await registerDoor.click({ noWaitAfter: true });
  await page.waitForTimeout(1500);
}
await commanderField.waitFor({ timeout: 20_000 });
await commanderField.fill(COMMANDER);
await page.getByLabel(/password/i).fill(PASSWORD);
await page.getByRole('button', { name: /create commander/i }).click();

// Then a galaxy from the server list. Only the frontier one offers a control at
// all, so the first Join/Enter on the page is the one open door.
const open = page.getByRole('button', { name: /^(join|enter)$/i }).first();
await open.waitFor({ timeout: 30_000 });
await open.click();
await page.waitForSelector('canvas', { timeout: 40_000 });
// The models arrive over the network and decode on the CPU; surveying before
// they land measures an empty scene.
await page.waitForFunction(
  () => {
    const g = window.__galaxy;
    if (!g) return false;
    let n = 0;
    g.scene.traverse((o) => { if (o.isInstancedMesh) n += 1; });
    return n > 0;
  },
  undefined,
  { timeout: 45_000 },
);
await settle(3000);
await shot('01-galaxy');

/**
 * Everything the scene knows about itself, read through the dev bridge.
 * `kinds` counts what is on screen; `rocks` and `craft` carry world positions and
 * their projection to CSS pixels, so a tap can be aimed at a real object.
 */
const survey = () =>
  page.evaluate(() => {
    const g = window.__galaxy;
    if (!g) return null;
    const { scene, camera, gl } = g;
    const rect = gl.domElement.getBoundingClientRect();
    /** World point → CSS pixel. The canvas is not the viewport; use its own box. */
    const toScreen = (p) => {
      const world = camera.position.clone().set(p[0], p[1], p[2]);
      const inFront = world
        .clone()
        .sub(camera.position)
        .dot(camera.getWorldDirection(camera.position.clone())) > 0;
      const v = world.project(camera);
      return {
        screen: [
          rect.left + ((v.x + 1) / 2) * rect.width,
          rect.top + ((1 - v.y) / 2) * rect.height,
        ],
        visible: inFront && v.z >= -1 && v.z <= 1,
      };
    };

    const kinds = [];
    const rocks = [];
    const planets = [];
    const craft = [];

    scene.traverse((o) => {
      if (o.isInstancedMesh && o.count > 0) {
        kinds.push(`${o.name || 'unnamed'}×${String(o.count)}`);
        const into = o.name === 'asteroid-rocks' ? rocks : o.name === 'planet-worlds' ? planets : null;
        if (into) {
          for (let i = 0; i < o.count; i += 1) {
            // Instance matrices are LOCAL to the mesh. Planet batches sit below
            // transformed groups, so reading their translation directly aims the
            // harness at empty space even though the world is plainly visible.
            const instance = o.matrixWorld.clone();
            o.getMatrixAt(i, instance);
            const world = o.matrixWorld.clone().multiply(instance);
            into.push([world.elements[12], world.elements[13], world.elements[14]]);
          }
        }
      }
      // A hull's forward axis, so "flying sideways" is measurable.
      if (o.userData?.craft) {
        const f = camera.position.clone().set(0, 0, 1).applyQuaternion(o.getWorldQuaternion(o.quaternion.clone()));
        craft.push({ name: o.name, forward: [f.x, f.y, f.z] });
      }
    });

    const pack = (list) => list
      .map((world) => ({ world, ...toScreen(world) }))
      .filter(({ visible }) => visible)
      .map(({ world, screen }) => ({ world, screen }));
    return {
      kinds,
      rocks: pack(rocks),
      planets: pack(planets),
      craft,
      viewport: [rect.left, rect.top, rect.width, rect.height],
    };
  });

const before = await survey();
if (!before) {
  console.log('  FAIL  dev bridge missing — window.__galaxy is undefined');
  await browser.close();
  process.exit(1);
}
console.log(`instanced: ${before.kinds.join(', ') || '(none)'}`);

/* ── 1 · do the rocks actually move? ─────────────────────────── */
const WAIT = 12;
await settle(WAIT * 1000);
const after = await survey();
await shot('02-galaxy-later');

if (before.rocks.length && before.rocks.length === after.rocks.length) {
  const world = before.rocks.map((r, i) =>
    Math.hypot(...r.world.map((n, k) => n - after.rocks[i].world[k])),
  );
  const px = before.rocks.map((r, i) =>
    Math.hypot(...r.screen.map((n, k) => n - after.rocks[i].screen[k])),
  );
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    `rock drift over ${WAIT}s: median ${median(world).toFixed(3)} world units, ` +
      `${median(px).toFixed(1)} CSS px  [${px.map((n) => n.toFixed(0)).join(' ')}]`,
  );
  // Under ~2px in twelve seconds is what a player calls "frozen".
  check('asteroids visibly move', median(px) >= 2, `${median(px).toFixed(1)}px / ${WAIT}s`);
} else {
  console.log(`  SKIP  asteroids visibly move — ${before.rocks.length} → ${after.rocks.length} rocks in this field window`);
}

/* ── 1b · a focused moving object stays camera-locked ─────────
   A state test can prove the rig CHOOSES `track`; only the live scene can prove
   OrbitControls and the frame loop continue applying the same delta. Pick a rock
   away from worlds, let the initial ease finish, then compare the rock, target and
   camera translations over the same interval. All three must be the same vector. */
{
  const clearRock = after.rocks
    .map((rock, index) => ({ rock, index }))
    .filter(({ rock }) => {
      const [x, y] = rock.screen;
      if (!(x > 30 && x < PHONE.width - 30 && y > 320 && y < PHONE.height - 160)) return false;
      return after.planets.every((planet) => Math.hypot(
        rock.screen[0] - planet.screen[0],
        rock.screen[1] - planet.screen[1],
      // Enough clearance to stop a planet stealing the raycast, while still
      // producing a subject on dense procedural seeds.
      ) > 55);
    })[0];

  if (!clearRock) {
    console.log('  SKIP  focused asteroid remains camera-locked — no isolated rock in frame');
  } else {
    await page.mouse.click(clearRock.rock.screen[0], clearRock.rock.screen[1]);
    await settle(1400);
    const rail = page.locator('[data-focus-rail]').first();
    const railOpen = await rail.count() > 0;
    const railLabel = railOpen ? await rail.getAttribute('aria-label') : null;
    const asteroidFocused = /(asteroid|rock)/i.test(railLabel ?? '');
    // Reframe it by hand while it is selected. This is the regression: the old
    // `onStart` changed follow → manual, so the rock escaped immediately after an
    // orbit/zoom even though its focus rail stayed open.
    await page.mouse.move(PHONE.width * 0.52, PHONE.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(PHONE.width * 0.58, PHONE.height * 0.48, { steps: 5 });
    await page.mouse.up();
    // OrbitControls intentionally keeps damping after pointer-up. Measure the
    // follow once that requested orbit has settled, not while the camera is still
    // completing the player's gesture.
    await settle(1800);
    const start = await survey();
    const startRig = await page.evaluate(() => ({
      camera: window.__galaxy.camera.position.toArray(),
      target: window.__galaxy.controls.target.toArray(),
    }));
    await settle(2600);
    const end = await survey();
    const endRig = await page.evaluate(() => ({
      camera: window.__galaxy.camera.position.toArray(),
      target: window.__galaxy.controls.target.toArray(),
    }));
    const delta = (a, b) => a.map((n, i) => b[i] - n);
    const residual = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
    const rockDelta = delta(start.rocks[clearRock.index].world, end.rocks[clearRock.index].world);
    const targetDelta = delta(startRig.target, endRig.target);
    const cameraDelta = delta(startRig.camera, endRig.camera);
    const targetError = residual(rockDelta, targetDelta);
    const cameraError = residual(rockDelta, cameraDelta);
    check(
      'focused asteroid remains camera-locked',
      railOpen && asteroidFocused
        && Math.hypot(...rockDelta) > 0.02 && targetError < 0.06 && cameraError < 0.06,
      `${railLabel ?? 'no focus'} · target error ${targetError.toFixed(3)} · camera error ${cameraError.toFixed(3)}`,
    );
  }
}

/* ── 2 · focus opens, every time, and opens CLOSED ─────────────
   Re-surveyed before every tap: focusing eases the camera onto the subject, so a
   screen position measured before the previous tap is pointing at empty space by
   the time this one lands. That is the harness's problem, not the game's — but it
   is also exactly how a real thumb misses, so aim at what is on screen NOW. */
// The permanent resource/Works header occupies the first ~300px in portrait.
// A projected world behind it is visible to the scene but not tappable by the
// player; aiming there tests DOM interception rather than galaxy focus.
const inFrame = ([x, y]) => x > 24 && x < PHONE.width - 24 && y > 320 && y < PHONE.height - 150;

let taps = 0;
let opened = 0;
let selfTaps = 0;
let twoTapChecked = false;
let twoTapOpened = false;
const misses = [];
for (let round = 0; round < 6; round += 1) {
  await dismiss();
  const clearFocus = page.getByRole('button', { name: /clear selection/i });
  if (await clearFocus.isVisible().catch(() => false)) {
    await clearFocus.click();
    await settle(400);
  }
  const now = await survey();
  const pool = [
    ...now.planets.map((subject) => ({ kind: 'planet', subject })),
    ...now.rocks.map((subject) => ({ kind: 'rock', subject })),
  ].filter(({ subject }) => inFrame(subject.screen));
  if (pool.length === 0) break;
  const target = pool[Math.floor((round / 6) * pool.length)];

  await page.mouse.click(target.subject.screen[0], target.subject.screen[1]);
  await settle(1800);
  const rail = page.locator('[data-focus-rail]');
  const hit = await rail.count();
  if (hit > 0) {
    taps += 1;
    opened += 1;
    // It must open COLLAPSED — the owner's rule, so panning between worlds still
    // shows the galaxy rather than a wall of panel.
    const expanded = await rail.getByRole('button', { expanded: true }).count();
    if (round === 0) console.log(`    panel opens ${expanded > 0 ? 'EXPANDED' : 'collapsed'}`);
    if (!twoTapChecked) {
      // The camera has moved since the first tap, so project the same world-space
      // subject again before tapping it. Nearest is stable for planets and for a
      // rock over this short interval, while tapping the old pixel would test air.
      const reframed = await survey();
      const candidates = target.kind === 'planet' ? reframed.planets : reframed.rocks;
      const same = candidates.reduce((nearest, candidate) => {
        const distance = Math.hypot(...candidate.world.map(
          (n, i) => n - target.subject.world[i],
        ));
        return !nearest || distance < nearest.distance ? { candidate, distance } : nearest;
      }, null);
      if (same && inFrame(same.candidate.screen)) {
        await page.mouse.click(same.candidate.screen[0], same.candidate.screen[1]);
        await settle(700);
        twoTapOpened = await rail.getByRole('button', { expanded: true }).count() > 0;
        twoTapChecked = true;
        await page.getByRole('button', { name: /clear selection/i }).click();
        await settle(500);
      }
    }
  } else if (await page.getByRole('button', { name: /^close$/i }).first().isVisible().catch(() => false)) {
    // Tapping your own world deliberately opens the planet sheet, not a foreign
    // focus rail. It shares an instanced batch with the other worlds, so the
    // visual survey cannot identify it until after the tap.
    selfTaps += 1;
  } else {
    taps += 1;
    misses.push(target.subject.screen.map((n) => Math.round(n)).join(','));
  }
}
check(
  'first tap creates a collapsed focus rail',
  taps > 0 && opened === taps,
  `${String(opened)}/${String(taps)}${selfTaps ? ` · ${String(selfTaps)} self-world sheet` : ''}${misses.length ? ` · missed at ${misses.join(' ')}` : ''}`,
);
check('second tap on the same object opens detail', twoTapChecked && twoTapOpened);
await shot('03-focus');

/* ── 3 · home works while something is focused ───────────────── */
// The last sampled instance may be the commander's own world, which opens the
// management sheet by design. Close it before testing the map-level Home control.
await dismiss();
const camBefore = await page.evaluate(() => window.__galaxy.camera.position.toArray());
await page.getByRole('button', { name: /centre on (your planet|active world)/i }).click();
await settle(3000);
const camAfter = await page.evaluate(() => window.__galaxy.camera.position.toArray());
const homeTarget = await page.evaluate(() => window.__galaxy.controls?.target?.toArray() ?? null);
const flew = Math.hypot(...camBefore.map((n, i) => n - camAfter[i]));
check('home button moves the camera', flew > 0.5, `moved ${flew.toFixed(2)} units`);
/**
 * MOVING IS NOT ENOUGH. Multi-world Home once passed the check above while
 * centring empty space: the target came from a stale private planet payload and
 * the bodies came from the live galaxy payload. Resolve the selected id against
 * the same public list and prove both the target and the readable framing.
 */
/**
 * The selector only exists once there is a second world to pick, so a fresh
 * commander has no `<select>` on the header at all. Read it when it is there and
 * fall back to the planet payload — which is the same answer either way, and the
 * only answer available on the state a first session is actually in.
 */
const worldSelect = page.locator('select[aria-label="Active world"], select[aria-label="Aktif gezegen"]');
const loginResponse = await fetch(`${WEB}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: COMMANDER, password: PASSWORD }),
});
if (!loginResponse.ok) throw new Error(`Harness login failed: ${String(loginResponse.status)}`);
const session = await loginResponse.json();
const authorization = { authorization: `Bearer ${session.accessToken}` };
const [planetResponse, galaxyResponse] = await Promise.all([
  fetch(`${WEB}/api/planet`, { headers: authorization }),
  fetch(`${WEB}/api/galaxy`, { headers: authorization }),
]);
if (!planetResponse.ok || !galaxyResponse.ok) {
  throw new Error(
    `Harness world reads failed: planet ${String(planetResponse.status)}, `
      + `galaxy ${String(galaxyResponse.status)}`,
  );
}
const planetView = await planetResponse.json();
const galaxyView = await galaxyResponse.json();
const activeWorldId = (await worldSelect.count())
  ? await worldSelect.inputValue()
  : planetView.planet.id;
const activeWorld = galaxyView.planets?.find((planet) => planet.id === activeWorldId);
const expectedHome = activeWorld
  ? [
      activeWorld.position.x / 50,
      (activeWorld.position.y * 3.5) / 50,
      activeWorld.position.z / 50,
    ]
  : null;
const homeRange = await page.evaluate(() => {
  const g = window.__galaxy;
  return g.controls?.object.position.distanceTo(g.controls.target) ?? null;
});
const homeError = expectedHome && homeTarget
  ? Math.hypot(...expectedHome.map((n, i) => n - homeTarget[i]))
  : Infinity;
check('home targets the active rendered world', homeError < 0.05, `error ${homeError.toFixed(3)}`);
check('home frames the world at a readable distance', homeRange !== null && homeRange <= 7.1, `${homeRange?.toFixed(2) ?? 'n/a'} units`);
await settle(2000);
await shot('04-home');
console.log('  camera target after home:', homeTarget?.map((n) => n.toFixed(1)).join(', ') ?? 'n/a');

/* ── 4 · the planet screen and its new "affordable in" line ───
   There is no Planet tab — the galaxy IS the shell (D20), and your own world is
   opened by tapping it. Home has just centred the camera on it, so the pivot is
   the point to aim at. */
const homeScreen = await page.evaluate(() => {
  const g = window.__galaxy;
  const rect = g.gl.domElement.getBoundingClientRect();
  const v = g.controls.target.clone().project(g.camera);
  return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
});
await page.mouse.click(homeScreen[0], homeScreen[1]);
await settle(2500);
await shot('05-planet');

const when = await page.getByText(/affordable in/i).count();
const saving = await page.getByText(/saving for/i).count();
check('the old "Saving for X" bar is gone', saving === 0, `${String(saving)} left`);

/**
 * SPEND THE GRANT FIRST, or this measures nothing.
 *
 * D22 hands a new commander exactly enough for the opening, which means they can
 * afford every first level on the board — and "affordable in" only appears on a
 * row that is short. The check used to pass because a fresh planet was poor; it
 * now has to make one poor before it can ask the question.
 */
{
  const grow = page.getByRole('tab', { name: /^production$/i }).first();
  if (await grow.isVisible().catch(() => false)) await grow.click({ force: true });
  await settle(900);
  // The Command Core is the one row nothing else caps, so raising it repeatedly
  // is the fastest honest way to become poor.
  const core = page.locator('#row-CORE');
  for (let i = 0; i < 6; i += 1) {
    if (!(await core.count())) break;
    await core.scrollIntoViewIfNeeded();
    const openItem = core.locator('[data-open-item]');
    if (!(await openItem.isVisible().catch(() => false))) break;
    await openItem.click({ force: true });
    await settle(500);
    const act = page.locator('[data-item-sheet] [data-act] button').first();
    if (!(await act.isEnabled().catch(() => false))) {
      await dismiss();
      break;
    }
    await act.click({ force: true });
    await settle(1200);
  }
}

// A brand-new commander can afford everything, so the line only appears once the
// grant has gone. Walk the tabs.
let anyWhen = when;
for (const tab of ['PRODUCTION', 'INTEL', 'DEFEND', 'FLEET']) {
  const button = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') }).first();
  if (!(await button.isVisible().catch(() => false))) continue;
  // Forced, and tolerated: a detail sheet opened by a stray row tap sits over the
  // tab strip, and a harness that dies there reports a broken control rather than
  // an open sheet.
  await button.click({ force: true }).catch(() => undefined);
  await settle(1400).catch(() => undefined);
  if (page.isClosed()) break;
  const n = await page.getByText(/affordable in/i).count();
  const s2 = await page.getByText(/saving for/i).count();
  console.log(`  ${tab}: ${String(n)} "affordable in", ${String(s2)} old bars`);
  anyWhen += n;
  await shot(`06-planet-${tab.toLowerCase()}`);
  if (tab === 'FLEET') {
    const strategic = page.locator('[data-strategic-state]').first();
    if (await strategic.isVisible().catch(() => false)) {
      await strategic.scrollIntoViewIfNeeded();
      await settle(700);
      await shot('06-strategic-foundry');
    }
  }
  if (n > 0) {
    // Photograph the line itself, not the tab it happens to be on.
    const line = page.getByText(/affordable in/i).first();
    await line.scrollIntoViewIfNeeded();
    await settle(700);
    await shot(`07-affordable-${tab.toLowerCase()}`);
    console.log('    line reads:', (await line.innerText()).replace(/\s+/g, ' '));
  }
}
check('unaffordable rows say when', anyWhen > 0, `${String(anyWhen)} across the tabs`);

/* ── 6 · the works fill on their own ──────────────────────────
   The planet query deliberately has no poll, so the vessels are projected from
   the clock. If that projection is wrong the panel sits at zero for ever and the
   Collect button never enables — which is exactly what shipped. */
await dismiss();
const worksAria = () =>
  page
    .locator('button[aria-label^="Collect"], button[aria-label*="full" i]')
    .first()
    .getAttribute('aria-label')
    .catch(() => null);

const first = await worksAria();
await settle(25_000);
const second = await worksAria();
const num = (s) => Number(/(\d[\d,]*)/.exec(s ?? '')?.[1]?.replace(/,/g, '') ?? '0');
check(
  'the works fill without a refetch',
  num(second) > num(first),
  `${String(first)} → ${String(second)}`,
);
await shot('08-works');

console.log(problems.length ? `\nRUNTIME NOISE:\n  ${problems.slice(0, 8).join('\n  ')}` : '\nno runtime errors');
await browser.close();
console.log('done →', OUT);
