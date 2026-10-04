import { and, eq, inArray, or } from 'drizzle-orm';
import type { Queryable, Tx } from '../db/client.js';
import { monumentProbes, monumentWaves, scheduledEvents } from '../db/schema.js';
import { GameError } from './planet.js';

/** HOLD has no ordinary mission row, but still owns ships and a personal origin bay. */
export async function hasMonumentActivity(db: Queryable, playerId: string, planetIds: readonly string[]): Promise<boolean> {
  const [wave] = await db.select({ id: monumentWaves.id }).from(monumentWaves).where(and(
    inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING']),
    or(eq(monumentWaves.playerId, playerId), inArray(monumentWaves.originPlanetId, [...planetIds])),
  )).limit(1);
  if (wave !== undefined) return true;
  const [probe] = await db.select({ id: monumentProbes.id }).from(monumentProbes).where(and(
    inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING']),
    or(eq(monumentProbes.playerId, playerId), inArray(monumentProbes.originPlanetId, [...planetIds])),
  )).limit(1);
  return probe !== undefined;
}

/** The caller protects the commander and worlds. Terminal waves cannot become live again. */
export async function removeTerminalMonumentWaves(tx: Tx, playerId: string, planetIds: readonly string[]): Promise<void> {
  if (await hasMonumentActivity(tx, playerId, planetIds)) throw new GameError('MONUMENT_ACTIVE', 'Recall your monument fleets before removing this commander', 409);
  const probes = await tx.select({ id: monumentProbes.id }).from(monumentProbes).where(
    or(eq(monumentProbes.playerId, playerId), inArray(monumentProbes.originPlanetId, [...planetIds])),
  );
  if (probes.length > 0) {
    await tx.delete(scheduledEvents).where(and(eq(scheduledEvents.kind, 'monument_probe'), inArray(scheduledEvents.refId, probes.map((row) => row.id))));
    await tx.delete(monumentProbes).where(inArray(monumentProbes.id, probes.map((row) => row.id)));
  }
  const rows = await tx.select({ id: monumentWaves.id }).from(monumentWaves).where(
    or(eq(monumentWaves.playerId, playerId), inArray(monumentWaves.originPlanetId, [...planetIds])),
  );
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);
  await tx.delete(scheduledEvents).where(and(inArray(scheduledEvents.refId, ids),
    inArray(scheduledEvents.kind, ['monument_arrival', 'monument_loss'])));
  await tx.delete(monumentWaves).where(inArray(monumentWaves.id, ids));
}
