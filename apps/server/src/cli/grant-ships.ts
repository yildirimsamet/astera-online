import { and, eq, ilike } from 'drizzle-orm';
import { ALL_HULLS, type HullId } from '@astera/rules';
import { createDb } from '../db/client.js';
import { accounts, planets, players, units } from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { recomputeWealth } from '../services/planet.js';

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

const TARGET_USERNAME = 'johnnylesh';

try {
  // 1. Find account
  const [account] = await db
    .select()
    .from(accounts)
    .where(ilike(accounts.username, TARGET_USERNAME));

  if (!account) {
    console.error(`Account not found for username "${TARGET_USERNAME}"`);
    process.exit(1);
  }

  // 2. Find player in active season
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.accountId, account.id));

  if (!player) {
    console.error(`No player found for account "${TARGET_USERNAME}"`);
    process.exit(1);
  }

  // 3. Find primary planet for player
  const [planet] = await db
    .select()
    .from(planets)
    .where(eq(planets.controllerPlayerId, player.id));

  if (!planet) {
    console.error(`No controlled planet found for player "${TARGET_USERNAME}"`);
    process.exit(1);
  }

  console.log(`Granting 1 unit of each ship type to ${account.username} on planet ${planet.name} (${planet.id})...`);

  await db.transaction(async (tx) => {
    for (const hull of ALL_HULLS) {
      // Check existing count
      const [existing] = await tx
        .select()
        .from(units)
        .where(
          and(
            eq(units.planetId, planet.id),
            eq(units.hull, hull),
            eq(units.location, 'home'),
          ),
        );

      const nextCount = (existing?.count ?? 0) + 1;

      await tx
        .insert(units)
        .values({
          planetId: planet.id,
          ownerPlayerId: player.id,
          hull: hull as HullId,
          location: 'home',
          count: nextCount,
        })
        .onConflictDoUpdate({
          target: [units.planetId, units.hull, units.location],
          set: {
            ownerPlayerId: player.id,
            count: nextCount,
          },
        });
    }

    await recomputeWealth(tx, planet.id);
  });

  console.log(`Successfully added 1 of every ship type to ${account.username}!`);
  console.log('Ships granted:');
  for (const h of ALL_HULLS) {
    console.log(`  - ${h}: +1`);
  }
} finally {
  await close();
}
