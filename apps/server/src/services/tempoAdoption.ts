import { and, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { pirateRaids, seasons, tradeRuns } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';

/** Run during the coordinated deployment with old API/worker writers stopped. */
export async function activateTempoSlowdown(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    // Dispatch holds SHARE on this same season row, so the blocker check is atomic with new launches.
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt) {
      throw new GameError('SEASON_FROZEN', 'An open season is required for tempo activation', 409);
    }
    const empty = { pirateRaids: 0, tradeRuns: 0 };
    if (season.tempoStartsAt) {
      return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: season.tempoStartsAt, ...empty };
    }
    const raids = await tx.select({ id: pirateRaids.id }).from(pirateRaids).where(and(
      eq(pirateRaids.seasonId, season.id), inArray(pirateRaids.status, ['outbound', 'returning']),
    ));
    const convoys = await tx.select({ id: tradeRuns.id }).from(tradeRuns).where(and(
      eq(tradeRuns.seasonId, season.id), inArray(tradeRuns.status, ['outbound', 'returning']),
    ));
    const counts = { pirateRaids: raids.length, tradeRuns: convoys.length };
    if (raids.length || convoys.length) return { status: 'BUSY' as const, applied: false, startsAt: now, ...counts };
    if (input.apply) {
      // The epoch retires pre-cutover NPC handles without deleting reports, ledgers or calendar rows.
      await tx.update(seasons).set({ tempoStartsAt: now }).where(eq(seasons.id, season.id));
      await publishShard(tx, season.id, 'control');
      await publishShard(tx, season.id, 'galaxy-event');
    }
    return { status: 'READY' as const, applied: input.apply, startsAt: now, ...counts };
  });
}
