import { and, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { clanWarOperations, monumentProbes, monuments, monumentWaves, seasons } from '../db/schema.js';
import { GameError, recomputePlayerWealth } from './planet.js';
import { landMonumentFleets } from './monumentSeasonClose.js';
import { scheduleHoldBoundary } from './monumentBoundaries.js';
import { publishShard } from '../stream/bus.js';

/**
 * OWNER-AUTHORIZED MAINTENANCE RECALL IN A LIVE SEASON (2026-10-16).
 *
 * The idle monument cutovers refuse while any fleet is out at a monument, and a held fleet never
 * comes home on its own. Under maintenance this lands every monument fleet at its owner's safe
 * home through the same delivery the season close uses: ships keep their health, carried
 * Deuterium and the unspent return reserve go into stock, and the owner gets the ordinary
 * "fleet returned" receipt. The SEASON STAYS OPEN: nothing is frozen and no lifecycle event is
 * deleted — the generation bump turns the old arrival/loss events into no-ops, and a vacated
 * monument follows the ordinary empty → 24 h garrison rule.
 *
 * Probes and clan operations are not recalled: their presence refuses the run without writes.
 */
export async function recallMonumentFleets(db: Db, input: {
  seasonId: string; clock: Clock; apply: boolean; adminUsernames: readonly string[];
}) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt) {
      throw new GameError('SEASON_FROZEN', 'An open season is required', 409);
    }
    const fleets = await tx.select({ id: monumentWaves.id }).from(monumentWaves).where(and(eq(monumentWaves.seasonId, season.id),
      inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING'])));
    const probes = await tx.select({ id: monumentProbes.id }).from(monumentProbes).where(and(eq(monumentProbes.seasonId, season.id),
      inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
    const operations = await tx.select({ id: clanWarOperations.id }).from(clanWarOperations).where(and(eq(clanWarOperations.seasonId, season.id),
      eq(clanWarOperations.targetKind, 'MONUMENT'), inArray(clanWarOperations.status, ['ASSEMBLING', 'ATTACKING', 'RETURNING'])));
    const counts = { fleets: fleets.length, probes: probes.length, operations: operations.length };
    if (probes.length || operations.length) return { status: 'BUSY' as const, applied: false, at: now, ...counts };
    if (fleets.length === 0) return { status: 'IDLE' as const, applied: false, at: now, ...counts };
    if (!input.apply) return { status: 'READY' as const, applied: false, at: now, ...counts };

    const landed = await landMonumentFleets(tx, { seasonId: season.id, cutoff: now, observedAt: now,
      adminUsernames: input.adminUsernames, closing: false });
    for (const target of landed?.locked ?? []) {
      const m = target.monument;
      if (m.controllerPlayerId === null && m.controllerClanId === null) continue;
      m.controllerPlayerId = null;
      m.controllerClanId = null;
      m.emptySince = now;
      m.generation += 1;
      await tx.update(monuments).set({ controllerPlayerId: null, controllerClanId: null, emptySince: now, generation: m.generation })
        .where(eq(monuments.id, m.id));
      await scheduleHoldBoundary(tx, target, null);
    }
    for (const playerId of landed?.owners ?? []) await recomputePlayerWealth(tx, playerId, now);
    await publishShard(tx, season.id, 'control');
    return { status: 'READY' as const, applied: true, at: now, ...counts };
  });
}
