/**
 * A MOON FOR THE PLAYTEST (Ay plan §6.23, review B4). Stage and local only; production refuses.
 *
 *   pnpm --filter @astera/server exec tsx src/cli/grant-moon.ts --world <name> --rarity LEGENDARY
 */
import { parseArgs } from 'node:util';
import { and, eq, ilike } from 'drizzle-orm';
import { MOON_RARITIES, type MoonRarity } from '@astera/rules';
import { systemClock } from '../clock.js';
import { createDb } from '../db/client.js';
import { planets, seasons } from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { placeStageMoon, stageMoonToolAllowed } from '../services/moonStage.js';

loadDotEnv();
const env = loadEnv();
if (!stageMoonToolAllowed(env)) {
  console.error('Refusing: grant-moon runs on stage or local only.');
  process.exit(1);
}
const { values } = parseArgs({ options: { world: { type: 'string' }, rarity: { type: 'string', default: 'COMMON' } } });
const rarity = MOON_RARITIES.find((r) => r === values.rarity.toUpperCase());
if (!values.world || !rarity) {
  console.error(`Usage: --world <name> --rarity ${MOON_RARITIES.join('|')}`);
  process.exit(1);
}
const chosen: MoonRarity = rarity;
const { db, close } = createDb(env.DATABASE_URL);
try {
  const found = await db.select({ id: planets.id, name: planets.name }).from(planets)
    .innerJoin(seasons, eq(seasons.id, planets.seasonId))
    .where(and(ilike(planets.name, values.world), eq(seasons.status, 'live')));
  if (found.length !== 1) {
    console.error(`Expected one live world named "${values.world}", found ${found.length}.`);
    process.exitCode = 1;
  } else {
    await placeStageMoon(db, found[0]!.id, chosen, systemClock);
    console.log(`A ${chosen} moon now orbits ${found[0]!.name}.`);
  }
} finally {
  await close();
}
