import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  advanceEconomy,
  productionMult,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type Fleet,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type SatelliteId,
  type SatelliteSet,
  HULLS,
} from '@blindspace/rules';
import { minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { buildings, planets, players, satellites, seasons, units } from '../db/schema.js';

/**
 * The buildings that exist, as a set, for rejecting rows that name one that does
 * not.
 *
 * The Orbital Ring was retired in D22 and its rows are still in the database of
 * any season that predates the change. Reading one back into `BuildingLevels`
 * would put a key on the object that the type says cannot be there, and `wealth()`
 * iterates that object — so a decommissioned structure would keep contributing to
 * a live player's Wealth, and therefore to the rank floor that decides who may
 * attack them. Skipping unknown types is what keeps a legacy row inert.
 */
const KNOWN_BUILDINGS = new Set<string>(BUILDING_IDS);

/**
 * The two id spaces the `satellites` table holds, and why unknown rows are dropped.
 *
 * D25 split installed hardware into ground INSTRUMENTS with levels and orbit
 * SATELLITES without. Both live in one table, told apart by their id. A row naming
 * something retired — the DRILL satellite, before it became a craft — belongs to
 * neither list and is skipped, so it can never go on contributing to Wealth and
 * therefore to the rank floor that decides who may attack a player.
 */
const KNOWN_INSTRUMENTS = new Set<string>(INSTRUMENT_IDS);
const KNOWN_SATELLITES = new Set<string>(SATELLITE_IDS);

interface Installed {
  instruments: InstrumentLevels;
  orbit: SatelliteSet;
}

/** Rows to the two shapes the game reads, with anything retired left behind. */
function installedFrom(rows: readonly { type: string; level: number }[]): Installed {
  const instruments: InstrumentLevels = {};
  const orbit: SatelliteId[] = [];
  for (const row of rows) {
    if (KNOWN_INSTRUMENTS.has(row.type)) instruments[row.type as InstrumentId] = row.level;
    else if (KNOWN_SATELLITES.has(row.type)) orbit.push(row.type as SatelliteId);
  }
  return { instruments, orbit };
}

/** Rows to levels, with every building present at zero and nothing else present. */
function buildingLevelsFrom(rows: readonly { type: string; level: number }[]): BuildingLevels {
  const levels = Object.fromEntries(BUILDING_IDS.map((b) => [b, 0])) as BuildingLevels;
  for (const row of rows) {
    if (!KNOWN_BUILDINGS.has(row.type)) continue;
    levels[row.type as BuildingId] = row.level;
  }
  return levels;
}

export interface LockedPlanet {
  planetId: string;
  playerId: string;
  seasonId: string;
  seasonStart: Date;
  name: string;
  x: number; y: number; z: number;
  /** In storage: spendable, vault-protected, fully exposed to a raid. */
  alloy: number;
  crystal: number;
  /** In the works: not spendable until collected, exposed at half. D16. */
  bufferAlloy: number;
  bufferCrystal: number;
  shield: number;
  disruptedUntil: Date | null;
  buildings: BuildingLevels;
  /** Ground installations, with their levels. */
  instruments: InstrumentLevels;
  /** What is in orbit. Presence is the whole state — D25. */
  orbit: SatelliteSet;
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

  const levels = buildingLevelsFrom(buildingRows);

  const { instruments, orbit } = installedFrom(satelliteRows);

  const homeFleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    (HULLS[u.hull].ground ? ground : homeFleet)[u.hull] = u.count;
  }

  const now = clock.now();
  const nowMinutes = minutesSince(season.startsAt, now);

  const advanced = advanceEconomy(
    {
      alloy: row.alloy,
      crystal: row.crystal,
      bufferAlloy: row.bufferAlloy,
      bufferCrystal: row.bufferCrystal,
      shield: row.shield,
      lastTickMinutes: minutesSince(season.startsAt, row.lastTickAt),
      disruptedUntilMinutes: row.disruptedUntil
        ? minutesSince(season.startsAt, row.disruptedUntil)
        : 0,
    },
    {
      refineryLevel: levels.REFINERY,
      extractorLevel: levels.EXTRACTOR,
      aegisLevel: instruments.AEGIS ?? 0,
      // A Foundry lifts the rate, and therefore the caps that follow from it. D25.
      production: productionMult(orbit),
    },
    nowMinutes,
  );

  if (advanced.lastTickMinutes !== minutesSince(season.startsAt, row.lastTickAt)) {
    await tx
      .update(planets)
      .set({
        alloy: advanced.alloy,
        crystal: advanced.crystal,
        bufferAlloy: advanced.bufferAlloy,
        bufferCrystal: advanced.bufferCrystal,
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
    bufferAlloy: advanced.bufferAlloy,
    bufferCrystal: advanced.bufferCrystal,
    shield: advanced.shield,
    disruptedUntil: row.disruptedUntil,
    buildings: levels,
    instruments,
    orbit,
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
  next: {
    alloy: number;
    crystal: number;
    /** Omit to leave the works untouched — most callers only move storage. */
    bufferAlloy?: number;
    bufferCrystal?: number;
    shield?: number;
    disruptedUntil?: Date | null;
  },
): Promise<void> {
  await tx
    .update(planets)
    .set({
      alloy: next.alloy,
      crystal: next.crystal,
      ...(next.bufferAlloy !== undefined ? { bufferAlloy: next.bufferAlloy } : {}),
      ...(next.bufferCrystal !== undefined ? { bufferCrystal: next.bufferCrystal } : {}),
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
 * Denormalised so the ladder is one read — and that denormalisation was silently
 * broken. `wealth` was written ONLY when a player bought something, so it was
 * never written at all for a player who had not: a fresh commander sat at zero.
 * It also went stale after every raid, since combat moves resources and units
 * without anyone "buying" anything.
 *
 * IT NO LONGER DECIDES WHO MAY ATTACK WHOM. D49 replaced the Wealth ratio with a
 * development-tier band, so a stale figure here is now a wrong number on the
 * ladder rather than a player who cannot be attacked at all — which is what it
 * used to be, and is why this function exists.
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

  const levels = buildingLevelsFrom(buildingRows);

  const { instruments, orbit } = installedFrom(satelliteRows);

  const fleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    const bucket = HULLS[u.hull].ground ? ground : fleet;
    bucket[u.hull] = (bucket[u.hull] ?? 0) + u.count;
  }

  const value = wealth({
    buildings: levels,
    instruments,
    satellites: orbit,
    fleet,
    ground,
    // Uncollected ore is owned, so it is Wealth — and Wealth is what the rank
    // floor reads. Counting only storage would make a player cheapest, and so
    // most protected from attack, at exactly the moment they were carrying the
    // most: overnight, with the works full and nothing collected.
    alloy: row.alloy + row.bufferAlloy,
    crystal: row.crystal + row.bufferCrystal,
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

/**
 * A planet's own craft that are NOT standing on it.
 *
 * `homeFleet` answers "what could I launch"; this answers "what do I own that is
 * already out". They differ for the whole of every round trip, and a rule about
 * ownership — `PROSPECTOR.max` — has to read the second one or a player empties
 * the cap simply by having their craft in the air.
 */
export async function awayFleet(tx: Tx, planetId: string): Promise<Fleet> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), ne(units.location, 'home')));
  const out: Fleet = {};
  for (const r of rows) if (r.count > 0) out[r.hull] = (out[r.hull] ?? 0) + r.count;
  return out;
}

/**
 * What is in a planet's orbit, without taking a lock. D25.
 *
 * Several systems need it and none of them is mutating the planet: mining reads the
 * Derrick, a launch reads the Beacon, the economy reads the Foundry. Keeping one
 * answer means a satellite that changes a number cannot be honoured in one place
 * and forgotten in another.
 */
export async function orbitOf(tx: Queryable, planetId: string): Promise<SatelliteSet> {
  const rows = await tx.select().from(satellites).where(eq(satellites.planetId, planetId));
  return installedFrom(rows).orbit;
}

/** Building levels for a planet we are not holding a lock on. */
export async function buildingLevelsOf(tx: Tx, planetId: string): Promise<BuildingLevels> {
  const rows = await tx.select().from(buildings).where(eq(buildings.planetId, planetId));
  return buildingLevelsFrom(rows);
}

export const planetIdsOfPlayers = (tx: Tx, playerIds: string[]) =>
  tx.select().from(planets).where(inArray(planets.playerId, playerIds));
