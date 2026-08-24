/**
 * PHOTOGRAPH A RAID LANDING. D44.
 *
 * The engagement is ten seconds long and happens at the end of a forty-minute
 * flight, so it cannot be waited for and it cannot be faked from the client — the
 * whole point of D44 is that the window is a real server state. This drives the
 * real app against the real API, launches a real raid, then moves the mission's own
 * arrival forward in the database so the ten seconds happen NOW.
 *
 *   DATABASE_URL=... WEB=http://localhost:5174 node tools/engagement.mjs out/engagement
 *
 * Nothing here is part of the game. It is a camera crew.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// `postgres` belongs to the server package, not the root. Resolved through it
// rather than added to the root manifest: nothing in `tools/` ships, and a camera
// rig should not put a driver in the repo's own dependency list.
const fromServer = createRequire(new URL('../apps/server/package.json', import.meta.url));
const postgres = (await import(fromServer.resolve('postgres'))).default;

const WEB = process.env.WEB ?? 'http://localhost:5174';
const OUT = process.argv.slice(2).find((argument) => argument !== '--') ?? 'out/engagement';
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error('set DATABASE_URL');

/** How long after the reload the fleet should arrive. Enough for a cold WebGL boot. */
const LEAD_SECONDS = Number(process.env.LEAD ?? 26);

await mkdir(OUT, { recursive: true });
const sql = postgres(DB, { max: 4 });

/**
 * THE THROTTLING FLAGS ARE NOT OPTIONAL HERE.
 *
 * The galaxy renders ON DEMAND: its ambient ticker calls `invalidate` on a
 * `setInterval` at 24fps, and Chromium throttles timers in a page it considers
 * backgrounded — which a headless page under a screenshot loop is. Without these
 * the scene rendered about once in ten seconds and photographed as a frozen
 * bombardment, which reads exactly like a broken feature.
 */
const browser = await chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
/**
 * SMALL AND UNSCALED, because every pixel is a SwiftShader read-back.
 *
 * At 900x780 and a device scale of 2 a single screenshot took well over a second,
 * which is a sixth of the window being photographed — the capture loop overran the
 * whole engagement inside three frames and reported it as empty.
 */
const page = await browser.newPage({ viewport: { width: 760, height: 660 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) console.log('CONSOLE:', m.text().slice(0, 200));
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  · ${name}.png`);
};
const settle = (ms) => page.waitForTimeout(ms);

/* ── a commander with a fleet ───────────────────────────────── */

const NAME = `raider${String(Date.now()).slice(-8)}`;
console.log(`opening ${WEB} as ${NAME}`);
await page.bringToFront();
await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__api !== undefined, undefined, { timeout: 40_000 });

// Registration moved behind the write-free rehearsal in D56. A camera rig must
// not replay a two-minute tutorial to arrange a shot, so it uses the same dev-only
// API handle as the other visual tools: a real account, a real join, no UI-copy
// dependency.
const placement = await page.evaluate(async ([username]) => {
  const api = window.__api;
  await api.register(username, 'correct-horse-battery');
  const list = await api.servers();
  const open = list.servers.find((server) => server.status === 'open');
  if (!open) throw new Error('No open galaxy for the engagement camera');
  return api.joinServer(open.code);
}, [NAME]);
console.log('placed on', placement.shardName, placement.planetName);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60_000 });
await settle(4000);

/** Which world is mine, and who is nearest. */
const world = await page.evaluate(async () => {
  const galaxy = await window.__api.galaxy();
  const me = galaxy.planets.find((p) => p.isSelf);
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const others = galaxy.planets
    .filter((p) => !p.isSelf)
    .sort((a, b) => gap(me.position, a.position) - gap(me.position, b.position));
  return { mine: me.id, target: others[0]?.id, targetName: others[0]?.name };
});
console.log('raiding', world.targetName);

// A fleet worth watching, and the bays to fly it. Straight into the database:
// this is a camera rig, not a playthrough, and building forty Wasps through the
// interface would take longer than the flight it is setting up.
await sql`UPDATE buildings SET level = 9 WHERE planet_id = ${world.mine} AND type = 'CORE'`;
await sql`
  INSERT INTO units (planet_id, hull, location, count) VALUES (${world.mine}, 'WASP', 'home', 45)
  ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = 45
`;
// A big world to hit, so the bombardment has a real face to land on.
await sql`UPDATE buildings SET level = 6 WHERE planet_id = ${world.target} AND type = 'CORE'`;
await sql`UPDATE players SET wealth = 90000 WHERE id = (SELECT player_id FROM planets WHERE id = ${world.target})`;
await sql`UPDATE players SET wealth = 90000 WHERE id = (SELECT player_id FROM planets WHERE id = ${world.mine})`;

const launched = await page.evaluate(
  async ([target]) => window.__api.launch(target, { WASP: 45 }),
  [world.target],
);
console.log('launched, eta', launched.arriveAt);

/* ── bring the landing forward ──────────────────────────────── */

const [mission] = await sql`
  SELECT id, arrive_at FROM missions
  WHERE origin_planet_id = ${world.mine} AND status = 'in_flight' AND kind = 'attack'
  ORDER BY depart_at DESC LIMIT 1
`;

const arriveAt = new Date(Date.now() + LEAD_SECONDS * 1000);
await sql`UPDATE missions SET arrive_at = ${arriveAt} WHERE id = ${mission.id}`;
await sql`
  UPDATE scheduled_events SET resolve_at = ${new Date(arriveAt.getTime() + 10_000)}
  WHERE ref_id = ${mission.id} AND kind = 'mission_arrival'
`;
console.log('landing at', arriveAt.toISOString());

/* ── watch it land ──────────────────────────────────────────── */

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60_000 });
await page.waitForFunction(
  () => {
    const g = window.__galaxy;
    if (!g) return false;
    let found = false;
    g.scene.traverse((o) => {
      if (o.name === 'flight') found = true;
    });
    return found;
  },
  undefined,
  { timeout: 60_000 },
);

/**
 * FRAME THE GAP, not the squadron.
 *
 * The missiles cross the space between the fleet and the world, so the camera goes
 * broadside to that line — perpendicular, and far enough back that the squadron,
 * the crossing and the face being hit are all in one shot. Pointing it AT the fleet
 * puts the whole volley in the middle distance behind the ships.
 *
 * RE-FRAMED BEFORE EVERY CAPTURE, because the fleet is still flying when this
 * starts. A camera parked where the squadron was twenty seconds before arrival
 * photographs empty space by the time it lands — which is what the first working
 * run of this harness did.
 */
const frame = () =>
  page.evaluate(() => {
    const g = window.__galaxy;
    const V = Object.getPrototypeOf(g.camera.position).constructor;
    const Q = Object.getPrototypeOf(g.camera.quaternion).constructor;

    let flight = null;
    g.scene.traverse((o) => {
      if (o.name === 'flight') flight = o;
    });
    if (!flight) return { found: false };
    flight.updateWorldMatrix(true, false);

    const from = flight.getWorldPosition(new V());
    // The world is straight ahead of the squadron, down its own +Z.
    const ahead = new V(0, 0, 1).applyQuaternion(flight.getWorldQuaternion(new Q())).normalize();

    /**
     * HOW BIG THE SHOT SHOULD BE, taken from the geometry rather than guessed.
     *
     * The impact points sit on the world's near face, so the furthest of them is
     * the gap the rounds actually cross. Framing off that scales the camera with
     * the world being hit — worlds are drawn at 0.44, 0.82 and 1.40, so a fixed
     * distance frames one of the three and misses the other two.
     */
    let reach = 1;
    g.scene.traverse((o) => {
      if (o.name === 'blast') reach = Math.max(reach, o.position.z);
    });

    const mid = from.clone().add(ahead.clone().multiplyScalar(reach * 1.15));
    const side = new V().crossVectors(ahead, new V(0, 1, 0)).normalize();

    g.controls.target.copy(mid);
    g.camera.position
      .copy(mid)
      .add(side.multiplyScalar(reach * 2.9))
      .add(new V(0, reach * 0.85, 0));
    g.camera.lookAt(mid);
    g.controls.update();
    return {
      found: true,
      reach: +reach.toFixed(2),
      at: [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)],
      cam: [+g.camera.position.x.toFixed(2), +g.camera.position.y.toFixed(2), +g.camera.position.z.toFixed(2)],
      range: +g.camera.position.distanceTo(g.controls.target).toFixed(2),
    };
  });

await frame();
await settle(400);
await shot('00-approach');

/**
 * FRAMES AT REAL INSTANTS, AND THE INSTANT IS RECORDED.
 *
 * A screenshot under SwiftShader costs a few hundred milliseconds, so a fixed
 * cadence silently turns into "as fast as possible" and runs off the end of a
 * ten-second window. Each frame therefore waits for its own moment, is SKIPPED if
 * that moment has already gone, and is labelled with when it was actually taken.
 */
/**
 * ONE ROUND, CLOSE ENOUGH TO SEE WHICH WAY IT IS POINTING.
 *
 * The whole reason the aim is built from a quaternion rather than from `lookAt` is
 * that a round flying sideways is only visible from about a round's own length
 * away — at map framing it is a bright point and any orientation looks the same.
 */
const closeUp = async () => {
    for (let i = 0; i < 30; i += 1) {
    const shot = await page.evaluate(() => {
      const g = window.__galaxy;
      window.__galaxy.advance?.(performance.now());
      const V = Object.getPrototypeOf(g.camera.position).constructor;
      let round = null;
      g.scene.traverse((o) => {
        if (o.name === 'missile' && o.visible) round = o;
      });
      if (!round) return null;

      round.updateWorldMatrix(true, false);
      const at = round.getWorldPosition(new V());
      // Broadside to the round's own nose, which is its local +Z.
      const nose = new V(0, 0, 1)
        .applyQuaternion(round.getWorldQuaternion(new (Object.getPrototypeOf(g.camera.quaternion).constructor)()))
        .normalize();
      const side = new V().crossVectors(nose, new V(0, 1, 0)).normalize();

      g.controls.target.copy(at);
      g.camera.position.copy(at).add(side.multiplyScalar(0.42)).add(new V(0, 0.1, 0));
      g.camera.lookAt(at);
      g.controls.update();
      return [+nose.x.toFixed(3), +nose.y.toFixed(3), +nose.z.toFixed(3)];
    });
    if (!shot) continue;
    await page.evaluate(() => {
      window.__galaxy.advance?.(performance.now());
    });
    await page.screenshot({ path: `${OUT}/round-closeup.png` });
    console.log('  · round-closeup.png — nose pointing', JSON.stringify(shot));
      break;
    }
};


const WANT = [400, 1600, 2800, 4000, 5200, 6400, 7600, 11_200];
const frames = [];
for (const want of WANT) {
  const at = arriveAt.getTime() + want;
  const left = at - Date.now();
  if (left < -250) {
    console.log(`  · skipped +${String(want)}ms — the capture was already past it`);
    continue;
  }
  if (left > 0) await settle(left);
  const framed = await frame();

  /**
   * DRIVE THE FRAME BY HAND BEFORE PHOTOGRAPHING IT.
   *
   * A CDP screenshot stalls `requestAnimationFrame` in headless Chromium, and the
   * galaxy renders on demand — so a screenshot loop starves the very loop it is
   * trying to photograph. `advance` renders one frame immediately and runs every
   * `useFrame` with it, which is exactly what `frameloop="demand"` provides it for.
   */
  await page.evaluate(() => {
    window.__galaxy.advance?.(performance.now());
  });
  const actual = Date.now() - arriveAt.getTime();
  // Photograph FIRST, count second. A burst lasts under a second, and a round trip
  // to the page between the two can be long enough for the frame and the census to
  // disagree about what was on screen.
  await page.screenshot({ path: `${OUT}/f-${String(actual).padStart(5, '0')}.png` });
  const census = await page.evaluate(() => {
    const g = window.__galaxy;
    let rounds = 0;
    let fires = 0;
    let mounted = 0;
    g.scene.traverse((o) => {
      if (o.name === 'missile') {
        mounted += 1;
        if (o.visible) rounds += 1;
      }
      if (o.name === 'blast') fires += o.children.filter((c) => c.visible).length;
    });
    g.gl.setRenderTarget(null);
    g.gl.info.reset();
    g.gl.render(g.scene, g.camera);
    return {
      rounds,
      fires,
      mounted,
      calls: g.gl.info.render.calls,
      triangles: g.gl.info.render.triangles,
      textures: g.gl.info.memory.textures,
    };
  });
  frames.push({ at: actual, ...census });
  // Mid-window, take one round from close enough to read its nose.
  if (want === 4000) await closeUp();
  console.log(
    `  · +${String(actual).padStart(5)}ms  ${String(census.rounds)} in the air, ` +
      `${String(census.fires)} burning, ${String(census.mounted)} mounted  ` +
      `| ${String(census.calls)} calls, ${String(census.triangles)} triangles ` +
      `| camera ${JSON.stringify(framed)}`,
  );
}
console.log(
  'rounds seen across the window:',
  frames.reduce((n, f) => n + f.rounds, 0),
  '· fires seen:',
  frames.reduce((n, f) => n + f.fires, 0),
  '· peak calls:',
  Math.max(0, ...frames.map((frame) => frame.calls)),
);

// The worker polls; give it a beat before asking whether the battle happened.
await settle(4000);
const [report] = await sql`SELECT grade FROM battle_reports WHERE mission_id = ${mission.id}`;
console.log('battle report:', report ? report.grade : 'NONE — the engagement never resolved');

await browser.close();
await sql.end();
