import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, hpRadiationApplies, monumentDifficulty } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import { clanWarOperations, hpRadiationSources, monumentProbes, monuments, monumentWaves, scheduledEvents, seasons } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { GameError } from './planet.js';

/**
 * A live deal changes only while every monument is idle. The exclusive season
 * barrier also blocks a new launch between checking the roster and moving it.
 * Legacy source windows remain intact for other flights that crossed the old map.
 */
export async function adoptMonumentLayout(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such galaxy', 404);
    // Flights may settle while this operator waits for the exclusive barrier.
    // The new windows start only after those writers have finished.
    const at = input.clock.now();
    if (season.status !== 'live' || at >= season.endsAt) throw new GameError('SEASON_FROZEN', 'This galaxy is closed', 409);
    if (!hpRadiationApplies(season.rulesetVersion)) throw new GameError('MONUMENT_UNAVAILABLE', 'This galaxy does not support monuments', 409);
    const rows = await tx.select().from(monuments).where(eq(monuments.seasonId, season.id)).orderBy(monuments.ordinal).for('update');
    if (rows.length === 8 && rows.every(row => row.difficulty === monumentDifficulty(row.ordinal))) {
      return { status: 'ALREADY_UPDATED' as const, applied: false, held: 0, fleets: 0, probes: 0, operations: 0 };
    }
    if (rows.length !== 5 || rows.some((row, index) => row.ordinal !== index + 1 || row.difficulty !== 'LEGACY')) {
      throw new GameError('MONUMENT_LAYOUT_UNSUPPORTED', 'Only the original five-monument layout can be adopted', 409);
    }
    const [fleets, probes, operations] = await Promise.all([
      tx.select({ id: monumentWaves.id }).from(monumentWaves).where(and(eq(monumentWaves.seasonId, season.id),
        inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING']))),
      tx.select({ id: monumentProbes.id }).from(monumentProbes).where(and(eq(monumentProbes.seasonId, season.id),
        inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING']))),
      tx.select({ id: clanWarOperations.id }).from(clanWarOperations).where(and(eq(clanWarOperations.seasonId, season.id),
        eq(clanWarOperations.targetKind, 'MONUMENT'), inArray(clanWarOperations.status, ['ASSEMBLING', 'ATTACKING']))),
    ]);
    const activity = { held: rows.filter(row => row.controllerPlayerId !== null || row.controllerClanId !== null).length,
      fleets: fleets.length, probes: probes.length, operations: operations.length };
    if (Object.values(activity).some(count => count > 0)) return { status: 'BUSY' as const, applied: false, ...activity };
    if (!input.apply) return { status: 'READY' as const, applied: false, ...activity };

    await tx.update(hpRadiationSources).set({ activeUntil: sql`greatest(${at.toISOString()}::timestamptz, ${hpRadiationSources.activeFrom})` })
      .where(and(eq(hpRadiationSources.seasonId, season.id),
      eq(hpRadiationSources.anchorKind, 'MONUMENT'), inArray(hpRadiationSources.anchorId, rows.map(row => row.id)),
      or(isNull(hpRadiationSources.activeUntil), gt(hpRadiationSources.activeUntil, at))));

    for (const [index, position] of MONUMENT_SEASON_DEFAULTS.positions.entries()) {
      const ordinal = index + 1;
      const difficulty = monumentDifficulty(ordinal);
      const balance = MONUMENT_BALANCE[difficulty];
      const settings = { ...position, difficulty, capacity: balance.capacity, productionPerMinute: balance.productionPerMinute,
        garrison: { ...balance.garrison }, garrisonTemplate: { ...balance.garrison }, garrisonTech: {},
        garrisonDamage: [], settledAt: at, emptySince: null };
      const old = rows[index];
      if (old) await tx.update(monuments).set({ ...settings, generation: old.generation + 1 }).where(eq(monuments.id, old.id));
      else await tx.insert(monuments).values({ seasonId: season.id, ordinal, ...settings });
    }
    const updated = await tx.select().from(monuments).where(eq(monuments.seasonId, season.id)).orderBy(monuments.ordinal);
    await tx.insert(hpRadiationSources).values(updated.map(row => ({ seasonId: season.id,
      anchorKind: 'MONUMENT' as const, anchorId: row.id, x: row.x, y: row.y, z: row.z,
      radius: MONUMENT_SEASON_DEFAULTS.cloudRadius, intensityHpPerMinute: MONUMENT_BALANCE[monumentDifficulty(row.ordinal)].intensityHpPerMinute,
      mode: 'EMIT' as const, activeFrom: at, activeUntil: null, label: `Monument ${String(row.ordinal)} cloud` })));
    await tx.delete(scheduledEvents).where(and(eq(scheduledEvents.seasonId, season.id), eq(scheduledEvents.status, 'pending'),
      inArray(scheduledEvents.kind, ['monument_respawn', 'monument_loss'])));
    await publishShard(tx, season.id, 'world');
    await publishShard(tx, season.id, 'control');
    return { status: 'READY' as const, applied: true, ...activity };
  });
}
