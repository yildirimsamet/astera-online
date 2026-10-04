import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Queryable, Tx } from '../db/client.js';
import { monumentProbes, monumentWaves, planets, units } from '../db/schema.js';
import { lockWorlds } from './ownership.js';
import { lockMonumentRosters } from './monument.js';
import { GameError } from './planet.js';
import { publish } from '../stream/bus.js';

/** Discovery before the caller's sorted world locks, never after their player locks. */
export async function monumentOriginCapitals(db: Queryable, planetId: string): Promise<string[]> {
  const rows = await db.select({ playerId: monumentWaves.playerId }).from(monumentWaves).where(eq(monumentWaves.originPlanetId, planetId));
  const probes = await db.select({ playerId: monumentProbes.playerId }).from(monumentProbes).where(eq(monumentProbes.originPlanetId, planetId));
  const owners = [...rows, ...probes];
  if (owners.length === 0) return [];
  const capitals = await db.select({ id: planets.id }).from(planets).where(and(eq(planets.kind, 'CAPITAL'),
    inArray(planets.controllerPlayerId, [...new Set(owners.map((row) => row.playerId))])));
  return capitals.map((row) => row.id);
}

/** Lock origin targets before any caller acquires clan or player ledgers. */
export async function prepareMonumentOriginChange(tx: Tx, planetId: string): Promise<void> {
  const initial = await tx.select().from(monumentWaves).where(eq(monumentWaves.originPlanetId, planetId));
  const probes = await tx.select().from(monumentProbes).where(eq(monumentProbes.originPlanetId, planetId));
  if (initial.length === 0 && probes.length === 0) return;
  const capitalIds = await monumentOriginCapitals(tx, planetId);
  await lockWorlds(tx, [planetId, ...capitalIds]);
  await lockMonumentRosters(tx, [...initial, ...probes].map((row) => row.monumentId));
  await tx.select().from(monumentWaves).where(eq(monumentWaves.originPlanetId, planetId))
    .orderBy(asc(monumentWaves.id)).for('update');
  await tx.select().from(monumentProbes).where(eq(monumentProbes.originPlanetId, planetId))
    .orderBy(asc(monumentProbes.id)).for('update');
}

/** Only an actual handover re-anchors; a weapon strike may have failed to capture. */
export async function reanchorMonumentOrigin(tx: Tx, planetId: string): Promise<void> {
  await prepareMonumentOriginChange(tx, planetId);
  const rows = await tx.select().from(monumentWaves).where(eq(monumentWaves.originPlanetId, planetId));
  const probes = await tx.select().from(monumentProbes).where(eq(monumentProbes.originPlanetId, planetId));
  if (rows.length === 0 && probes.length === 0) return;
  const capitals = await tx.select().from(planets).where(and(eq(planets.kind, 'CAPITAL'),
    inArray(planets.controllerPlayerId, [...new Set([...rows, ...probes].map((row) => row.playerId))])));
  const capitalOf = new Map(capitals.map((world) => [world.controllerPlayerId, world.id]));
  for (const wave of rows) {
    const homeId = capitalOf.get(wave.playerId);
    if (!homeId || homeId === planetId) throw new GameError('PLACEMENT_CHANGED', 'The fleet needs a safe capital before this world changes hands', 409);
    await tx.update(units).set({ planetId: homeId }).where(and(eq(units.planetId, planetId),
      eq(units.location, wave.unitLocation), eq(units.ownerPlayerId, wave.playerId)));
    await tx.update(monumentWaves).set({ originPlanetId: homeId }).where(eq(monumentWaves.id, wave.id));
    await publish(tx, wave.playerId, 'private:monument');
  }
  for (const probe of probes) {
    const homeId = capitalOf.get(probe.playerId);
    if (!homeId || homeId === planetId) throw new GameError('PLACEMENT_CHANGED', 'The probe needs a safe capital before this world changes hands', 409);
    await tx.update(monumentProbes).set({ originPlanetId: homeId }).where(eq(monumentProbes.id, probe.id));
    await publish(tx, probe.playerId, 'private:monument');
  }
}
