/**
 * MOVEMENT HARNESS — is the galaxy actually moving, and is each craft drawn once?
 *
 * `pnpm verify` proves the arithmetic. `tools/loop-check.mjs` proves the API says
 * the right thing. Neither can tell you that a squadron is on screen, that it is
 * advancing down its leg, or that it is not being rendered twice in two places
 * from two payloads that disagree — and every one of those has shipped from this
 * repo on a green suite.
 *
 * This signs two commanders in against a real server, puts craft in the air, and
 * MEASURES the scene through the dev bridge from both of their screens:
 *
 *   1. Every craft on the disc moves between two samples. A stale payload does not
 *      remove a craft, it PARKS it — so "nothing moved" is what a broken real-time
 *      path actually looks like.
 *   2. No two markers sit on top of each other. That is what a duplicate looks
 *      like: `pendingThreads` and `/api/galaxy/traffic` both drawing the same
 *      mission, a few metres apart, for the player at the far end of it.
 *   3. Two clients watching the same instant put the same craft in the same place.
 *   4. Nothing is drawn inside a world, and nothing is drawn at the origin —
 *      the two coordinates a failed interpolation collapses to.
 *
 *   DATABASE_URL=... API=http://localhost:3199 WEB=http://localhost:5299 \
 *     node tools/movement.mjs out/movement
 *
 * WebGL runs on SwiftShader here, so everything is given time to settle.
 */
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const fromServer = createRequire(new URL('../apps/server/package.json', import.meta.url));
const postgres = (await import(fromServer.resolve('postgres'))).default;

const API = process.env.API ?? 'http://localhost:3100';
const WEB = process.env.WEB ?? 'http://localhost:5173';
const OUT = process.argv[2] ?? 'out/movement';
const PASSWORD = 'correct-horse-battery';
const PHONE = { width: 390, height: 844 };

/** How long between the two samples. Long enough that a real leg has visibly moved. */
const GAP_MS = 10_000;

/** Under this in ten seconds is what a player calls frozen. In world units. */
const MOVED = 0.05;

/** Two markers closer than this are the same craft drawn twice. */
const TOUCHING = 0.02;

await mkdir(OUT, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { max: 4 });

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const call = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${String(res.status)} ${path}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
};

const commander = async (name) => {
  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { username: name, password: PASSWORD },
  });
  const servers = await call('/api/servers');
  const open = servers.servers.find((s) => s.status === 'open');
  await call(`/api/servers/${open.code}/join`, { method: 'POST', token: reg.accessToken });
  const galaxy = await call('/api/galaxy', { token: reg.accessToken });
  return { name, token: reg.accessToken, planet: galaxy.planets.find((p) => p.isSelf) };
};

/* ── put something in the air ───────────────────────────────── */

const stamp = String(Date.now()).slice(-7);
const a = await commander(`mova${stamp}`);
const b = await commander(`movb${stamp}`);
console.log(`A = ${a.planet.name}   B = ${b.planet.name}\n`);

await sql`UPDATE buildings SET level = 9 WHERE planet_id = ${a.planet.id} AND type = 'CORE'`;
await sql`
  INSERT INTO units (planet_id, hull, location, count) VALUES (${a.planet.id}, 'WASP', 'home', 40)
  ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = 40`;
await sql`UPDATE players SET wealth = 90000 WHERE id IN (
  SELECT player_id FROM planets WHERE id IN (${a.planet.id}, ${b.planet.id}))`;

await call('/api/fleet/launch', {
  method: 'POST',
  token: a.token,
  body: { targetPlanetId: b.planet.id, fleet: { WASP: 40 } },
});
const elsewhere = (await call('/api/galaxy', { token: a.token })).planets.find(
  (p) => !p.isSelf && p.id !== b.planet.id,
);
await call('/api/intel/probe', {
  method: 'POST',
  token: a.token,
  body: { targetPlanetId: elsewhere.id },
});
console.log('a raid and a probe are in the air\n');

/* ── watch it from two screens ──────────────────────────────── */

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const problems = [];

/**
 * Everything the disc is drawing that MOVES, with its world position.
 *
 * Read through the dev bridge rather than off the picture: a screenshot cannot
 * tell a squadron holding in orbit from one that has stopped, and it certainly
 * cannot tell two markers a few metres apart from one.
 */
const survey = (page) =>
  page.evaluate(() => {
    const g = window.__galaxy;
    if (!g) return null;
    const craft = [];
    g.scene.traverse((o) => {
      if (o.name !== 'flight' && o.name !== 'contact' && o.name !== 'mining') return;
      const p = o.getWorldPosition(o.position.clone());
      craft.push({ kind: o.name, at: [p.x, p.y, p.z] });
    });
    const worlds = [];
    g.scene.traverse((o) => {
      if (!o.isInstancedMesh || o.name !== 'planet-worlds' || o.count === 0) return;
      const m = o.instanceMatrix.array;
      for (let i = 0; i < o.count; i += 1) {
        worlds.push([m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]]);
      }
    });
    return { craft, worlds, now: Date.now() };
  });

const open = async (who) => {
  const page = await browser.newPage({
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
  });
  page.on('pageerror', (e) => problems.push(`${who.name}: ${e.message.slice(0, 140)}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('401')) problems.push(`${who.name}: ${t.slice(0, 140)}`);
  });

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  const door = page.getByRole('button', { name: /already have a commander/i }).first();
  await door.waitFor({ timeout: 40_000 });
  await door.click();
  await page.getByLabel(/commander name/i).fill(who.name);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).last().click();

  await page.waitForSelector('canvas', { timeout: 40_000 });
  // The models arrive over the network and decode on the CPU; surveying before
  // they land measures an empty scene.
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
  await page.waitForTimeout(3500);
  return page;
};

const pageA = await open(a);
const pageB = await open(b);

const firstA = await survey(pageA);
const firstB = await survey(pageB);
await pageA.screenshot({ path: `${OUT}/01-owner.png` });
await pageB.screenshot({ path: `${OUT}/01-defender.png` });

check('the owner sees craft on the disc', (firstA?.craft.length ?? 0) > 0, `${String(firstA?.craft.length ?? 0)} drawn`);
check(
  'the other commander sees them too',
  (firstB?.craft.length ?? 0) > 0,
  `${String(firstB?.craft.length ?? 0)} drawn`,
);

/* ── 1 · does everything move? ──────────────────────────────── */

await pageA.waitForTimeout(GAP_MS);
const laterA = await survey(pageA);
const laterB = await survey(pageB);
await pageA.screenshot({ path: `${OUT}/02-owner-later.png` });
await pageB.screenshot({ path: `${OUT}/02-defender-later.png` });

console.log('\n1 · everything in the air is moving');
for (const [who, before, after] of [
  ['owner', firstA, laterA],
  ['other commander', firstB, laterB],
]) {
  if (!before || !after || before.craft.length === 0) {
    check(`${who}: craft advance down their legs`, false, 'nothing was drawn');
    continue;
  }
  /**
   * Matched by INDEX rather than by identity, which is safe only because the two
   * samples are ten seconds apart on a list that changes on arrival — and any
   * mismatch shows up as a craft that "did not move", which is the failure being
   * looked for anyway.
   */
  const moved = before.craft.map((c, i) => {
    const then = after.craft[i];
    return then ? Math.hypot(...c.at.map((n, k) => n - then.at[k])) : 0;
  });
  const still = moved.filter((d) => d < MOVED).length;
  check(
    `${who}: craft advance down their legs`,
    still === 0,
    `${String(before.craft.length)} craft, ${String(still)} frozen, ` +
      `min ${Math.min(...moved).toFixed(3)} units / ${String(GAP_MS / 1000)}s`,
  );
}

/* ── 2 · is anything drawn twice? ───────────────────────────── */

console.log('\n2 · one craft, one marker');
for (const [who, sample] of [
  ['owner', laterA],
  ['other commander', laterB],
]) {
  const pairs = [];
  for (let i = 0; i < sample.craft.length; i += 1) {
    for (let j = i + 1; j < sample.craft.length; j += 1) {
      const gap = Math.hypot(...sample.craft[i].at.map((n, k) => n - sample.craft[j].at[k]));
      if (gap < TOUCHING) pairs.push(`${sample.craft[i].kind}/${sample.craft[j].kind}`);
    }
  }
  check(
    `${who}: no two markers on the same spot`,
    pairs.length === 0,
    pairs.length === 0 ? `${String(sample.craft.length)} craft` : pairs.join(', '),
  );
}

/**
 * AND THE DEFENDER'S OWN LIST IS EMPTY OF THE ATTACKER.
 *
 * The disc is the last place this shows; the payload is where it comes from. A
 * squadron drawn out of `pending` carries a ROUTE LINE and the other world's name,
 * so the duplicate was never two identical markers — it was one anonymous contact
 * and one fully attributed craft, in slightly different places.
 */
const defenderThreads = (await call('/api/session/pending', { token: b.token })).pending;
check(
  "the defender's own list carries nothing of the attacker's",
  defenderThreads.every((t) => t.path === undefined),
  defenderThreads.map((t) => `${t.kind}${t.path ? ':with-path' : ''}`).join(', ') || 'empty',
);

/* ── 3 · do two screens agree? ──────────────────────────────── */

console.log('\n3 · two screens, one galaxy');
const sampledApart = Math.abs(laterA.now - laterB.now);
/**
 * The two surveys are taken a moment apart, so an exact match is not the claim.
 * What is being tested is that both screens put the craft in the SAME REGION of
 * the disc rather than in different parts of it — which is what a device-clock
 * drift or a disagreeing payload produces.
 */
const nearest = (point, list) =>
  Math.min(...list.map((c) => Math.hypot(...c.at.map((n, k) => n - point.at[k]))));
const commonKinds = laterA.craft.filter((c) => c.kind === 'contact' || c.kind === 'flight');
const strays = commonKinds.filter((c) => nearest(c, laterB.craft) > 1.5);
check(
  'the same craft is in the same place on both screens',
  strays.length === 0,
  `${String(commonKinds.length)} compared, ${String(strays.length)} apart, ` +
    `samples ${String(sampledApart)}ms apart`,
);

/* ── 4 · nowhere impossible ─────────────────────────────────── */

console.log('\n4 · nothing anywhere impossible');
const atOrigin = laterA.craft.filter((c) => Math.hypot(...c.at) < 1e-6);
check('nothing collapsed to the origin', atOrigin.length === 0, `${String(atOrigin.length)} at 0,0,0`);

const inside = laterA.craft.filter((c) =>
  laterA.worlds.some((w) => Math.hypot(...c.at.map((n, k) => n - w[k])) < 0.35),
);
check('nothing is drawn inside a world', inside.length === 0, `${String(inside.length)} embedded`);

console.log(problems.length === 0 ? '\nno runtime errors' : `\nruntime errors:\n  ${problems.join('\n  ')}`);
if (problems.length > 0) failures += 1;

await browser.close();
await sql.end();
console.log(failures === 0 ? `\nALL GREEN → ${OUT}` : `\n${String(failures)} FAILED → ${OUT}`);
process.exit(failures === 0 ? 0 : 1);
