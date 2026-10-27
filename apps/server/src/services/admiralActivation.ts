import { eq } from 'drizzle-orm';
import { admiralApplies } from '@astera/rules/arena';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { seasons } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';

/**
 * Explicit live-season cutover for commander ship escorts (owner 2026-10-26): open from one
 * instant, never a ruleset bump. A season dealt them (`ADMIRAL_RULESET`) needs nothing.
 */
export async function activateAdmiral(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt) {
      throw new GameError('SEASON_FROZEN', 'An open live season is required', 409);
    }
    if (admiralApplies(season.rulesetVersion)) return { status: 'DEALT' as const, applied: false, startsAt: season.startsAt };
    if (season.admiralStartsAt) return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: season.admiralStartsAt };
    if (!input.apply) return { status: 'READY' as const, applied: false, startsAt: null };
    await tx.update(seasons).set({ admiralStartsAt: now }).where(eq(seasons.id, season.id));
    await publishShard(tx, season.id, 'world');
    return { status: 'ACTIVATED' as const, applied: true, startsAt: now };
  });
}
