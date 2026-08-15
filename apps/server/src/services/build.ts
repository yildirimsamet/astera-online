import { eq } from 'drizzle-orm';
import {
  HULLS,
  satelliteEntries,
  satelliteSlots,
  upgradeCost,
  type BuildingId,
  type HullId,
  type SatelliteId,
} from '@blindspace/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { satellites } from '../db/schema.js';
import {
  GameError,
  addUnits,
  refreshWealth,
  saveResources,
  setBuildingLevel,
  withPlanetLock,
} from './planet.js';

/**
 * Construction is INSTANT on payment. There are no build timers and no queues.
 *
 * A timer's return hook is "a bar filled up" — the weakest one available — and it
 * would be a whole state machine plus a permanent temptation to sell speed-ups.
 * It also makes the panic session better: converting stock into Bastions in the
 * nine minutes before a fleet lands is a real emergency option.
 */

export async function upgradeBuilding(
  db: Db,
  planetId: string,
  type: BuildingId,
  clock: Clock,
): Promise<{ type: BuildingId; level: number; alloy: number; crystal: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const level = planet.buildings[type];

    if (type !== 'CORE' && level >= planet.buildings.CORE) {
      throw new GameError('CORE_CEILING', 'Command Core must be raised first');
    }

    const cost = upgradeCost(level);
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - cost.alloy;
    const crystal = planet.crystal - cost.crystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await setBuildingLevel(tx, planetId, type, level + 1);

    planet.buildings[type] = level + 1;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    return { type, level: level + 1, alloy, crystal };
  });
}

export async function buildUnits(
  db: Db,
  planetId: string,
  hull: HullId,
  count: number,
  clock: Clock,
): Promise<{ hull: HullId; built: number; alloy: number; crystal: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw new GameError('BAD_COUNT', 'Count must be a positive integer');
  }

  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const spec = HULLS[hull];
    if (planet.buildings.SHIPYARD < spec.minShipyard) {
      throw new GameError('SHIPYARD_TOO_LOW', `Needs Shipyard L${spec.minShipyard}`);
    }

    const totalAlloy = spec.alloy * count;
    const totalCrystal = spec.crystal * count;
    if (planet.alloy < totalAlloy || planet.crystal < totalCrystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const alloy = planet.alloy - totalAlloy;
    const crystal = planet.crystal - totalCrystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await addUnits(tx, planetId, { [hull]: count });

    const bucket = spec.ground ? planet.ground : planet.homeFleet;
    bucket[hull] = (bucket[hull] ?? 0) + count;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    return { hull, built: count, alloy, crystal };
  });
}

/**
 * Satellites are the identity choice: five types against a realistic ceiling of
 * four slots. Nobody runs everything.
 */
export async function installSatellite(
  db: Db,
  planetId: string,
  type: SatelliteId,
  clock: Clock,
): Promise<{ type: SatelliteId; level: number; slot: number }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    const level = planet.satellites[type] ?? 0;

    if (level === 0) {
      const owned = satelliteEntries(planet.satellites).length;
      if (owned >= satelliteSlots(planet.buildings.RING)) {
        throw new GameError('NO_FREE_SLOT', 'Raise the Orbital Ring for another slot');
      }
    }
    if (level >= planet.buildings.CORE) {
      throw new GameError('CORE_CEILING', 'Command Core must be raised first');
    }

    const cost = upgradeCost(level);
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }

    const existing = await tx
      .select()
      .from(satellites)
      .where(eq(satellites.planetId, planetId));
    const slot =
      existing.find((s) => s.type === type)?.slot ??
      (existing.length > 0 ? Math.max(...existing.map((s) => s.slot)) + 1 : 0);

    const alloy = planet.alloy - cost.alloy;
    const crystal = planet.crystal - cost.crystal;
    await saveResources(tx, planetId, { alloy, crystal });
    await tx
      .insert(satellites)
      .values({ planetId, slot, type, level: level + 1 })
      .onConflictDoUpdate({
        target: [satellites.planetId, satellites.slot],
        set: { type, level: level + 1 },
      });

    planet.satellites[type] = level + 1;
    planet.alloy = alloy;
    planet.crystal = crystal;
    await refreshWealth(tx, planet);

    return { type, level: level + 1, slot };
  });
}
