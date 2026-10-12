import { and, eq, inArray } from 'drizzle-orm';
import { hpRadiationApplies } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { clanWarOperations, monumentProbes, monuments, monumentWaves, seasons } from '../db/schema.js';
import { GameError } from './planet.js';
import { monumentMotionStart } from './monumentMotion.js';
import { publishShard } from '../stream/bus.js';

/** Explicit owner-authorized idle cutover. The exclusive season barrier precedes every other lock. */
export async function activateMonumentMotion(db: Db, input: {
  seasonId: string; clock: Clock; apply: boolean; adminUsernames: readonly string[];
}) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || now < season.startsAt || now >= season.endsAt || !hpRadiationApplies(season.rulesetVersion)) {
      throw new GameError('SEASON_FROZEN', 'An open monument season is required', 409);
    }
    const start = monumentMotionStart(season);
    if (start) return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: start, fleets: 0, probes: 0, operations: 0 };
    const fleets = await tx.select({ id: monumentWaves.id }).from(monumentWaves).where(and(eq(monumentWaves.seasonId, season.id),
      inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING'])));
    const probes = await tx.select({ id: monumentProbes.id }).from(monumentProbes).where(and(eq(monumentProbes.seasonId, season.id),
      inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
    const operations = await tx.select({ id: clanWarOperations.id }).from(clanWarOperations).where(and(eq(clanWarOperations.seasonId, season.id),
      eq(clanWarOperations.targetKind, 'MONUMENT'), inArray(clanWarOperations.status, ['ASSEMBLING', 'ATTACKING', 'RETURNING'])));
    const counts = { fleets: fleets.length, probes: probes.length, operations: operations.length };
    if (fleets.length || probes.length || operations.length) return { status: 'BUSY' as const, applied: false, startsAt: now, ...counts };
    const targets = await tx.select({ id: monuments.id }).from(monuments).where(eq(monuments.seasonId, season.id));
    if (targets.length === 0) throw new GameError('MONUMENT_NOT_FOUND', 'This galaxy has no monuments', 409);
    if (input.apply) {
      await tx.update(seasons).set({ monumentMotionStartsAt: now }).where(eq(seasons.id, season.id));
      await publishShard(tx, season.id, 'control');
    }
    return { status: 'READY' as const, applied: input.apply, startsAt: now, ...counts };
  });
}
