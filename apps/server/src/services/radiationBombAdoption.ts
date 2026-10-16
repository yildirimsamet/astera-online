import { planetRadiationPath } from './planetAegis.js';
import { asc, eq } from 'drizzle-orm';
import { hpRadiationApplies, segmentsExposureHp } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { planets, seasons } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { monumentMotionStart } from './monumentMotion.js';
import { schedulePlanetRadiation } from './planetRadiation.js';
import { cancelRepairsForRadiation } from './buildQueue.js';
import { hpSourcesForTarget } from './radiationSources.js';

/** Explicit active-season cutover: never a ruleset bump or a rewrite of old dose. */
export async function activateRadiationBombs(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt
      || !hpRadiationApplies(season.rulesetVersion)) {
      throw new GameError('SEASON_FROZEN', 'An open HP radiation season is required', 409);
    }
    if (!monumentMotionStart(season)) {
      throw new GameError('MONUMENT_MOTION_REQUIRED', 'Activate entity radiation first', 409);
    }
    if (season.radiationBombStartsAt) return { status: 'ALREADY_ACTIVE' as const, applied: false,
      startsAt: season.radiationBombStartsAt, planets: 0 };
    const worlds = await tx.select().from(planets).where(eq(planets.seasonId, season.id)).orderBy(asc(planets.id)).for('update');
    if (input.apply) {
      await tx.update(seasons).set({ radiationBombStartsAt: now }).where(eq(seasons.id, season.id));
      await tx.update(planets).set({ radiationSettledAt: now }).where(eq(planets.seasonId, season.id));
      const active = { ...season, radiationBombStartsAt: now };
      for (const world of worlds) {
        const sources = await hpSourcesForTarget(tx, active, { kind: 'PLANET', id: world.id }, now, season.endsAt);
        if (segmentsExposureHp(await planetRadiationPath(tx, world, now.getTime(), now.getTime() + 1), sources) > 0) {
          await cancelRepairsForRadiation(tx, world.id, now);
        }
        if (sources.length > 0) await schedulePlanetRadiation(tx, { ...world, radiationSettledAt: now }, active, now);
      }
      await publishShard(tx, season.id, 'world');
    }
    return { status: 'READY' as const, applied: input.apply, startsAt: now, planets: worlds.length };
  });
}
