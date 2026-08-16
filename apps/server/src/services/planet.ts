import { and, eq, inArray } from 'drizzle-orm';
import {
  advanceEconomy,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type Fleet,
  type HullId,
  type SatelliteLevels,
} from '@blindspace/rules';
import { minutesSince, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildings, planets, players, satellites, seasons, units } from '../db/schema.js';

const BUILDING_IDS: BuildingId[] = ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'RING'];

export interface LockedPlanet {
  planetId: string;
  playerId: string;
  seasonId: string;
  seasonStart: Date;
  name: string;
  x: number; y: number; z: number;
  alloy: number;
  crystal: number;
  shield: number;
  disruptedUntil: Date | null;
  buildings: BuildingLevels;
  satellites: SatelliteLevels;
  /** Units physically at home right now. Anything in flight is not here. */
  homeFleet: Fleet;
  ground: Fleet;
  /** Minutes since season start, at the moment the lock was taken. */
  nowMinutes: number;
  now: Date;
}

export class GameError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/**
 * Load a planet under a row lock and advance its continuous state to `now`.
 *
 * The lazy tick runs INSIDE the lock, which is what makes double-spending
 * impossible: a second transaction blocks here, then re-reads post-commit state
 * and fails its own affordability check.
 */
export async function loadLocked(tx: Tx, planetId: string, clock: Clock): Promise<LockedPlanet> {
  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (!row) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);

  const [season] = await tx.select().from(seasons).where(eq(seasons.id, row.seasonId));
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);

  const [buildingRows, satelliteRows, unitRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, planetId)),
    tx.select().from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home'))),
  ]);

  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, 0])) as BuildingLevels;
  for (const b of buildingRows) levels[b.type as BuildingId] = b.level;

  const sats: SatelliteLevels = {};
  for (const s of satelliteRows) sats[s.type] = s.level;

  const homeFleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    (u.hull === 'BASTION' ? ground : homeFleet)[u.hull] = u.count;
  }

  const now = clock.now();
  const nowMinutes = minutesSince(season.startsAt, now);

  const advanced = advanceEconomy(
    {
      alloy: row.alloy,
      crystal: row.crystal,
      shield: row.shield,
      lastTickMinutes: minutesSince(season.startsAt, row.lastTickAt),
      disruptedUntilMinutes: row.disruptedUntil
        ? minutesSince(season.startsAt, row.disruptedUntil)
        : 0,
    },
    {
      refineryLevel: levels.REFINERY,
      extractorLevel: levels.EXTRACTOR,
      aegisLevel: sats.AEGIS ?? 0,
    },
    nowMinutes,
  );

  if (advanced.lastTickMinutes !== minutesSince(season.startsAt, row.lastTickAt)) {
    await tx
      .update(planets)
      .set({
        alloy: advanced.alloy,
        crystal: advanced.crystal,
        shield: advanced.shield,
        lastTickAt: now,
      })
      .where(eq(planets.id, planetId));
  }

  return {
    planetId: row.id,
    playerId: row.playerId,
    seasonId: row.seasonId,
    seasonStart: season.startsAt,
    name: row.name,
    x: row.x, y: row.y, z: row.z,
    alloy: advanced.alloy,
    crystal: advanced.crystal,
    shield: advanced.shield,
    disruptedUntil: row.disruptedUntil,
    buildings: levels,
    satellites: sats,
    homeFleet,
    ground,
    nowMinutes,
    now,
  };
}

/** Run `fn` with the planet locked and freshly ticked. */
export async function withPlanetLock<T>(
  db: Db,
  planetId: string,
  clock: Clock,
  fn: (tx: Tx, planet: LockedPlanet) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx, await loadLocked(tx, planetId, clock)));
}

/**
 * Lock two planets at once — for a battle.
 *
 * ALWAYS in ascending id order. Two players raiding each other simultaneously
 * would otherwise deadlock, and the only fix that scales is a total ordering.
 */
export async function withTwoPlanetLock<T>(
  db: Db,
  aId: string,
  bId: string,
  clock: Clock,
  fn: (tx: Tx, a: LockedPlanet, b: LockedPlanet) => Promise<T>,
): Promise<T> {
  const [firstId, secondId] = aId < bId ? [aId, bId] : [bId, aId];
  return db.transaction(async (tx) => {
    const first = await loadLocked(tx, firstId, clock);
    const second = await loadLocked(tx, secondId, clock);
    const [a, b] = aId < bId ? [first, second] : [second, first];
    return fn(tx, a, b);
  });
}

/* ── persistence helpers ────────────────────────────────────── */

export async function saveResources(
  tx: Tx,
  planetId: string,
  next: { alloy: number; crystal: number; shield?: number; disruptedUntil?: Date | null },
): Promise<void> {
  await tx
    .update(planets)
    .set({
      alloy: next.alloy,
      crystal: next.crystal,
      ...(next.shield !== undefined ? { shield: next.shield } : {}),
      ...(next.disruptedUntil !== undefined ? { disruptedUntil: next.disruptedUntil } : {}),
    })
    .where(eq(planets.id, planetId));
}

/** Overwrite the home stack for the given hulls. Values are absolute, not deltas. */
export async function setUnits(
  tx: Tx,
  planetId: string,
  fleet: Fleet,
  location = 'home',
): Promise<void> {
  const entries = Object.entries(fleet) as [HullId, number][];
  if (entries.length === 0) return;
  for (const [hull, count] of entries) {
    await tx
      .insert(units)
      .values({ planetId, hull, location, count: Math.max(0, count) })
      .onConflictDoUpdate({
        target: [units.planetId, units.hull, units.location],
        set: { count: Math.max(0, count) },
      });
  }
}

export async function addUnits(tx: Tx, planetId: string, fleet: Fleet): Promise<void> {
  const current = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const merged: Fleet = {};
  for (const u of current) merged[u.hull] = u.count;
  for (const [hull, n] of Object.entries(fleet) as [HullId, number][]) {
    merged[hull] = (merged[hull] ?? 0) + n;
  }
  await setUnits(tx, planetId, merged);
}

export async function setBuildingLevel(
  tx: Tx,
  planetId: string,
  type: BuildingId,
  level: number,
): Promise<void> {
  await tx
    .insert(buildings)
    .values({ planetId, type, level })
    .onConflictDoUpdate({ target: [buildings.planetId, buildings.type], set: { level } });
}

/**
 * Recompute and store Wealth, reading everything fresh.
 *
 * Denormalised so the rank-floor check is one read — and that denormalisation was
 * silently broken. `wealth` was written ONLY when a player bought something, so it
 * was never written at all for a player who had not: a fresh commander sat at
 * zero, and `canAttack` refuses anyone below 40% of the attacker's wealth. A
 * player who joined and pressed nothing was therefore PERMANENTLY IMMUNE to
 * attack, which is the exact opposite of the design. It also
 * went stale after every raid, since combat moves resources and units without
 * anyone "buying" anything.
 *
 * Counting ALL units owned, not just the ones at home: Wealth is "everything you
 * own, at what it cost", and a fleet in flight is still owned. Counting only the
 * garrison meant a player was cheapest — and so most protected by the rank floor —
 * at exactly the moment their fleet was away and they were most vulnerable.
 */
export async function recomputeWealth(tx: Tx, planetId: string): Promise<number> {
  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId));
  if (!row) return 0;

  const [buildingRows, satelliteRows, unitRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, planetId)),
    tx.select().from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select().from(units).where(eq(units.planetId, planetId)),
  ]);

  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, 0])) as BuildingLevels;
  for (const b of buildingRows) levels[b.type as BuildingId] = b.level;

  const sats: SatelliteLevels = {};
  for (const s of satelliteRows) sats[s.type] = s.level;

  const fleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    const bucket = u.hull === 'BASTION' ? ground : fleet;
    bucket[u.hull] = (bucket[u.hull] ?? 0) + u.count;
  }

  const value = wealth({
    buildings: levels,
    satellites: sats,
    fleet,
    ground,
    alloy: row.alloy,
    crystal: row.crystal,
  });
  await tx.update(players).set({ wealth: value }).where(eq(players.id, row.playerId));
  return value;
}

/** Convenience for callers that already hold a lock. */
export const refreshWealth = (tx: Tx, planet: LockedPlanet): Promise<number> =>
  recomputeWealth(tx, planet.planetId);

/** Everything a player currently owns, including fleets that are away. */
export async function totalUnitsOf(tx: Tx, planetId: string): Promise<Fleet> {
  const rows = await tx.select().from(units).where(eq(units.planetId, planetId));
  const out: Fleet = {};
  for (const r of rows) out[r.hull] = (out[r.hull] ?? 0) + r.count;
  return out;
}

/** Building levels for a planet we are not holding a lock on. */
export async function buildingLevelsOf(tx: Tx, planetId: string): Promise<BuildingLevels> {
  const rows = await tx.select().from(buildings).where(eq(buildings.planetId, planetId));
  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, 0])) as BuildingLevels;
  for (const r of rows) levels[r.type as BuildingId] = r.level;
  return levels;
}

export const planetIdsOfPlayers = (tx: Tx, playerIds: string[]) =>
  tx.select().from(planets).where(inArray(planets.playerId, playerIds));
