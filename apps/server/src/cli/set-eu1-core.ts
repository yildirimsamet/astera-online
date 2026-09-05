import { ilike, inArray } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { buildings, planets, seasons, shards } from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

const ALLOWED_CORE_LEVELS = [3, 5, 7, 9, 12, 15] as const;

function getRandomCoreLevel(): number {
  const index = Math.floor(Math.random() * ALLOWED_CORE_LEVELS.length);
  return ALLOWED_CORE_LEVELS[index] ?? ALLOWED_CORE_LEVELS[0];
}

try {
  // 1. Find EU-1 shard
  const eu1Shards = await db
    .select()
    .from(shards)
    .where(ilike(shards.code, 'EU-1'));

  if (eu1Shards.length === 0) {
    console.error('No shard found with code EU-1');
    process.exit(1);
  }

  const shardIds = eu1Shards.map((s) => s.id);
  console.log(`Found ${eu1Shards.length} EU-1 shard(s):`, eu1Shards.map((s) => `${s.code} (${s.name})`).join(', '));

  // 2. Find all seasons for EU-1
  const seasonRows = await db
    .select()
    .from(seasons)
    .where(inArray(seasons.shardId, shardIds));

  if (seasonRows.length === 0) {
    console.error('No seasons found for EU-1 shard');
    process.exit(1);
  }

  const seasonIds = seasonRows.map((s) => s.id);
  console.log(`Found ${seasonRows.length} season(s) for EU-1.`);

  // 3. Find all planets belonging to EU-1 seasons
  const planetRows = await db
    .select()
    .from(planets)
    .where(inArray(planets.seasonId, seasonIds));

  console.log(`Found ${planetRows.length} planet(s) in EU-1.`);

  if (planetRows.length === 0) {
    console.log('No planets to update.');
  } else {
    // 4. Update/Upsert building level for CORE for each planet
    const counts: Record<number, number> = { 3: 0, 5: 0, 7: 0, 9: 0, 12: 0, 15: 0 };

    for (const planet of planetRows) {
      const coreLevel = getRandomCoreLevel();
      counts[coreLevel] = (counts[coreLevel] ?? 0) + 1;

      await db
        .insert(buildings)
        .values({
          planetId: planet.id,
          type: 'CORE',
          level: coreLevel,
        })
        .onConflictDoUpdate({
          target: [buildings.planetId, buildings.type],
          set: { level: coreLevel },
        });
    }

    console.log('\nSuccessfully updated planet Core levels in local EU-1 server!');
    console.log('Distribution:');
    for (const lvl of ALLOWED_CORE_LEVELS) {
      console.log(`  Core Level ${lvl.toString().padStart(2, ' ')}: ${counts[lvl]} planets`);
    }
  }
} finally {
  await close();
}
