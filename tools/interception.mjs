/**
 * PHOTOGRAPH A DRILL MEETING ITS ROCK, AND MEASURE THE MEETING. D43.
 *
 * The interception is the one piece of maths in the game that fails silently: a
 * craft aimed a few units wrong still flies, still arrives, and just quietly never
 * touches the asteroid it was sent to. A screenshot alone cannot settle it either —
 * "they look close" is not a measurement — so this reads BOTH world positions out
 * of the live scene at the meeting instant and prints the gap between them.
 *
 *   DATABASE_URL=... WEB=http://localhost:5174 node tools/interception.mjs out/intercept
 *
 * HOW IT GETS TO THE MEETING WITHOUT WAITING FOR IT. Everything about a rock is a
 * function of `now - season.startsAt`, and a mining run is two absolute timestamps.
 * Move the season's start and the run's two timestamps back by the SAME amount and
 * every relationship is preserved exactly: at the new arrival the rock has the same
 * phase it would have had at the old one. Shifting only the run — the obvious
 * thing — would move the craft and leave the rock behind, and would photograph a
 * miss that the game does not actually have.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const fromServer = createRequire(new URL('../apps/server/package.json', import.meta.url));
const postgres = (await import(fromServer.resolve('postgres'))).default;

const WEB = process.env.WEB ?? 'http://localhost:5174';
const OUT = process.argv[2] ?? 'out/intercept';
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error('set DATABASE_URL');

/** How long after the reload the craft should meet its rock. */
const LEAD_SECONDS = Number(process.env.LEAD ?? 30);

await mkdir(OUT, { recursive: true });
const sql = postgres(DB, { max: 4 });

const browser = await chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});
const page = await browser.newPage({ viewport: { width: 760, height: 660 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));

const settle = (ms) => page.waitForTimeout(ms);

const NAME = `miner${String(Date.now()).slice(-8)}`;
console.log(`opening ${WEB} as ${NAME}`);
await page.bringToFront();
await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /^take a planet$/i }).first().waitFor({ timeout: 60_000 });
await page.getByRole('button', { name: /^take a planet$/i }).first().click();
await page.getByLabel(/commander name/i).fill(NAME);
await page.getByLabel(/password/i).fill('correct-horse-battery');
await page.getByRole('button', { name: /create commander/i }).click();
const open = page.getByRole('button', { name: /^(join|enter)$/i }).first();
await open.waitFor({ timeout: 40_000 });
await open.click();
await page.waitForSelector('canvas', { timeout: 60_000 });
await settle(3500);

const mine = await page.evaluate(async () => {
  const galaxy = await window.__api.galaxy();
  return galaxy.planets.find((p) => p.isSelf).id;
});

// Two craft and the bays to fly them. Straight into the database — this is a
// camera rig, not a playthrough.
await sql`UPDATE buildings SET level = 9 WHERE planet_id = ${mine} AND type = 'CORE'`;
await sql`
  INSERT INTO units (planet_id, hull, location, count) VALUES (${mine}, 'PROSPECTOR', 'home', 2)
  ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = 2
`;

/** The richest rock in the disc — the one a player would actually pick. */
const launched = await page.evaluate(async () => {
  const field = await window.__api.mining();
  const rock = [...field.asteroids].sort((a, b) => b.level - a.level)[0];
  if (!rock) return null;
  const run = await window.__api.mine(rock.index, 2);
  return { index: rock.index, level: rock.level, flightMinutes: run.flightMinutes, intercept: run.intercept };
});
if (!launched) throw new Error('no rock in the disc to aim at');
console.log(
  `aimed at rock ${String(launched.index)} (level ${String(launched.level)}), ` +
    `flight ${launched.flightMinutes.toFixed(2)} min`,
);

/* ── bring the meeting forward, rock and craft together ─────── */

const [run] = await sql`
  SELECT id, season_id, depart_at, arrive_at, asteroid_index, intercept_x, intercept_y, intercept_z
  FROM mining_runs WHERE planet_id = ${mine} AND status = 'outbound'
  ORDER BY depart_at DESC LIMIT 1
`;

const meetAt = new Date(Date.now() + LEAD_SECONDS * 1000);
const shiftMs = run.arrive_at.getTime() - meetAt.getTime();
await sql`UPDATE seasons SET starts_at = starts_at - ${`${String(shiftMs)} milliseconds`}::interval WHERE id = ${run.season_id}`;
await sql`
  UPDATE mining_runs
  SET depart_at = depart_at - ${`${String(shiftMs)} milliseconds`}::interval,
      arrive_at = arrive_at - ${`${String(shiftMs)} milliseconds`}::interval
  WHERE id = ${run.id}
`;
await sql`
  UPDATE scheduled_events SET resolve_at = resolve_at - ${`${String(shiftMs)} milliseconds`}::interval
  WHERE ref_id = ${run.id}
`;
console.log(`meeting brought forward by ${(shiftMs / 60_000).toFixed(2)} min → ${meetAt.toISOString()}`);

/* ── watch them meet ────────────────────────────────────────── */

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60_000 });
await page.waitForFunction(
  () => {
    const g = window.__galaxy;
    if (!g) return false;
    let ok = false;
    g.scene.traverse((o) => {
      if (o.name === 'mining') ok = true;
    });
    return ok;
  },
  { timeout: 60_000 },
);

/**
 * Frame the craft and read both positions.
 *
 * The rock is drawn from an INSTANCED mesh, so its position is a matrix rather
 * than an object — read straight off the instance matrix, which is the same number
 * the renderer used. Asking the API where the rock is would be asking a different
 * question with a different clock in it.
 */
const measure = async (rockIndex) =>
  page.evaluate(
    ([index]) => {
      const g = window.__galaxy;
      window.__galaxy.advance?.(performance.now());
      const V = Object.getPrototypeOf(g.camera.position).constructor;
      const M = Object.getPrototypeOf(g.camera.matrix).constructor;

      let craft = null;
      const rocks = [];
      g.scene.traverse((o) => {
        if (o.name === 'mining') craft = o;
        if (o.name === 'asteroid-rocks') rocks.push(o);
      });
      if (!craft) return null;

      const at = craft.getWorldPosition(new V());

      // Every rock the field is drawing, so the nearest one can be identified.
      const found = [];
      const m = new M();
      const p = new V();
      for (const mesh of rocks) {
        for (let i = 0; i < mesh.count; i += 1) {
          mesh.getMatrixAt(i, m);
          p.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld);
          found.push({ at: [p.x, p.y, p.z], gap: p.distanceTo(at) });
        }
      }
      found.sort((a, b) => a.gap - b.gap);

      // Put the camera on the craft so the meeting is the shot.
      g.controls.target.copy(at);
      // Far enough back that the rock's own streak is not the whole frame: a
      // meeting photographed from inside the tail is a picture of a tail.
      g.camera.position.copy(at).add(new V(1.7, 1.05, 1.7));
      g.camera.lookAt(at);
      g.controls.update();

      return {
        index,
        craft: [+at.x.toFixed(4), +at.y.toFixed(4), +at.z.toFixed(4)],
        nearestRock: found[0] ? found[0].at.map((n) => +n.toFixed(4)) : null,
        gap: found[0] ? +found[0].gap.toFixed(4) : null,
        secondGap: found[1] ? +found[1].gap.toFixed(4) : null,
      };
    },
    [rockIndex],
  );

const WANT = [-20_000, -8000, -2000, -600, 0, 900, 2600];
for (const offset of WANT) {
  const at = meetAt.getTime() + offset;
  const left = at - Date.now();
  if (left < -400) {
    console.log(`  · skipped ${String(offset)}ms — the capture was already past it`);
    continue;
  }
  if (left > 0) await settle(left);

  const reading = await measure(run.asteroid_index);
  await page.evaluate(() => {
    window.__galaxy.advance?.(performance.now());
  });
  const actual = Date.now() - meetAt.getTime();
  const label = `${actual < 0 ? 'minus' : 'plus'}-${String(Math.abs(actual)).padStart(5, '0')}`;
  await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(
    `  · ${String(actual).padStart(6)}ms  drill ${JSON.stringify(reading.craft)}  ` +
      `nearest rock ${JSON.stringify(reading.nearestRock)}  gap ${String(reading.gap)} ` +
      `(next nearest ${String(reading.secondGap)})`,
  );
}

/**
 * AND THE SERVER'S OWN ANSWER, in the same units.
 *
 * The aim point was solved and stored at launch; a world unit is fifty game units
 * (`SCALE`). If the drawn meeting and the stored aim point disagree, one of the two
 * is lying and the picture cannot tell you which.
 */
console.log(
  'stored aim point (game units):',
  JSON.stringify([run.intercept_x, run.intercept_y, run.intercept_z].map((n) => +n.toFixed(2))),
);

await browser.close();
await sql.end();
