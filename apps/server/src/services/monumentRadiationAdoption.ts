import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { hpRadiationApplies, MONUMENT_BALANCE } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { clanWarOperations, hpRadiationSources, monumentProbes, monuments, monumentWaves, seasons } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';
import { monumentMotionStart } from './monumentMotion.js';
import { LEGACY_MONUMENT_HP_PER_MINUTE, monumentRadiationStart } from './monumentRadiation.js';

/** Same season barrier as dispatch; historical windows and unrelated emitters stay intact. */
export async function activateMonumentRadiation(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || now < season.startsAt || now >= season.endsAt || season.closedAt
      || !hpRadiationApplies(season.rulesetVersion)) throw new GameError('SEASON_FROZEN', 'An open monument season is required', 409);
    if (!monumentMotionStart(season)) throw new GameError('MONUMENT_MOTION_REQUIRED', 'Activate monument motion and entity radiation first', 409);
    const start = monumentRadiationStart(season);
    const emptyCounts = { fleets: 0, probes: 0, operations: 0, monuments: 0 };
    if (start) return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: start, ...emptyCounts };
    const [fleets, probes, operations] = await Promise.all([
      tx.select({ id: monumentWaves.id }).from(monumentWaves).where(and(eq(monumentWaves.seasonId, season.id), inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING']))),
      tx.select({ id: monumentProbes.id }).from(monumentProbes).where(and(eq(monumentProbes.seasonId, season.id), inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING']))),
      tx.select({ id: clanWarOperations.id }).from(clanWarOperations).where(and(eq(clanWarOperations.seasonId, season.id), eq(clanWarOperations.targetKind, 'MONUMENT'),
        inArray(clanWarOperations.status, ['ASSEMBLING', 'ATTACKING', 'RETURNING']))),
    ]);
    const counts = { ...emptyCounts, fleets: fleets.length, probes: probes.length, operations: operations.length };
    if (fleets.length || probes.length || operations.length) return { status: 'BUSY' as const, applied: false, startsAt: now, ...counts };
    const targets = await tx.select().from(monuments).where(eq(monuments.seasonId, season.id));
    const sources = await tx.select().from(hpRadiationSources).where(and(eq(hpRadiationSources.seasonId, season.id),
      eq(hpRadiationSources.anchorKind, 'MONUMENT'), or(isNull(hpRadiationSources.activeUntil), gt(hpRadiationSources.activeUntil, now))));
    if (targets.length === 0) throw new GameError('MONUMENT_NOT_FOUND', 'This galaxy has no monuments', 409);
    const replacements = targets.map(target => {
      if (target.difficulty === 'LEGACY') throw new GameError('MONUMENT_RADIATION_INVALID', 'Adopt the Easy/Hard monument layout first', 409);
      const difficulty = target.difficulty;
      const balance = MONUMENT_BALANCE[difficulty];
      // A still-running old image may have seeded after the metadata migration.
      // Recognize only the authored legacy identity AND its old rate, not arbitrary auras.
      const base = sources.filter(source => source.anchorId === target.id && (source.radiationLevel !== null
        || (source.mode === 'EMIT' && source.label === `Monument ${String(target.ordinal)} cloud`
          && source.intensityHpPerMinute === LEGACY_MONUMENT_HP_PER_MINUTE[difficulty])));
      if (base.length !== 1 || (base[0]!.radiationLevel !== null && base[0]!.radiationLevel !== balance.radiationLevel) || base[0]!.activeFrom > now) {
        throw new GameError('MONUMENT_RADIATION_INVALID', 'Each monument requires exactly one current base radiation source', 409);
      }
      return { source: base[0]!, rate: balance.intensityHpPerMinute, radiationLevel: balance.radiationLevel };
    });
    if (input.apply) {
      for (const { source, rate, radiationLevel } of replacements) {
        await tx.update(hpRadiationSources).set({ activeUntil: now }).where(eq(hpRadiationSources.id, source.id));
        await tx.insert(hpRadiationSources).values({ seasonId: source.seasonId, anchorKind: source.anchorKind, anchorId: source.anchorId,
          x: source.x, y: source.y, z: source.z, radius: source.radius, mode: source.mode, radiationLevel,
          intensityHpPerMinute: rate, activeFrom: now, activeUntil: null, label: source.label });
      }
      await tx.update(seasons).set({ monumentRadiationStartsAt: now }).where(eq(seasons.id, season.id));
      await publishShard(tx, season.id, 'control');
    }
    return { status: 'READY' as const, applied: input.apply, startsAt: now, ...counts, monuments: targets.length };
  });
}
