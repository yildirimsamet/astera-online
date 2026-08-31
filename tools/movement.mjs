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
 *   1. Every craft moves from the first second it appears, then keeps moving
 *      between longer samples. A stale payload does not
 *      remove a craft, it PARKS it — so "nothing moved" is what a broken real-time
 *      path actually looks like.
 *   2. No two markers sit on top of each other. That is what a duplicate looks
 *      like: `pendingThreads` and `/api/galaxy/traffic` both drawing the same
 *      mission, a few metres apart, for the player at the far end of it.
 *   3. Two clients watching the same instant put the same craft in the same place.
 *   4. Nothing collapses to the scene origin.
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
// This harness inspects the scene graph rather than layout pixels. Keeping the
// phone aspect ratio at a smaller raster prevents two software-rendered canvases
// from monopolising the local CPU; visual/layout coverage lives in visual.mjs.
const PHONE = { width: 260, height: 560 };

/** How long between the two samples. Long enough that a real leg has visibly moved. */
const GAP_MS = 10_000;

/** The old surface clamp froze the first several seconds; sample inside that interval. */
const EARLY_GAP_MS = 1_000;
const EARLY_MOVED = 0.001;

/** Under this in ten seconds is what a player calls frozen. In world units. */
const MOVED = 0.05;

/**
 * This harness runs two software-rendered galaxies. Ten seconds distinguishes the
 * event path from the sixty-second safety poll without pretending SwiftShader CPU
 * contention is server latency; request and response time are asserted separately.
 */
const LIVE_PATH_MS = 10_000;

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

const commander = async (name, existing = false) => {
  const session = await call(existing ? '/api/auth/login' : '/api/auth/register', {
    method: 'POST',
    body: { username: name, password: PASSWORD },
  });
  if (!existing) {
    const servers = await call('/api/servers');
    const open = servers.servers.find((s) => s.status === 'open');
    await call(`/api/servers/${open.code}/join`, { method: 'POST', token: session.accessToken });
  }
  // Do not prime the caller-specific projection caches before the SQL fixture
  // below installs its sensors. The browser's first read must see that fixture.
  const [planet] = await sql`
    SELECT p.id, p.name
    FROM planets p
    JOIN players pl ON pl.id = p.player_id
    JOIN accounts ac ON ac.id = pl.account_id
    WHERE ac.username = ${name} AND p.kind = 'CAPITAL'
    LIMIT 1
  `;
  if (!planet) throw new Error(`joined commander ${name} has no capital`);
  return { name, token: session.accessToken, planet };
};

/* ── put something in the air ───────────────────────────────── */

const stamp = String(Date.now()).slice(-7);
const ownerName = process.env.MOVEMENT_OWNER;
const observerName = process.env.MOVEMENT_OBSERVER;
if ((ownerName === undefined) !== (observerName === undefined)) {
  throw new Error('set both MOVEMENT_OWNER and MOVEMENT_OBSERVER, or neither');
}
const a = await commander(ownerName ?? `mova${stamp}`, ownerName !== undefined);
const b = await commander(observerName ?? `movb${stamp}`, observerName !== undefined);
console.log(`A = ${a.planet.name}   B = ${b.planet.name}\n`);

/** Give both real eyes and a deterministic shared patch of sky. D123/D126. */
const installEyes = async (planetId, x) => {
  await sql`UPDATE planets SET x = ${x}, y = 0, z = 0 WHERE id = ${planetId}`;
  for (const [slot, type, level] of [[0, 'TELESCOPE', 5], [1, 'RADAR', 5], [5, 'UPLINK', 1]]) {
    await sql`
      INSERT INTO satellites (planet_id, slot, type, level)
      VALUES (${planetId}, ${slot}, ${type}, ${level})
      ON CONFLICT (planet_id, slot) DO UPDATE SET type = ${type}, level = ${level}
    `;
  }
  // The movement harness needs a rock on every wall-clock minute. A wide epoch is
  // a test fixture only; it discovers whichever live rock the deterministic season
  // schedule currently contains without changing production discovery rules.
  await sql`
    UPDATE sensor_epochs
    SET x = ${x}, y = 0, z = 0, reach = 10000
    WHERE planet_id = ${planetId} AND ends_at IS NULL
  `;
};

await installEyes(a.planet.id, 0);
await installEyes(b.planet.id, 0);
const [fixtureSeason] = await sql`
  SELECT s.id AS "seasonId", s.starts_at AS "startsAt"
  FROM seasons s
  JOIN planets p ON p.season_id = s.id
  WHERE p.id = ${a.planet.id}
  LIMIT 1`;
if (!fixtureSeason) throw new Error('movement harness owner has no season');
await sql`
  UPDATE buildings
  SET level = 9
  WHERE planet_id IN (${a.planet.id}, ${b.planet.id}) AND type = 'CORE'`;
await sql`
  INSERT INTO units (planet_id, hull, location, count) VALUES (${a.planet.id}, 'WASP', 'home', 40)
  ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = 40`;
await sql`
  INSERT INTO units (planet_id, hull, location, count) VALUES (${a.planet.id}, 'PROSPECTOR', 'home', 2)
  ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = 2`;
await sql`UPDATE players SET wealth = 90000 WHERE id IN (
  SELECT player_id FROM planets WHERE id IN (${a.planet.id}, ${b.planet.id}))`;

/* ── watch it from two screens ──────────────────────────────── */

const browserArgs = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
];
// Two independent GPU processes. Two R3F scenes sharing one headless SwiftShader
// process intermittently starved the second page before its first model upload.
const [browserA, browserB] = await Promise.all([
  chromium.launch({ args: browserArgs }),
  chromium.launch({ args: browserArgs }),
]);

const problems = [];
const networkTrace = [];

/**
 * Everything the disc is drawing that MOVES, with its world position.
 *
 * Read through the dev bridge rather than off the picture: a screenshot cannot
 * tell a squadron holding in orbit from one that has stopped, and it certainly
 * cannot tell two markers a few metres apart from one.
 */
const survey = (page, ids) =>
  page.evaluate((wantedIds) => {
    const g = window.__galaxy;
    if (!g) return null;
    const wanted = new Set(wantedIds);
    const craft = [];
    g.scene.traverse((o) => {
      if (o.name !== 'flight' && o.name !== 'contact' && o.name !== 'mining') return;
      const id = o.userData.craftId;
      if (typeof id !== 'string' || !wanted.has(id)) return;
      const p = o.getWorldPosition(o.position.clone());
      craft.push({ id, kind: o.name, at: [p.x, p.y, p.z] });
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
  }, ids);

const waitForScene = async (page) => {
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
    undefined,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(3500);
};

const open = async (browser, who) => {
  const page = await browser.newPage({
    viewport: PHONE,
    // Motion correctness needs a phone-shaped viewport, not four times the
    // software-rasterised pixels. DPR 2 made two SwiftShader scenes saturate all
    // local cores and delayed JavaScript/network work by more than ten seconds.
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
  });
  page.on('pageerror', (e) => problems.push(`${who.name}: ${e.message.slice(0, 140)}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('401')) problems.push(`${who.name}: ${t.slice(0, 140)}`);
  });
  const trace = (phase, url, status) => {
    const path = new URL(url).pathname;
    if (path !== '/api/galaxy/traffic' && !path.endsWith('.glb')) return;
    networkTrace.push({ who: who.name, phase, path, status, at: Date.now() });
  };
  page.on('request', (request) => { trace('request', request.url()); });
  page.on('response', (response) => { trace('response', response.url(), response.status()); });
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Network.enable');
  devtools.on('Network.eventSourceMessageReceived', (event) => {
    networkTrace.push({
      who: who.name,
      phase: 'sse',
      path: String(event.data).slice(0, 120),
      at: Date.now(),
    });
  });

  /**
   * Authenticate through the browser context, not through the landing form.
   *
   * This is a movement harness, and the API request stores the same httpOnly
   * refresh cookie the form would. Driving four controls made a live Vite reload
   * between the username and password fields look like a flight failure; it also
   * spent most of this test's timeout on a surface it is not testing.
   */
  const login = await page.request.post(`${API}/api/auth/login`, {
    data: { username: who.name, password: PASSWORD },
  });
  if (!login.ok()) {
    throw new Error(`browser login failed for ${who.name}: ${String(login.status())}`);
  }
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await waitForScene(page);
  return page;
};

const pageA = await open(browserA, a);
const pageB = await open(browserB, b);

/**
 * Place the observer only after both expensive software-rendered scenes are ready.
 * Asteroids can turn through a meaningful arc while those scenes load, so using
 * their earlier direction made the supposedly deterministic mining contact leave
 * Radar before the launch. This is fixture setup, before the measured event path.
 */
const fixtureField = await call('/api/mining', { token: a.token });
const fixtureRock = fixtureField.asteroids[0];
if (!fixtureRock) throw new Error('movement harness found no live asteroid');
const rockMinutes = (Date.now() - fixtureSeason.startsAt.getTime()) / 60_000;
const rockTheta = fixtureRock.phase + (2 * Math.PI * rockMinutes) / fixtureRock.period;
const cosTheta = Math.cos(rockTheta);
const sinTheta = Math.sin(rockTheta);
const cosNode = Math.cos(fixtureRock.ascendingNode);
const sinNode = Math.sin(fixtureRock.ascendingNode);
const cosInclination = Math.cos(fixtureRock.inclination);
const sinInclination = Math.sin(fixtureRock.inclination);
const rockAt = {
  x: fixtureRock.radius * (cosNode * cosTheta - sinNode * sinTheta * cosInclination),
  y: fixtureRock.radius * sinTheta * sinInclination,
  z: fixtureRock.radius * (sinNode * cosTheta + cosNode * sinTheta * cosInclination),
};
const rockDistance = Math.hypot(rockAt.x, rockAt.y, rockAt.z);
const observerDistance = 2_100;
const observerAt = {
  x: observerDistance * rockAt.x / rockDistance,
  y: observerDistance * rockAt.y / rockDistance,
  z: observerDistance * rockAt.z / rockDistance,
};
await sql.begin(async (tx) => {
  await tx`
    UPDATE planets
    SET x = ${observerAt.x}, y = ${observerAt.y}, z = ${observerAt.z}
    WHERE id = ${b.planet.id}`;
  await tx`
    UPDATE sensor_epochs
    SET x = ${observerAt.x}, y = ${observerAt.y}, z = ${observerAt.z}
    WHERE planet_id = ${b.planet.id} AND ends_at IS NULL`;
  // Direct fixture writes bypass the ordinary world mutation. Publish its normal
  // cache boundary before asking either browser to read the moved sensor post.
  await tx`SELECT pg_notify(
    'astera_events',
    ${JSON.stringify({ shard: fixtureSeason.seasonId, kind: 'shard:world' })}
  )`;
});

let projectedObserver = null;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const view = await call('/api/galaxy', { token: b.token });
  projectedObserver = view.planets.find((planet) => planet.id === b.planet.id) ?? null;
  if (
    projectedObserver
    && Math.hypot(
      projectedObserver.position.x - observerAt.x,
      projectedObserver.position.y - observerAt.y,
      projectedObserver.position.z - observerAt.z,
    ) < 0.01
  ) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!projectedObserver) throw new Error('observer world vanished during fixture setup');
const projectedGap = Math.hypot(
  projectedObserver.position.x - observerAt.x,
  projectedObserver.position.y - observerAt.y,
  projectedObserver.position.z - observerAt.z,
);
if (projectedGap >= 0.01) {
  throw new Error(`observer fixture projection stayed ${projectedGap.toFixed(3)} units stale`);
}
for (const page of [pageA, pageB]) {
  await page.evaluate(async () => {
    const client = window.__queryClient;
    if (!client) throw new Error('development query client bridge is missing');
    await Promise.all([
      client.invalidateQueries({ queryKey: ['galaxy'] }),
      client.invalidateQueries({ queryKey: ['traffic'] }),
    ]);
  });
  await page.waitForFunction(
    ({ planetId, at }) => {
      const planet = window.__queryClient
        ?.getQueryData(['galaxy'])?.planets
        ?.find((candidate) => candidate.id === planetId);
      return planet !== undefined && Math.hypot(
        planet.position.x - at.x,
        planet.position.y - at.y,
        planet.position.z - at.z,
      ) < 0.01;
    },
    { planetId: b.planet.id, at: observerAt },
    { timeout: 20_000 },
  );
}

/**
 * Launch AFTER both canvases are ready. The old harness launched before two full
 * sign-ins, model decode and a 3.5-second settle, so it began measuring only after
 * the exact spawn plateau it was meant to catch had ended.
 */
const launchStarted = Date.now();
const launchGalaxy = await call('/api/galaxy', { token: a.token });
const attackTargets = [
  ...launchGalaxy.planets.filter((planet) => planet.id === b.planet.id),
  ...launchGalaxy.planets.filter((planet) => !planet.isSelf && planet.id !== b.planet.id),
];
let raid = null;
for (const target of attackTargets) {
  try {
    raid = await call('/api/fleet/launch', {
      method: 'POST',
      token: a.token,
      body: { targetPlanetId: target.id, fleet: { WASP: 40 } },
    });
    break;
  } catch (error) {
    // A reused account can still have a raid committed to one target. Rank or
    // protection may make another target unavailable; neither invalidates motion.
    const refusal = String(error);
    if (!refusal.includes('403 /api/fleet/launch') && !refusal.includes('409 /api/fleet/launch')) {
      throw error;
    }
  }
}
if (!raid) throw new Error('movement harness found no legal raid target');
const probeTargets = [
  ...launchGalaxy.planets.filter((planet) => planet.id === b.planet.id),
  ...launchGalaxy.planets.filter((planet) => !planet.isSelf && planet.id !== b.planet.id),
];
let probe = null;
for (const target of probeTargets) {
  try {
    probe = await call('/api/intel/probe', {
      method: 'POST',
      token: a.token,
      body: { targetPlanetId: target.id },
    });
    break;
  } catch (error) {
    // Reusing a named harness account may leave one target's commander-wide
    // cooldown active. That target is unavailable, not a failed movement test.
    if (!String(error).includes('409 /api/intel/probe')) throw error;
  }
}
if (!probe) throw new Error('movement harness found no probe target outside cooldown');

const field = fixtureField;
let mining = null;
const miningTargets = [
  fixtureRock,
  ...field.asteroids.filter((rock) => rock.id !== fixtureRock.id),
];
for (const rock of miningTargets) {
  try {
    mining = await call('/api/mining/launch', {
      method: 'POST',
      token: a.token,
      body: { asteroidId: rock.id, craft: 1 },
    });
    break;
  } catch (error) {
    const refusal = String(error);
    if (
      !refusal.includes('403 /api/mining/launch')
      && !refusal.includes('409 /api/mining/launch')
    ) throw error;
  }
}
if (!mining) throw new Error('movement harness found no reachable asteroid');
const launchedIds = [raid.missionId, probe.missionId, mining.runId];
const launchedIn = Date.now() - launchStarted;

/**
 * The other commander has no mutation response to lean on: this is the actual
 * shard event → traffic refetch latency. The owner POST hand-off is covered by
 * `mining-launch-race.test.tsx`; this harness made that POST outside the tab, so
 * refetch its private keys explicitly instead of pretending it received a result
 * that Node received.
 */
const appearanceStarted = Date.now();
try {
  await pageB.waitForFunction(
    (ids) => {
      const g = window.__galaxy;
      if (!g) return false;
      const seen = new Set();
      g.scene.traverse((o) => {
        if (typeof o.userData.craftId === 'string') seen.add(o.userData.craftId);
      });
      return ids.every((id) => seen.has(id));
    },
    launchedIds,
    // Wait long enough to report a slow software renderer instead of aborting at
    // the pass boundary. `appearedIn < LIVE_PATH_MS` below remains the criterion.
    { timeout: 60_000 },
  );
} catch (error) {
  const drawn = await survey(pageB, launchedIds);
  const visible = (await call('/api/galaxy/traffic', { token: b.token })).contacts
    .filter((contact) => launchedIds.includes(contact.id))
    .map((contact) => contact.id);
  const cached = await pageB.evaluate(() => window.__queryClient
    ?.getQueryData(['traffic'])?.contacts
    ?.map((contact) => contact.id) ?? []);
  const renderedProps = await pageB.evaluate((ids) => {
    const root = document.querySelector('#root');
    const containerKey = root
      ? Object.keys(root).find((key) => key.startsWith('__reactContainer$'))
      : undefined;
    if (!root || !containerKey) return [];
    const stack = [root[containerKey]];
    const matches = [];
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber) continue;
      const contacts = fiber.memoizedProps?.contacts;
      if (Array.isArray(contacts)) {
        const present = contacts
          .filter((contact) => ids.includes(contact?.id))
          .map((contact) => contact.id);
        if (present.length > 0) {
          matches.push({ component: fiber.type?.name ?? fiber.elementType?.name ?? '?', present });
        }
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return matches;
  }, launchedIds);
  const trace = networkTrace
    .filter((entry) => entry.who === b.name && entry.at >= appearanceStarted - 1_000)
    .map((entry) =>
      `${entry.phase}:${entry.path}:${String(entry.status ?? '')}:${String(entry.at - appearanceStarted)}ms`)
    .join(',');
  const metrics = await pageB.evaluate(() => window.__galaxyMetrics?.snapshot() ?? null);
  console.error(
    `observer timeout: drawn=${drawn?.craft.map((craft) => craft.id).join(',') ?? 'none'} ` +
    `cached=${cached.filter((id) => launchedIds.includes(id)).join(',') || 'none'} ` +
    `props=${JSON.stringify(renderedProps)} visible=${visible.join(',') || 'none'} ` +
    `expected=${launchedIds.join(',')} trace=${trace || 'none'} metrics=${JSON.stringify(metrics)}`,
  );
  await pageB.screenshot({ path: `${OUT}/failure-observer.png` });
  throw error;
}
const appearedIn = Date.now() - appearanceStarted;
const observerTraffic = networkTrace.filter(
  (entry) => entry.who === b.name
    && entry.path === '/api/galaxy/traffic'
    && entry.at >= appearanceStarted - 1_000,
);
const trafficRequest = observerTraffic.find((entry) => entry.phase === 'request');
const trafficResponse = observerTraffic.find(
  (entry) => entry.phase === 'response' && (trafficRequest === undefined || entry.at >= trafficRequest.at),
);
const trafficWakeMs = trafficRequest ? trafficRequest.at - appearanceStarted : Number.POSITIVE_INFINITY;
const trafficRttMs = trafficRequest && trafficResponse
  ? trafficResponse.at - trafficRequest.at
  : Number.POSITIVE_INFINITY;
const observerTrace = networkTrace
  .filter((entry) => entry.who === b.name && entry.at >= appearanceStarted - 1_000)
  .map((entry) =>
    `${entry.phase} ${entry.path}${entry.status ? ` ${String(entry.status)}` : ''} ` +
    `${String(entry.at - appearanceStarted)}ms`)
  .join(', ');
await pageA.evaluate(async () => {
  const client = window.__queryClient;
  if (!client) throw new Error('development query client bridge is missing');
  await Promise.all([
    client.invalidateQueries({ queryKey: ['pending'] }),
    client.invalidateQueries({ queryKey: ['mining', 'status'] }),
    client.invalidateQueries({ queryKey: ['planet'] }),
  ]);
});
await pageA.waitForFunction(
  (ids) => {
    const g = window.__galaxy;
    if (!g) return false;
    const seen = new Set();
    g.scene.traverse((o) => {
      if (typeof o.userData.craftId === 'string') seen.add(o.userData.craftId);
    });
    return ids.every((id) => seen.has(id));
  },
  launchedIds,
  { timeout: 20_000 },
);
console.log(
  `a raid, a probe and a mining run launched in ${String(launchedIn)}ms ` +
  `and appeared for the other commander after the last response in ${String(appearedIn)}ms\n` +
  `observer trace: ${observerTrace || 'no matching request'}\n`,
);
check('the three launch responses complete promptly', launchedIn < 1_000, `${String(launchedIn)}ms`);
check('the live traffic read wakes before the safety poll', trafficWakeMs < 5_000, `${String(trafficWakeMs)}ms`);
check('the traffic projection answers promptly', trafficRttMs < 2_000, `${String(trafficRttMs)}ms`);
check(
  'the public markers arrive through the live path',
  appearedIn < LIVE_PATH_MS,
  `${String(appearedIn)}ms including software render`,
);

const firstA = await survey(pageA, launchedIds);
const firstB = await survey(pageB, launchedIds);
await pageA.screenshot({ path: `${OUT}/01-owner.png` });
await pageB.screenshot({ path: `${OUT}/01-defender.png` });

check(
  'the owner sees every launched craft on the disc',
  firstA?.craft.length === launchedIds.length,
  `${String(firstA?.craft.length ?? 0)}/${String(launchedIds.length)} drawn`,
);
check(
  'the other commander sees every launched craft too',
  firstB?.craft.length === launchedIds.length,
  `${String(firstB?.craft.length ?? 0)}/${String(launchedIds.length)} drawn`,
);

/* ── 0 · does motion start immediately? ────────────────────── */

await pageA.waitForTimeout(EARLY_GAP_MS);
const earlyA = await survey(pageA, launchedIds);
const earlyB = await survey(pageB, launchedIds);

console.log('\n0 · no spawn plateau');
for (const [who, before, after] of [
  ['owner', firstA, earlyA],
  ['other commander', firstB, earlyB],
]) {
  const moved = before?.craft.map((craft) => {
    const next = after?.craft.find((candidate) => candidate.id === craft.id);
    return next ? Math.hypot(...craft.at.map((value, axis) => value - next.at[axis])) : 0;
  }) ?? [];
  const still = moved.filter((distance) => distance < EARLY_MOVED).length;
  check(
    `${who}: every craft advances in its first sampled second`,
    moved.length > 0 && still === 0,
    `${String(moved.length)} craft, ${String(still)} frozen`,
  );
}

/* ── 1 · does everything move? ──────────────────────────────── */

await pageA.waitForTimeout(GAP_MS);
const laterA = await survey(pageA, launchedIds);
const laterB = await survey(pageB, launchedIds);
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
  const moved = before.craft.map((c) => {
    const then = after.craft.find((candidate) => candidate.id === c.id);
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
  const duplicateIds = launchedIds.filter(
    (id) => sample.craft.filter((craft) => craft.id === id).length !== 1,
  );
  check(
    `${who}: exactly one marker per launched craft`,
    duplicateIds.length === 0,
    duplicateIds.length === 0
      ? `${String(sample.craft.length)} craft`
      : `wrong count for ${duplicateIds.join(', ')}`,
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
const strays = laterA.craft.filter((craft) => {
  const other = laterB.craft.find((candidate) => candidate.id === craft.id);
  return !other || Math.hypot(...craft.at.map((value, axis) => value - other.at[axis])) > 1.5;
});
check(
  'the same craft is in the same place on both screens',
  strays.length === 0,
  `${String(laterA.craft.length)} compared, ${String(strays.length)} apart, ` +
    `samples ${String(sampledApart)}ms apart`,
);

/* ── 4 · nowhere impossible ─────────────────────────────────── */

console.log('\n4 · nothing collapses to a fallback coordinate');
const atOrigin = laterA.craft.filter((c) => Math.hypot(...c.at) < 1e-6);
check('nothing collapsed to the origin', atOrigin.length === 0, `${String(atOrigin.length)} at 0,0,0`);

console.log(problems.length === 0 ? '\nno runtime errors' : `\nruntime errors:\n  ${problems.join('\n  ')}`);
if (problems.length > 0) failures += 1;

await Promise.all([browserA.close(), browserB.close()]);
await sql.end();
console.log(failures === 0 ? `\nALL GREEN → ${OUT}` : `\n${String(failures)} FAILED → ${OUT}`);
process.exit(failures === 0 ? 0 : 1);
