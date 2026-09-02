import { eq } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { planets, seasons } from '../db/schema.js';
import { privatePirateField } from '../services/pirateField.js';
import { activePirates, piratePosition, distance, SENSOR } from '@astera/rules';

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const planetId = process.argv[2]!;
try {
  const [world] = await db.select().from(planets).where(eq(planets.id, planetId));
  const [season] = await db.select().from(seasons).where(eq(seasons.id, world!.seasonId));
  const field = privatePirateField(season!.asteroidKey);
  const now = Date.now();
  const nowMin = (now - season!.startsAt.getTime()) / 60_000;
  console.log(`world ${world!.name} at (${world!.x.toFixed(0)}, ${world!.y.toFixed(0)}, ${world!.z.toFixed(0)})`);
  console.log(`season minute ${nowMin.toFixed(1)} · lane ${field.length} pirates · naked eye ${SENSOR.baseRadius}`);
  const live = activePirates(field, nowMin);
  console.log(`alive right now: ${live.length}`);
  const near = live
    .map((s) => ({ s, d: distance(world!, piratePosition(s, nowMin)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  for (const { s, d } of near) console.log(`  L${s.level} idx ${s.index}  ${d.toFixed(0)} units away`);
  // When does the next one cross into the naked eye?
  for (let ahead = 0; ahead < 240; ahead += 0.5) {
    const t = nowMin + ahead;
    for (const s of activePirates(field, t)) {
      if (distance(world!, piratePosition(s, t)) <= SENSOR.baseRadius) {
        console.log(`\nnext inside the naked eye: L${s.level} idx ${s.index} in ${ahead.toFixed(1)} min`);
        process.exit(0);
      }
    }
  }
  console.log('\nnone within four hours');
} finally {
  await close();
}
