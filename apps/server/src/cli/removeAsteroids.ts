import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { asteroidActive } from '@astera/rules';
import { minutesSince } from '../clock.js';
import type { Db } from '../db/client.js';
import { asteroidClaims, miningRuns, seasons } from '../db/schema.js';
import { asteroidId } from '../services/asteroidField.js';
import { loadMiningSnapshot, projectVisibleAsteroids } from '../services/mining.js';
import { publishShard } from '../stream/bus.js';

const inputSchema = z.object({
  seasonId: z.string().uuid(),
  asteroidIds: z.array(z.string().min(1)).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate asteroid ids'),
  now: z.date(),
  dryRun: z.boolean().default(true),
}).strict();

/** Owner-only removal: persist depletion, retaining every generated index and orbit. */
export async function removeAsteroids(db: Db, input: z.input<typeof inputSchema>) {
  const batch = inputSchema.parse(input);
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '1500ms'`);
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, batch.seasonId)).for('update');
    if (season?.status !== 'live' || season.endsAt <= batch.now) throw new Error('Removal requires a live season');
    const snapshot = await loadMiningSnapshot(tx, season.id, batch.now);
    const byId = new Map(snapshot.asteroids.map(rock => [asteroidId(snapshot.asteroidKey, rock.index), rock]));
    const targets = batch.asteroidIds.map(id => {
      const rock = byId.get(id);
      if (!rock || !asteroidActive(rock, minutesSince(snapshot.startsAt, batch.now))) {
        throw new Error('Unknown or inactive asteroid');
      }
      return rock;
    });
    const [flight] = await tx.select({ id: miningRuns.id }).from(miningRuns).where(and(
      eq(miningRuns.seasonId, season.id), inArray(miningRuns.asteroidIndex, targets.map(rock => rock.index)),
      inArray(miningRuns.status, ['outbound', 'returning']),
    )).limit(1);
    if (flight) throw new Error('A requested asteroid has active mining');
    const fresh = targets.filter(rock => (snapshot.oreTaken.get(rock.index) ?? 0) < rock.ore);
    const visibleBefore = projectVisibleAsteroids(snapshot, batch.now).length;
    if (!batch.dryRun && fresh.length) {
      await tx.insert(asteroidClaims).values(fresh.map(rock => ({
        seasonId: season.id, index: rock.index, oreTaken: rock.ore, updatedAt: batch.now,
      }))).onConflictDoUpdate({
        target: [asteroidClaims.seasonId, asteroidClaims.index],
        set: { oreTaken: sql`greatest(${asteroidClaims.oreTaken}, excluded.ore_taken)`, updatedAt: batch.now },
      });
      await publishShard(tx, season.id, 'mining');
    }
    return { seasonId: season.id, dryRun: batch.dryRun, removing: fresh.length,
      alreadyRemoved: targets.length - fresh.length, visibleBefore, visibleAfter: visibleBefore - fresh.length,
      asteroidIds: batch.asteroidIds };
  });
}
