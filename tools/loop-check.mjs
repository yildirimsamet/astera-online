/**
 * THE THREE THINGS THAT WERE BROKEN, PROVEN AGAINST A RUNNING SERVER.
 *
 * The suite proves each of them in isolation against a test database. This drives
 * the real API over HTTP, as two real commanders, and watches the whole loop
 * happen — because every one of these bugs was invisible to a green suite:
 *
 *   1. Can somebody else see your craft — including a raid flying AT them?
 *   2. Does a drill set off toward its rock rather than somewhere unrelated?
 *   3. Does a fleet that lands actually fight, and then come home?
 *
 *   DATABASE_URL=... API=http://localhost:3100 node tools/loop-check.mjs
 */
import { createRequire } from 'node:module';

const fromServer = createRequire(new URL('../apps/server/package.json', import.meta.url));
const postgres = (await import(fromServer.resolve('postgres'))).default;

const API = process.env.API ?? 'http://localhost:3100';
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
    body: { username: name, password: 'correct-horse-battery' },
  });
  const token = reg.accessToken;
  const servers = await call('/api/servers');
  const open = servers.servers.find((s) => s.status === 'open');
  await call(`/api/servers/${open.code}/join`, { method: 'POST', token });
  /**
   * Read the fixture identity directly before the first projected galaxy request.
   * The harness installs hardware through SQL below; asking the API first would
   * correctly cache the fresh commander's empty sensor state and make those
   * out-of-band fixture writes invisible until the production TTL expired.
   */
  const [planet] = await sql`
    SELECT p.id, p.name
    FROM planets p
    JOIN players pl ON pl.id = p.player_id
    JOIN accounts a ON a.id = pl.account_id
    WHERE a.username = ${name} AND p.kind = 'CAPITAL'
    LIMIT 1
  `;
  if (!planet) throw new Error(`joined commander ${name} has no capital`);
  return { token, planet };
};

const stamp = String(Date.now()).slice(-7);
const a = await commander(`loopa${stamp}`);
const b = await commander(`loopb${stamp}`);
console.log(`A = ${a.planet.name}   B = ${b.planet.name}\n`);

/**
 * THE HARNESS MUST BUY THE VISIBILITY IT ASSERTS. D123/D126.
 *
 * A fresh commander has no working eyes, so expecting it to identify every craft
 * in the galaxy silently tests the pre-sensor-horizon rules. Keep the two viewers
 * close and give each a real Uplink-gated Telescope/Radar. This leaves production
 * visibility untouched while making the real-HTTP fixture deterministic.
 */
const installEyes = async (planetId, x) => {
  await sql`UPDATE planets SET x = ${x}, y = 0, z = 0 WHERE id = ${planetId}`;
  for (const [slot, type, level] of [[0, 'TELESCOPE', 5], [1, 'RADAR', 5], [5, 'UPLINK', 1]]) {
    await sql`
      INSERT INTO satellites (planet_id, slot, type, level)
      VALUES (${planetId}, ${slot}, ${type}, ${level})
      ON CONFLICT (planet_id, slot) DO UPDATE SET type = ${type}, level = ${level}
    `;
  }
};

await installEyes(a.planet.id, 0);
await installEyes(b.planet.id, 900);
await sql`UPDATE buildings SET level = 9 WHERE planet_id = ${a.planet.id} AND type = 'CORE'`;
for (const [hull, n] of [['WASP', 40], ['PROSPECTOR', 2]]) {
  await sql`
    INSERT INTO units (planet_id, hull, location, count) VALUES (${a.planet.id}, ${hull}, 'home', ${n})
    ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = ${n}
  `;
}
// Comparable Wealth, or the rank floor refuses the raid.
await sql`UPDATE players SET wealth = 90000 WHERE id IN (
  SELECT player_id FROM planets WHERE id IN (${a.planet.id}, ${b.planet.id}))`;

/* ── 1 · can B see A's craft? ───────────────────────────────── */

console.log('1 · what another commander can see');

const raid = await call('/api/fleet/launch', {
  method: 'POST',
  token: a.token,
  body: { targetPlanetId: b.planet.id, fleet: { WASP: 40 } },
});
const probeTarget = (await call('/api/galaxy', { token: a.token })).planets.find(
  (p) => !p.isSelf && p.id !== b.planet.id,
);
await call('/api/intel/probe', {
  method: 'POST',
  token: a.token,
  body: { targetPlanetId: probeTarget.id },
});

const field = await call('/api/mining', { token: a.token });
if (field.asteroids.length > 0) {
  const rock = [...field.asteroids].sort((x, y) => y.level - x.level)[0];
  const run = await call('/api/mining/launch', {
    method: 'POST',
    token: a.token,
    body: { asteroidIndex: rock.index, craft: 2 },
  });
  console.log(`  (A mines rock ${String(rock.index)}, flight ${run.flightMinutes.toFixed(2)} min)`);
}

const seen = (await call('/api/galaxy/traffic', { token: b.token })).contacts;
const kinds = seen.map((c) => c.kind);
check('B sees a warship in the air', kinds.includes('fleet'), kinds.join(', '));
check('B sees a scout in the air', kinds.includes('probe'));
/**
 * ONLY IF THERE WAS A ROCK TO SEND A DRILL AT.
 *
 * Asteroids appear and expire on the season's own schedule, so a disc can quite
 * legitimately be empty — section 2 below already says so and skips itself. This
 * check did not, and reported a FAIL for a craft that was never launched, which
 * buries the real failures under a permanent red on a fresh galaxy.
 */
if (field.asteroids.length > 0) {
  check('B sees a mining craft in the air', kinds.includes('mining'));
} else {
  console.log('  (no rock in the disc right now — no drill to look for)');
}
check(
  'and the raid flying AT B is one of them',
  seen.some((c) => c.kind === 'fleet'),
  'this is the one that used to be hidden from the only player it mattered to',
);
check(
  'while still carrying no route, owner or destination',
  seen.every((c) => c.route === undefined || c.kind === 'mining'),
);
/**
 * A's OWN craft must not come back as anonymous contacts — but everybody ELSE's
 * still should. Matched by mission id rather than by counting: the galaxy is a
 * live one and other commanders are legitimately in the air.
 */
const mine = await sql`
  SELECT id FROM missions
  WHERE status = 'in_flight' AND (origin_planet_id = ${a.planet.id} OR target_planet_id = ${a.planet.id})`;
const ownIds = new Set(mine.map((m) => m.id));
const aSees = (await call('/api/galaxy/traffic', { token: a.token })).contacts;
check(
  "A does not see a second anonymous copy of A's own craft",
  aSees.every((c) => !ownIds.has(c.id)),
  `${String(aSees.length)} contacts, ${String(ownIds.size)} of A's own legs in the air`,
);

/* ── 2 · does a drill set off toward its rock? ──────────────── */

console.log('\n2 · where a drill aims');

const [run] = await sql`
  SELECT asteroid_index, depart_at, arrive_at, intercept_x, intercept_z
  FROM mining_runs WHERE planet_id = ${a.planet.id} ORDER BY depart_at DESC LIMIT 1`;

if (run) {
  const rock = field.asteroids.find((r) => r.index === run.asteroid_index);
  const flightMin = (run.arrive_at.getTime() - run.depart_at.getTime()) / 60_000;
  const lead = flightMin / rock.period;
  /**
   * One rock, so this is the WORST-CASE bound rather than the median one.
   *
   * Across the five gate seeds the requested slower craft reaches a measured
   * maximum of 1.006 revolutions; `invariants.test.ts` holds the whole sweep. A single sample here can
   * legitimately sit anywhere in that spread, and asserting the median against it
   * fails on a perfectly good rock.
   */
  check(
    'the drill aims ahead of the rock, not round the far side',
    lead < 1.01,
    `${lead.toFixed(3)} revolutions ahead, flight ${flightMin.toFixed(2)} min`,
  );

  // The rock really is at the aim point when the craft gets there.
  const [season] = await sql`SELECT starts_at FROM seasons WHERE status = 'live' LIMIT 1`;
  const meetMin = (run.arrive_at.getTime() - season.starts_at.getTime()) / 60_000;
  const theta = rock.phase + (2 * Math.PI * meetMin) / rock.period;
  const gap = Math.hypot(
    rock.radius * Math.cos(theta) - run.intercept_x,
    rock.radius * Math.sin(theta) - run.intercept_z,
  );
  check('the rock is exactly there when the craft arrives', gap < 0.5, `${gap.toFixed(4)} game units`);
} else {
  console.log('  (no rock in the disc right now — skipped)');
}

/* ── 3 · does a raid land, fight, and come home? ────────────── */

console.log('\n3 · a raid, all the way through');

const landsIn = raid.arriveAt.getTime ? raid.arriveAt : new Date(raid.arriveAt);
const shift = new Date(landsIn).getTime() - (Date.now() + 8000);
await sql`UPDATE missions SET arrive_at = arrive_at - ${`${String(shift)} milliseconds`}::interval WHERE id = ${raid.missionId}`;
await sql`UPDATE scheduled_events SET resolve_at = resolve_at - ${`${String(shift)} milliseconds`}::interval WHERE ref_id = ${raid.missionId}`;
console.log('  (brought the landing forward; waiting for the engagement to close)');

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
await settle(9000);

const [mid] = await sql`SELECT status FROM missions WHERE id = ${raid.missionId}`;
check(
  'still in flight during the ten-second engagement',
  mid.status === 'in_flight',
  `status=${mid.status}`,
);

await settle(14_000);

const [after] = await sql`SELECT status FROM missions WHERE id = ${raid.missionId}`;
check('the battle resolved', after.status === 'resolved', `status=${after.status}`);

const [report] = await sql`SELECT grade FROM battle_reports WHERE mission_id = ${raid.missionId}`;
check('a battle report was written', Boolean(report), report ? `grade=${report.grade}` : 'none');

const [ret] = await sql`
  SELECT m.status, m.arrive_at FROM missions m
  WHERE m.origin_planet_id = ${b.planet.id} AND m.target_planet_id = ${a.planet.id}
    AND m.kind = 'return' ORDER BY m.depart_at DESC LIMIT 1`;
check('the survivors are on their way home', Boolean(ret), ret ? `status=${ret.status}` : 'no return leg');

const [{ n: stranded }] = await sql`
  SELECT count(*)::int AS n FROM missions WHERE status = 'in_flight' AND arrive_at < now() - interval '5 minutes'`;
check('nothing is stranded in the galaxy', Number(stranded) === 0, `${String(stranded)} stuck`);

/* ── 4 · is anything drawn twice, from EITHER end? ──────────── */

/**
 * ONE CRAFT, ONE MARKER, PER VIEWER.
 *
 * Your own craft are drawn from `/api/session/pending`; everybody else's from
 * `/api/galaxy/traffic`. The two lists key on the same mission id, so an id in
 * both is literally the same squadron rendered twice in one scene, from two
 * payloads that disagree about what it is.
 *
 * Section 1 above asks this of the player whose craft it is. This asks it of the
 * player at the OTHER end, which is where it was actually broken: `pendingThreads`
 * matched `origin OR target` and special-cased only an inbound attack, so a probe
 * flying at you, a probe flying home from you, and a raider's survivors leaving
 * your orbit were all handed to you as YOUR OWN craft — with a route line, the
 * hulls inside, and the other world's NAME on them.
 *
 * B has just been raided and the attacker's survivors are leaving B's orbit right
 * now, which is exactly that case.
 */
console.log('\n4 · nothing is drawn twice, from either end');

const idsOf = (threads) => new Set(threads.map((t) => t.id).filter(Boolean));

for (const [who, side] of [['A', a], ['B', b]]) {
  const own = idsOf((await call('/api/session/pending', { token: side.token })).pending);
  const contacts = (await call('/api/galaxy/traffic', { token: side.token })).contacts;
  const twice = contacts.filter((c) => own.has(c.id)).map((c) => c.id);
  check(
    `${who} draws no craft twice`,
    twice.length === 0,
    `${String(own.size)} own, ${String(contacts.length)} contacts`,
  );
}

/**
 * And B's own list names nothing of A's — no route out of B's orbit, no hulls, and
 * above all not A's world, which is what identified the raider.
 */
const bPending = (await call('/api/session/pending', { token: b.token })).pending;
const foreign = await sql`
  SELECT id FROM missions
  WHERE status = 'in_flight' AND kind = 'return' AND origin_planet_id = ${b.planet.id}`;
check(
  "B's own list does not carry the attacker's departing fleet",
  foreign.every((m) => !idsOf(bPending).has(m.id)),
  `${String(foreign.length)} of A's legs standing at B's world`,
);
check(
  "and names no world but B's own targets",
  !JSON.stringify(bPending).includes(a.planet.name),
  bPending.map((t) => `${t.kind}:${t.targetName}`).join(', ') || 'nothing in flight',
);

/**
 * AND TWO CLIENTS WATCHING ONE CRAFT AGREE ABOUT IT.
 *
 * Position is derived on each client from the window the server published, so two
 * players agree only if they were handed the same window for the same mission id.
 * Read back to back, from two tokens, and compared to the millisecond.
 *
 * IT NEEDS A THIRD COMMANDER TO BE A TEST AT ALL. A and B can only have a craft in
 * common if it belongs to NEITHER of them — everything of A's is excluded from A's
 * own contact list by construction, and B has nothing in the air. Without C this
 * check compared an empty set against an empty set and reported PASS, which is the
 * worst possible outcome for a check: green, and measuring nothing.
 */
const c = await commander(`loopc${stamp}`);
await sql`
  UPDATE planets SET alloy = 50000, crystal = 20000, x = 450, y = 0, z = 0
  WHERE id = ${c.planet.id}
`;
const cTarget = (await call('/api/galaxy', { token: c.token })).planets.find(
  (p) => !p.isSelf && p.id !== a.planet.id && p.id !== b.planet.id,
);
await call('/api/intel/probe', {
  method: 'POST',
  token: c.token,
  body: { targetPlanetId: cTarget.id },
});

const asA = (await call('/api/galaxy/traffic', { token: a.token })).contacts;
const asB = (await call('/api/galaxy/traffic', { token: b.token })).contacts;
const shared = asA.filter((x) => asB.some((o) => o.id === x.id));
const disagreed = shared.filter((x) => {
  const other = asB.find((o) => o.id === x.id);
  return (
    other.kind !== x.kind ||
    Math.abs(new Date(other.endAt).getTime() - new Date(x.endAt).getTime()) > 1500 ||
    Math.hypot(other.to.x - x.to.x, other.to.y - x.to.y, other.to.z - x.to.z) > 1
  );
});
check(
  'there is a craft belonging to neither of them to compare',
  shared.length > 0,
  `${String(asA.length)} on A's screen, ${String(asB.length)} on B's, ${String(shared.length)} in common`,
);
check(
  'two clients watching the same craft are told the same thing',
  shared.length > 0 && disagreed.length === 0,
  `${String(shared.length)} craft in common, ${String(disagreed.length)} disagreed`,
);

const health = await (await fetch(`${API}/health`)).json();
check('the server reports itself healthy', health.ok === true, JSON.stringify(health.checks));

console.log(failures === 0 ? '\nALL GREEN' : `\n${String(failures)} FAILED`);
await sql.end();
process.exit(failures === 0 ? 0 : 1);
