/**
 * THE REHEARSAL, DRIVEN END TO END. D56.
 *
 * `pnpm verify` proves the beats advance and the claim replays. It cannot tell you
 * that the beat card sits over the launch button, that the disc never drew the
 * reserved world, or that the planet panel opened on the wrong tab — and every one
 * of those is invisible to a green build and fatal to a first session.
 *
 * This walks a stranger through the whole thing on a phone-sized viewport, exactly
 * as one would: read the disc, tap your own world, learn the four-part loop, raise
 * three buildings, buy two Darts, inspect a neighbour, and sign the world. It photographs every
 * beat and MEASURES what the scene actually holds through `window.__galaxy`.
 *
 *   PORT=3210 DATABASE_URL=... pnpm --filter @astera/server dev
 *   ASTERA_API=http://localhost:3210 pnpm --filter @astera/web dev --port 5199
 *   node tools/onboarding.mjs out/onboarding
 *
 * WebGL runs on SwiftShader here, so everything is given time to settle.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const WEB = process.env.WEB ?? 'http://localhost:5199';
const OUT = process.argv[2] ?? 'out/onboarding';
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
page.on('pageerror', (e) => {
  const line = `page error: ${e.message.slice(0, 200)}`;
  console.log(`  !! ${line}`);
  problems.push(line);
});
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('401')) {
    console.log(`  !! console: ${t.slice(0, 200)}`);
    problems.push(`console: ${t.slice(0, 160)}`);
  }
});

/**
 * EVERY REQUEST THAT LEAVES THE PAGE IS RECORDED.
 *
 * The rehearsal's whole claim is that it takes no seat and writes nothing, so the
 * check that matters is not what the screen says — it is that nothing but
 * `/api/preview` ever reaches the server before the claim.
 */
const calls = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/')) calls.push(`${r.method()} ${u.pathname}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  · ${name}.png`);
};
const settle = (ms) => page.waitForTimeout(ms);
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) problems.push(`check failed: ${label}${detail ? ` (${detail})` : ''}`);
};


/**
 * PRESS SOMETHING THE WAY A FINGER DOES.
 *
 * `locator.click()` dispatches at an element's centre after its own actionability
 * checks, which is exactly the wrong instrument for testing a GATE: the whole
 * question is whether a real press at real coordinates reaches the thing, and a
 * helper that quietly scrolls, waits and then synthesises the event answers a
 * different one. This moves the cursor and presses it, so anything covering the
 * target — a sheet, a card, the gate's own refusal — is felt here as it would be
 * on a phone.
 */
const tap = async (locator, { timeout = 10_000 } = {}) => {
  await locator.waitFor({ timeout });
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await settle(150);
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to press');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (x < 0 || x > PHONE.width || y < 0 || y > PHONE.height) {
    throw new Error(`target is outside the phone viewport: ${JSON.stringify(box)}`);
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  await settle(40);
  await page.mouse.up();
};

/** The beat card's own heading, whatever language the browser asked for. */
const beatText = () => page.locator('[data-beat-card]').first().innerText();

console.log(`opening ${WEB}`);
await page.goto(WEB, { waitUntil: 'domcontentloaded' });

/* ── the front door ─────────────────────────────────────────── */

/**
 * The one hero control on the front door, found by what it IS rather than by what
 * it says. `.enter` is that control's own class and belongs to nothing else; a
 * regex on its wording ties this harness to a sentence somebody will reword.
 */
const door = page.locator('button.enter').first();
await door.waitFor({ timeout: 40_000 });
await shot('00-door');
await tap(door);

/**
 * WAIT FOR THE REHEARSAL, NOT FOR A CANVAS.
 *
 * The front door is a 3D scene too, so `waitForSelector('canvas')` was satisfied
 * by the page the harness had just pressed a button on — it went on to survey a
 * scene that was still the poster and reported an empty galaxy. The beat card only
 * exists once the rehearsal is mounted, so it is the honest signal.
 */
await page.locator('[data-beat-card]').first().waitFor({ timeout: 40_000 });
await page.waitForSelector('canvas', { timeout: 40_000 });
await page.waitForFunction(
  () => {
    const g = window.__galaxy;
    if (!g) return false;
    let n = 0;
    g.scene.traverse((o) => {
      if (o.isInstancedMesh) n += 1;
    });
    return n > 0;
  },
  { timeout: 45_000 },
);
await settle(2500);
await shot('01-galaxy');

console.log('\nthe rehearsal took nothing');
/**
 * `POST /api/auth/refresh` is the cold start asking the cookie whether there is a
 * session to come back to, and it happens before the front door is even drawn.
 * Everything else on this list would be the rehearsal writing to the server.
 */
const ALLOWED = new Set(['GET /api/preview', 'GET /api/servers', 'POST /api/auth/refresh']);
check(
  'only the public preview was called',
  calls.every((c) => ALLOWED.has(c)),
  calls.filter((c) => !ALLOWED.has(c)).join(', ') || 'clean',
);

/**
 * Everything the scene knows about itself, with world points projected to CSS
 * pixels so a tap can be aimed at a real object rather than at a guess.
 */
const survey = () =>
  page.evaluate(() => {
    const g = window.__galaxy;
    if (!g) return null;
    const { scene, camera, gl } = g;
    const rect = gl.domElement.getBoundingClientRect();
    const toScreen = (p) => {
      const v = camera.position.clone().set(p[0], p[1], p[2]).project(camera);
      return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
    };
    const kinds = [];
    const planets = [];
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.count > 0) {
        kinds.push(`${o.name || 'unnamed'}×${String(o.count)}`);
        if (o.name === 'planet-worlds') {
          const a = o.instanceMatrix.array;
          for (let i = 0; i < o.count; i += 1) {
            const p = [a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]];
            planets.push({ world: p, screen: toScreen(p) });
          }
        }
      }
    });
    return { kinds, planets };
  });

const scene = await survey();
check('the disc drew worlds', (scene?.planets.length ?? 0) > 1, `${scene?.kinds.join(' ')}`);

/**
 * Where a world's game coordinates land on the screen, right now.
 *
 * PROJECTED FRESH EVERY TIME, and that is not defensive coding: focusing a world
 * FLIES THE CAMERA TO IT, so any pixel measured before a tap is wrong after it.
 * The first version of this measured once and then clicked six stale points in
 * empty space, which reads exactly like a beat that will not advance.
 *
 * The shared view contract currently scales every axis by fifty. This used to
 * duplicate a 3.5× vertical exaggeration that has since been removed; using the
 * old projection makes a real reserved world look like empty space to the harness.
 */
const aim = (p) =>
  page.evaluate(
    ({ x, y, z }) => {
      const g = window.__galaxy;
      if (!g) return null;
      const rect = g.gl.domElement.getBoundingClientRect();
      const v = g.camera.position.clone().set(x / 50, y / 50, z / 50).project(g.camera);
      return [
        rect.left + ((v.x + 1) / 2) * rect.width,
        rect.top + ((1 - v.y) / 2) * rect.height,
        v.z,
      ];
    },
    p,
  );

/** The public payload the rehearsal itself is standing on, so the taps have names. */
const preview = await fetch(`${WEB}/api/preview`).then((r) => r.json());

/**
 * Everybody else, NEAREST FIRST.
 *
 * Once the camera has flown in, most of the disc is off screen — and the payload's
 * own order is the database's, not the player's. Walking it unsorted meant twenty
 * misses before a hit, which reads as a beat that will not advance rather than as
 * a harness looking in the wrong place.
 */
const near = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const others = preview.galaxy.planets
  .filter((p) => !p.isSelf)
  .sort(
    (a, b) =>
      near(a.position, preview.reserved.position) - near(b.position, preview.reserved.position),
  );

const tapWorld = async (position) => {
  const spot = await aim(position);
  if (!spot || spot[2] > 1) return false;
  const [x, y] = spot;
  if (x < 8 || y < 90 || x > PHONE.width - 8 || y > PHONE.height - 240) return false;
  await page.mouse.click(x, y);
  await settle(900);
  return true;
};


/* ── beat 1: look at it, then ask for your world ────────────── */

const first = await beatText();
console.log(`\nbeat 1: ${first.split('\n').slice(0, 2).join(' / ')}`);
/**
 * THE GATE, TESTED BEFORE IT IS TRUSTED.
 *
 * The opening beat has one live control. Tapping a world must do nothing at all —
 * if it selected one, the beat that comes next would be asking the player to find
 * something they have already got, and the rail would be open over the disc.
 */
await tapWorld(preview.galaxy.planets.find((p) => !p.isSelf)?.position ?? { x: 0, y: 0, z: 0 });
check(
  'the wide beat refuses a tap on a world',
  (await beatText()) === first &&
    !(await page.locator('text=/no intel|istihbarat yok/i').first().isVisible().catch(() => false)),
);

await tap(page.getByRole('button', { name: /^(show me my world|gezegenimi göster)$/i }).first());
await settle(1800);
await shot('02-find-your-world');

/* ── beats 2 and 3: find your world, then learn the loop ────── */

const reached = await tapWorld(preview.reserved.position);
const afterOwn = await beatText();
check(
  'tapping the reserved world advanced the beat',
  reached && /the game has four steps|oyunun dört adımı var/i.test(afterOwn),
  afterOwn.split('\n')[1] ?? '',
);
await shot('03-briefing');

await tap(
  page.getByRole('button', { name: /^(take the first step|ilk adımı yap)$/i }).first(),
);
await settle(1000);
await shot('04-core');

/* ── beats 4-6: inspect, understand, then raise three systems ─ */

const raise = async (id, index) => {
  const before = await beatText();
  await tap(page.locator(`#row-${id} [data-open-item]`).first());
  await settle(700);
  await shot(`05${index}-${id.toLowerCase()}-sheet`);
  await tap(page.locator('[data-item-sheet] [data-act] button').first());
  await settle(1200);
  const after = await page.locator('[data-beat-card]').first().innerText({ timeout: 5000 });
  check(`${id} advanced its teaching beat`, after !== before, after.split('\n')[1] ?? '');
};

for (const [index, id] of ['CORE', 'REFINERY', 'EXTRACTOR'].entries()) {
  try {
    await raise(id, index + 1);
    console.log(`  raised ${id}`);
  } catch (err) {
    problems.push(`could not raise ${id}: ${String(err).slice(0, 120)}`);
  }
}
await shot('06-after-upgrades');
const afterUpgrades = await beatText();
check(
  'the three upgrades reached the fleet beat',
  /now make two ships|şimdi iki gemi yap/i.test(afterUpgrades),
  afterUpgrades.split('\n')[1] ?? '',
);

/* ── beat 7: inspect and build the two Darts ─────────────────── */

await tap(page.locator('#row-DART [data-open-item]').first());
await settle(900);
await shot('07-build-sheet');

const most = page.locator('[data-build-sheet]').getByRole('button', { name: /max/i }).last();
if (await most.isVisible().catch(() => false)) {
  await tap(most);
  await settle(400);
} else {
  problems.push('the build sheet count picker was not reachable');
}
await shot('07b-picker');
await tap(page.locator('[data-build-sheet] [data-act] button').first());
await settle(1600);
await shot('08-fleet-built');

const afterFleet = await beatText();
check(
  'building the fleet reached the fog beat',
  /learn first, risk later|önce bilgi, sonra risk/i.test(afterFleet),
  afterFleet.split('\n')[1] ?? '',
);

/* ── beat 8: inspect one hidden neighbour ───────────────────── */

await tap(page.getByRole('button', { name: /^close$/i }).first()).catch(() => undefined);
await settle(800);

let stranger = false;
for (const w of others) {
  if (!(await tapWorld(w.position))) continue;
  if (await page.getByRole('dialog').isVisible().catch(() => false)) {
    stranger = true;
    break;
  }
}

check('a hidden neighbour opened the claim', stranger);
await shot('09-claim');

/* ── the wall ───────────────────────────────────────────────── */

const dialog = page.getByRole('dialog');
check('the claim opened at the moment of most desire', await dialog.isVisible().catch(() => false));

const COMMANDER = `reh${String(Date.now()).slice(-8)}`;
await page.locator('form input[name="username"]').fill(COMMANDER);
// The dialog's own submit, whatever the step has worded it as.
await tap(page.locator('form button[type="submit"]').first());
await settle(500);
await shot('10-claim-password');
await page.locator('form input[name="password"]').fill('correct-horse-battery');
await tap(page.locator('form button[type="submit"]').first());

// The claim creates the account, takes the seat and replays the opening.
await page.waitForFunction(
  () => !document.querySelector('[role="dialog"]'),
  { timeout: 30_000 },
).catch(() => undefined);
await settle(3500);
await shot('11-claimed');

const claimed = calls.filter((c) => c === 'POST /api/onboarding/claim');
check('the claim was one call, not four', claimed.length === 1, `${claimed.length}`);

/**
 * REAL SESSION, NOT THE PREVIEW — and the evidence is the API, not a label.
 *
 * This matched "Active world" on the header, which broke the day that selector
 * started appearing only when a commander HAS a second world to pick. It was also
 * the weaker half of the claim it was making: the rehearsal renders the same shell
 * with the same header, so a string on it never distinguished a claimed session
 * from the preview. A read of `/api/planets/<id>` does — the preview never makes
 * one, because it has no planet to read.
 */
const body = await page.locator('body').innerText();
const realPlanetRead = calls.some((c) => /^GET \/api\/planets\/[0-9a-f-]{8,}/.test(c));
check(
  'the session landed on the real planet',
  realPlanetRead && /works|havuz/i.test(body),
  realPlanetRead ? 'read its own planet' : 'no authenticated planet read',
);
check(
  'the opening survived the trip',
  !/one world is yours|bir dünya seni bekliyor/i.test(body),
  body.slice(0, 80).replace(/\n/g, ' '),
);

console.log(`\n${problems.length === 0 ? 'CLEAN' : `${problems.length} PROBLEM(S)`}`);
for (const p of problems) console.log(`  ! ${p}`);
console.log(`\napi calls seen: ${[...new Set(calls)].join(', ')}`);

await browser.close();
process.exitCode = problems.length === 0 ? 0 : 1;
