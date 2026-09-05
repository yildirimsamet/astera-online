import { and, eq, ilike, inArray, sql } from 'drizzle-orm';
import {
  BUILDING_IDS,
  PLANET_START,
  START_BUILDINGS,
  generateGalaxy,
  pickSpawnSlot,
} from '@astera/rules';
import { createDb } from '../db/client.js';
import {
  accounts,
  buildings,
  planets,
  players,
  seasons,
  shards,
} from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { systemClock } from '../clock.js';
import { recomputeWealth } from '../services/planet.js';
import { planetNameFor } from '../services/player.js';
import { refreshSensorEpoch } from '../services/sensorHistory.js';
import { hashPassword } from '../auth/password.js';

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

const TARGET_PLANET_COUNT = 150;
const ALLOWED_CORE_LEVELS = [3, 5, 7, 9, 12, 15] as const;

function getRandomCoreLevel(): number {
  const index = Math.floor(Math.random() * ALLOWED_CORE_LEVELS.length);
  return ALLOWED_CORE_LEVELS[index];
}

const STARTING_BUILDINGS = BUILDING_IDS.map((type) => ({
  type,
  level: START_BUILDINGS[type],
}));

try {
  // 1. Find EU-1 shard
  const [shard] = await db
    .select()
    .from(shards)
    .where(ilike(shards.code, 'EU-1'));

  if (!shard) {
    console.error('No shard found with code EU-1');
    process.exit(1);
  }

  // 2. Find live season for EU-1
  const [season] = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.shardId, shard.id), eq(seasons.status, 'live')));

  if (!season) {
    console.error('No live season found for EU-1 shard');
    process.exit(1);
  }

  console.log(`Found EU-1 shard (${shard.code}) live season: ${season.id}`);

  // 3. Get current planets in live season
  const existingPlanets = await db
    .select()
    .from(planets)
    .where(eq(planets.seasonId, season.id));

  console.log(`Current planet count in EU-1 live season: ${existingPlanets.length}`);

  const needed = TARGET_PLANET_COUNT - existingPlanets.length;

  if (needed > 0) {
    console.log(`Adding ${needed} new planets to reach target of ${TARGET_PLANET_COUNT}...`);

    const spec = generateGalaxy(season.seed, shard.playerCap);
    const passwordHash = await hashPassword('dev-password-123');

    for (let i = 0; i < needed; i++) {
      const takenSlots = new Set(
        (await db
          .select({ slotIndex: planets.slotIndex })
          .from(planets)
          .where(eq(planets.seasonId, season.id))).map((p) => p.slotIndex),
      );

      const slot = pickSpawnSlot(spec.slots, takenSlots);
      if (!slot) {
        console.error('Galaxy is full! Cannot pick spawn slot.');
        break;
      }

      const timestamp = Date.now();
      const username = `bot_eu1_${timestamp}_${i}`;
      const displayName = `Commander ${existingPlanets.length + i + 1}`;

      await db.transaction(async (tx) => {
        // Create account
        const [account] = await tx
          .insert(accounts)
          .values({
            username,
            displayName,
            passwordHash,
          })
          .returning();

        const now = systemClock.now();

        // Create player
        const [player] = await tx
          .insert(players)
          .values({
            accountId: account!.id,
            seasonId: season.id,
            name: displayName,
            joinedAt: now,
            lastSeenAt: now,
            lastActiveAt: now,
          })
          .returning();

        const name = planetNameFor(slot.index);

        // Create planet
        const [planet] = await tx
          .insert(planets)
          .values({
            controllerPlayerId: player!.id,
            kind: 'CAPITAL',
            seasonId: season.id,
            name,
            slotIndex: slot.index,
            x: slot.x,
            y: slot.y,
            z: slot.z,
            alloy: PLANET_START.alloy,
            crystal: PLANET_START.crystal,
            deuterium: PLANET_START.deuterium,
            lastTickAt: now,
          })
          .returning();

        // Insert starting buildings
        await tx
          .insert(buildings)
          .values(STARTING_BUILDINGS.map((b) => ({ planetId: planet!.id, ...b })));

        // Set random Core level
        const coreLevel = getRandomCoreLevel();
        await tx
          .insert(buildings)
          .values({
            planetId: planet!.id,
            type: 'CORE',
            level: coreLevel,
          })
          .onConflictDoUpdate({
            target: [buildings.planetId, buildings.type],
            set: { level: coreLevel },
          });

        await refreshSensorEpoch(tx, planet!.id, now);
        await recomputeWealth(tx, planet!.id);
      });
    }

    console.log(`Successfully added ${needed} planets!`);
  } else {
    console.log(`Current planet count (${existingPlanets.length}) is already at or above target (${TARGET_PLANET_COUNT}).`);
  }

  // 4. Ensure ALL 150 planets have random Core levels assigned from [3, 5, 7, 9, 12, 15]
  const allPlanets = await db
    .select()
    .from(planets)
    .where(eq(planets.seasonId, season.id));

  console.log(`Updating/assigning Core levels for all ${allPlanets.length} planets...`);

  const counts: Record<number, number> = { 3: 0, 5: 0, 7: 0, 9: 0, 12: 0, 15: 0 };

  for (const planet of allPlanets) {
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

  console.log('\nFinal Status:');
  console.log(`Total planets in EU-1 live season: ${allPlanets.length}`);
  console.log('Core Levels distribution across all planets:');
  for (const lvl of ALLOWED_CORE_LEVELS) {
    console.log(`  Core Level ${lvl.toString().padStart(2, ' ')}: ${counts[lvl]} planets`);
  }
} finally {
  await close();
}
