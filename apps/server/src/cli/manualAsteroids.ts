import { isDeepStrictEqual } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ASTEROID_DYNAMIC } from '@astera/rules';
import { minutesSince } from '../clock.js';
import type { Db } from '../db/client.js';
import { asteroidSpawnHours, seasons } from '../db/schema.js';
import { asteroidId, privateAsteroidHour } from '../services/asteroidField.js';
import { floorHour, hourOrdinalOf } from '../services/asteroidSpawn.js';
import { publishShard } from '../stream/bus.js';

const batchSchema = z.object({
  seasonId: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  at: z.date(),
  dryRun: z.boolean().optional(),
}).strict();

/**
 * Operator-only, owner-authorized bonus rocks. There is deliberately no HTTP route.
 * Keep the same `at` on retries: a zero-duration lane is the batch's durable marker,
 * distinct from every natural lane, and makes all of its rocks appear immediately.
 *
 * Natural lanes, their ordering, level weights and population counts remain frozen.
 * Appending consumes only NEW RNG draws and NEW offsets. Compare the entire old
 * field before writing so a future generator change cannot silently move a live
 * asteroid or orphan a Prospector that is already flying to its opaque id.
 */
export async function appendManualAsteroids(db: Db, input: z.infer<typeof batchSchema>) {
  const batch = batchSchema.parse(input);
  return db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, batch.seasonId)).for('share');
    if (season?.status !== 'live' || season.asteroidDynamicFrom === null
      || season.asteroidDynamicFrom > batch.at || season.startsAt > batch.at || season.endsAt <= batch.at) {
      throw new Error('Manual asteroids require a live dynamic season');
    }
    const hourStartsAt = floorHour(batch.at);
    const hourWhere = and(eq(asteroidSpawnHours.seasonId, season.id), eq(asteroidSpawnHours.hourStartsAt, hourStartsAt));
    const [hour] = await tx.select().from(asteroidSpawnHours).where(hourWhere).for('update');
    if (!hour) throw new Error('This hour is not opened by the worker yet');

    const atMinute = minutesSince(season.startsAt, batch.at);
    const ordinal = hourOrdinalOf(season.startsAt, hourStartsAt);
    const prior = hour.lanes.findIndex((lane) => lane.fromMinute === atMinute && lane.untilMinute === atMinute);
    if (prior >= 0 && hour.lanes[prior]?.count !== batch.count) {
      throw new Error('This manual batch already exists with a different count');
    }
    const offset = hour.lanes.slice(0, prior >= 0 ? prior : undefined).reduce((sum, lane) => sum + lane.count, 0);
    if (offset + batch.count > ASTEROID_DYNAMIC.indexSpanPerHour) throw new Error('Manual batch exceeds the hour index span');
    const original = privateAsteroidHour(season.asteroidKey, {
      hourOrdinal: ordinal, lanes: hour.lanes, levelWeights: hour.levelWeights,
    });
    const lanes = prior >= 0 ? hour.lanes : [...hour.lanes, {
      fromMinute: atMinute, untilMinute: atMinute, count: batch.count, frontCount: batch.count,
    }];
    const extended = privateAsteroidHour(season.asteroidKey, { hourOrdinal: ordinal, lanes, levelWeights: hour.levelWeights });
    if (!isDeepStrictEqual(original, extended.slice(0, original.length))) {
      throw new Error('Manual batch would change an existing asteroid');
    }
    if (prior < 0 && batch.dryRun !== true) {
      await tx.update(asteroidSpawnHours).set({ lanes }).where(hourWhere);
      await publishShard(tx, season.id, 'mining');
    }
    return {
      seasonId: season.id,
      at: batch.at.toISOString(),
      count: batch.count,
      dryRun: batch.dryRun === true,
      alreadyAdded: prior >= 0,
      asteroidIds: extended.slice(offset, offset + batch.count).map((rock) => asteroidId(season.asteroidKey, rock.index)),
    };
  });
}
