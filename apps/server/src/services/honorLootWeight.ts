import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isSupportedHonorVersion } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { honorSeasons, seasons } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { isSilentSpaceShard } from './waitingRoom.js';

/** Explicit same-season cutover. Season UPDATE orders existing launch SHARE locks;
 * immutable commitments, evidence, scores and earned budgets are never rewritten. */
export async function enableHonorLootWeight(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  const seasonId = z.string().uuid().parse(input.seasonId);
  return db.transaction(async tx => {
    const query = tx.select().from(seasons).where(eq(seasons.id, seasonId));
    const [season] = input.apply ? await query.for('update') : await query;
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt !== null || now < season.startsAt
      || now >= season.endsAt || await isSilentSpaceShard(tx, season.shardId)) {
      throw new Error('Honor loot cutover requires an open main season');
    }
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    if (config?.closedAt !== null) throw new Error('Honor loot cutover requires an open Honor configuration');
    if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
    const applied = input.apply && config.retaliationLootPercent !== 40;
    if (applied) {
      await tx.update(honorSeasons).set({ retaliationLootPercent: 40 }).where(eq(honorSeasons.seasonId, seasonId));
      await publishShard(tx, seasonId, 'season');
    }
    return { seasonId, applied, previousPercent: config.retaliationLootPercent, retaliationLootPercent: 40 as const,
      status: config.retaliationLootPercent === 40 ? 'ALREADY_ACTIVE' as const : 'READY' as const };
  }, input.apply ? undefined : { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
