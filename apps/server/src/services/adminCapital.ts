import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { INSTRUMENT_MAX_LEVEL, SATELLITE_IDS } from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, buildings, planets, players, satellites } from '../db/schema.js';
import { loadLocked, recomputeWealth } from './planet.js';
import { refreshSensorEpoch } from './sensorHistory.js';
import { publishShard } from '../stream/bus.js';

const ORBIT_TYPES = new Set<string>(SATELLITE_IDS);

/** Caller owns the placement fence (or is creating this capital in the join transaction). */
export async function equipAdminCapital(tx: Tx, planetId: string, clock: Clock): Promise<boolean> {
  const max = INSTRUMENT_MAX_LEVEL.TELESCOPE;
  if (max === null) throw new Error('Admin Telescope requires a finite maximum');
  const planet = await loadLocked(tx, planetId, clock, { requireLive: false });
  const rows = await tx.select().from(satellites).where(eq(satellites.planetId, planetId)).orderBy(asc(satellites.slot));
  const telescope = rows.find(row => row.type === 'TELESCOPE');
  const firstOrbit = rows.find(row => ORBIT_TYPES.has(row.type));
  if (planet.x === 0 && planet.y === 0 && planet.z === 0
    && planet.buildings.CORE >= max && telescope?.level === max && firstOrbit?.type === 'UPLINK') return false;

  await tx.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, planetId));
  if (planet.buildings.CORE < max) await tx.update(buildings).set({ level: max })
    .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE')));
  let nextSlot = rows.length ? Math.max(...rows.map(row => row.slot)) + 1 : 0;
  if (telescope) await tx.update(satellites).set({ level: max })
    .where(and(eq(satellites.planetId, planetId), eq(satellites.type, 'TELESCOPE')));
  else await tx.insert(satellites).values({ planetId, type: 'TELESCOPE', level: max, slot: nextSlot++ });
  let uplink = rows.find(row => row.type === 'UPLINK');
  if (!uplink) {
    uplink = { planetId, type: 'UPLINK', level: 1, slot: nextSlot, aegisInvestedValue: null };
    await tx.insert(satellites).values(uplink);
  }
  // Preserve all installed hardware. Put Uplink in the first orbit slot so Core's
  // active prefix includes it; build completion finds hardware by type, not slot.
  if (firstOrbit && firstOrbit.type !== 'UPLINK') {
    await tx.delete(satellites).where(and(eq(satellites.planetId, planetId), inArray(satellites.slot, [firstOrbit.slot, uplink.slot])));
    await tx.insert(satellites).values([{ ...firstOrbit, slot: uplink.slot }, { ...uplink, slot: firstOrbit.slot }]);
  }
  await recomputeWealth(tx, planetId, clock.now());
  await refreshSensorEpoch(tx, planetId, clock.now());
  await publishShard(tx, planet.seasonId, 'world');
  return true;
}

/** Boot reconciliation for accounts that were already placed before this feature. */
export async function provisionAdminCapitals(db: Db, allowedUsernames: ReadonlySet<string>, clock: Clock): Promise<number> {
  if (allowedUsernames.size === 0) return 0;
  const rows = await db.select({ id: planets.id, seasonId: planets.seasonId, accountId: accounts.id }).from(planets)
    .innerJoin(players, eq(players.id, planets.controllerPlayerId)).innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(eq(planets.kind, 'CAPITAL'), inArray(accounts.username, [...allowedUsernames])))
    .orderBy(asc(planets.seasonId), asc(planets.id));
  let changed = 0;
  for (const row of rows) {
    const updated = await db.transaction(async tx => {
      // Same exclusive fence as relocation; no in-flight HTTP response may straddle this move.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${row.seasonId}`}, 0))`);
      const [current] = await tx.select({ id: planets.id }).from(planets)
        .where(and(eq(planets.id, row.id), eq(planets.seasonId, row.seasonId)));
      return current ? equipAdminCapital(tx, row.id, clock) : false;
    });
    if (updated) changed++;
  }
  return changed;
}
