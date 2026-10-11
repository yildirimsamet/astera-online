import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { pirateActive } from '@astera/rules';
import { minutesSince } from '../clock.js';
import type { Db } from '../db/client.js';
import { pirateRaids, pirateState, seasons } from '../db/schema.js';
import { loadPirateSnapshot, pirateId } from '../services/pirateField.js';
import { publishShard } from '../stream/bus.js';

const inputSchema = z.object({
  seasonId: z.string().uuid(),
  pirateIds: z.array(z.string().min(1)).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate pirate ids'),
  now: z.date(),
  dryRun: z.boolean().default(true),
}).strict();

/** Owner-only removal: retire opaque targets without combat rewards or rerolling the lane. */
export async function removePirates(db: Db, input: z.input<typeof inputSchema>) {
  const batch = inputSchema.parse(input);
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '1500ms'`);
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, batch.seasonId)).for('update');
    if (season?.status !== 'live' || season.endsAt <= batch.now) throw new Error('Removal requires a live season');
    const snapshot = await loadPirateSnapshot(tx, season.id, batch.now);
    const byId = new Map(snapshot.pirates.map(pirate => [pirateId(snapshot.key, pirate.index), pirate]));
    const targets = batch.pirateIds.map(id => {
      const pirate = byId.get(id);
      if (!pirate || !pirateActive(pirate, minutesSince(snapshot.startsAt, batch.now))) {
        throw new Error('Unknown or inactive pirate');
      }
      return pirate;
    });
    const [raid] = await tx.select({ id: pirateRaids.id }).from(pirateRaids).where(and(
      eq(pirateRaids.seasonId, season.id), inArray(pirateRaids.pirateIndex, targets.map(pirate => pirate.index)),
      inArray(pirateRaids.status, ['outbound', 'returning']),
    )).limit(1);
    if (raid) throw new Error('A requested pirate has an active raid');
    const fresh = targets.filter(pirate => snapshot.destroyedAt(pirate.index) === null);
    const visibleBefore = snapshot.standing(batch.now).length;
    if (!batch.dryRun && fresh.length) {
      await tx.insert(pirateState).values(fresh.map(pirate => ({
        seasonId: season.id, index: pirate.index, losses: {}, destroyedAt: batch.now, updatedAt: batch.now,
      }))).onConflictDoUpdate({
        target: [pirateState.seasonId, pirateState.index],
        set: { destroyedAt: batch.now, updatedAt: batch.now },
      });
      await publishShard(tx, season.id, 'pirate');
    }
    return { seasonId: season.id, dryRun: batch.dryRun, removing: fresh.length,
      alreadyRemoved: targets.length - fresh.length, visibleBefore, visibleAfter: visibleBefore - fresh.length,
      pirateIds: batch.pirateIds };
  });
}
