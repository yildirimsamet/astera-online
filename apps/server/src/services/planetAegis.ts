import { and, asc, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm';
import { SHIELD, shieldHp, type Segment } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { buildings, planetAegisEpochs, planetFaults, planets, satellites } from '../db/schema.js';

import { beginPlanetRadiationBoundary } from './planetRadiation.js';

type Planet = typeof planets.$inferSelect;
export interface Hardware { coreLevel: number; aegisLevel: number; coreOffline: boolean }

/** A full level protects only once at least one whole HP has recharged. */
async function stateOf(db: Queryable, world: Planet, hardware?: Hardware) {
  if (!hardware) {
    const [core, aegis, faults] = await Promise.all([
      db.select({ level: buildings.level }).from(buildings).where(and(eq(buildings.planetId, world.id), eq(buildings.type, 'CORE'))),
      db.select({ level: satellites.level }).from(satellites).where(and(eq(satellites.planetId, world.id), eq(satellites.type, 'AEGIS'))),
      db.select({ kind: planetFaults.kind }).from(planetFaults).where(eq(planetFaults.planetId, world.id)),
    ]);
    hardware = { coreLevel: core[0]?.level ?? 0, aegisLevel: aegis[0]?.level ?? 0,
      coreOffline: faults.some(row => row.kind === 'CORE_OUTAGE') };
  }
  const level = hardware.coreOffline ? 0 : Math.min(hardware.coreLevel, hardware.aegisLevel);
  if (level <= 0) return { level: 0, activeFrom: null };
  const start = Math.max(world.lastTickAt.getTime(), world.empUntil?.getTime() ?? 0, world.shieldRegenAt?.getTime() ?? 0,
    world.recoveryUntil?.getTime() ?? 0, world.vacationUntil?.getTime() ?? 0);
  const activeFrom = world.shield >= 1 && !(world.empUntil && world.empUntil > world.lastTickAt)
    ? world.lastTickAt : new Date(start + Math.ceil(Math.max(0, 1 - world.shield) / (shieldHp(level) * SHIELD.regenPerHour) * 3600000));
  return { level, activeFrom };
}

/** Caller holds the world lock. Only hardware, charge depletion or blackout changes write an epoch. */
export async function syncPlanetAegis(tx: Tx, world: Planet, at: Date, initialAt = at, hardware?: Hardware): Promise<boolean> {
  const state = await stateOf(tx, world, hardware);
  const [open] = await tx.select().from(planetAegisEpochs)
    .where(and(eq(planetAegisEpochs.planetId, world.id), isNull(planetAegisEpochs.endsAt)));
  // A late arrival can precede an already-observed recharge. Preserve the
  // historical activation rather than replacing it with the latest tick.
  const observedAt = Math.max(at.getTime(), world.lastTickAt.getTime());
  if (open?.level === state.level && (open.activeFrom?.getTime() === state.activeFrom?.getTime()
    || (open.activeFrom !== null && state.activeFrom !== null
      && open.activeFrom.getTime() <= observedAt && state.activeFrom.getTime() <= observedAt))) return false;
  if (open) {
    if (open.startsAt >= at) await tx.delete(planetAegisEpochs).where(eq(planetAegisEpochs.id, open.id));
    else await tx.update(planetAegisEpochs).set({ endsAt: at }).where(eq(planetAegisEpochs.id, open.id));
  }
  await tx.insert(planetAegisEpochs).values({ planetId: world.id, startsAt: open ? at : initialAt, ...state });
  return true;
}

/** Every parked cohort and its death prediction share the same historical protection path. */
export async function planetRadiationPath(db: Queryable, world: Planet, from: number, until: number,
  prefetched?: { epochs: readonly (typeof planetAegisEpochs.$inferSelect)[]; hardware: Hardware }): Promise<Segment[]> {
  if (until <= from) return [];
  const epochs = prefetched?.epochs ?? await aegisEpochsOver(db, [world.id], from, until);
  const fallback = epochs.length === 0 ? await stateOf(db, world, prefetched?.hardware) : null;
  const periods = epochs.length ? epochs : [{ startsAt: new Date(from), endsAt: null, level: fallback?.level ?? 0, activeFrom: fallback?.activeFrom ?? null }];
  const boundaries = [...new Set([from, until, ...periods.flatMap(row => [row.startsAt.getTime(), row.endsAt?.getTime(), row.activeFrom?.getTime()])
    .filter((at): at is number => at !== undefined && at > from && at < until)])].sort((a, b) => a - b);
  return boundaries.slice(1).map((endMs, index) => {
    const startMs = boundaries[index]!;
    const epoch = periods.find(row => row.startsAt.getTime() <= startMs && (row.endsAt === null || row.endsAt.getTime() > startMs));
    const protection = epoch?.activeFrom && epoch.activeFrom.getTime() <= startMs ? epoch.level : 0;
    return { from: world, to: world, startMs, endMs, target: { kind: 'PLANET', id: world.id }, radiationProtectionHpPerMinute: protection };
  });
}

/** The epochs `planetRadiationPath` reads, for every world in `planetIds`, oldest first. */
export async function aegisEpochsOver(db: Queryable, planetIds: readonly string[], from: number, until: number) {
  return db.select().from(planetAegisEpochs).where(and(inArray(planetAegisEpochs.planetId, [...planetIds]),
    lt(planetAegisEpochs.startsAt, new Date(until)), or(isNull(planetAegisEpochs.endsAt), gt(planetAegisEpochs.endsAt, new Date(from)))))
    .orderBy(asc(planetAegisEpochs.startsAt));
}

/** Physical changes call this after writing charge/hardware, at their actual event instant. */
export async function refreshPlanetAegis(tx: Tx, planetId: string, at: Date) {
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId));
  if (world && await syncPlanetAegis(tx, world, at)) return beginPlanetRadiationBoundary(tx, planetId, at);
}
