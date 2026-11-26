import { eq, inArray } from 'drizzle-orm';
import { synthesisEnabled } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { moons, planets, seasons, shards } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { syncMissingFixedOccurrences } from './galaxyEvents.js';
import { GameError } from './planet.js';

/*
  ASTERYUM ARRIVES IN A LIVE SEASON (plan 2026-11-24 K12). One explicit instant, never a ruleset bump, as
  moons did: the season gains the laboratory; every moon starts making Asteryum from this instant, so
  nothing is minted for the days before it; and the Asteryum Fırtınası joins the calendar from its next
  window, through the same fixed-window append every live calendar change uses.
*/
export async function activateSynthesis(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt) {
      throw new GameError('SEASON_FROZEN', 'An open live season is required', 409);
    }
    const [shard] = await tx.select({ role: shards.role }).from(shards).where(eq(shards.id, season.shardId));
    if (shard?.role !== 'MAIN') throw new GameError('SYNTHESIS_DISABLED', 'Asteryum opens only in a main galaxy', 409);
    if (synthesisEnabled({ rulesetVersion: season.rulesetVersion }, shard)) {
      return { status: 'DEALT' as const, applied: false, startsAt: season.startsAt, moons: 0, storms: 0 };
    }
    if (season.synthesisStartsAt) {
      return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: season.synthesisStartsAt, moons: 0, storms: 0 };
    }
    const worlds = await tx.select({ id: planets.id }).from(planets).where(eq(planets.seasonId, season.id));
    const standing = worlds.length === 0 ? [] : await tx.select({ planetId: moons.planetId }).from(moons)
      .where(inArray(moons.planetId, worlds.map((world) => world.id)));
    if (!input.apply) return { status: 'READY' as const, applied: false, startsAt: now, moons: standing.length, storms: 0 };

    await tx.update(seasons).set({ synthesisStartsAt: now }).where(eq(seasons.id, season.id));
    if (standing.length > 0) {
      await tx.update(moons).set({ asteriumSyncedAt: now, asteriumFraction: 0 })
        .where(inArray(moons.planetId, standing.map((row) => row.planetId)));
    }
    const storms = await syncMissingFixedOccurrences(tx, { now, seasonId: season.id, kinds: ['ASTERIUM_STORM'] });
    await publishShard(tx, season.id, 'world');
    return { status: 'ACTIVATED' as const, applied: true, startsAt: now, moons: standing.length, storms };
  });
}
