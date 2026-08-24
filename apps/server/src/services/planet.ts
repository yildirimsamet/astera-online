import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  advanceEconomy,
  productionMult,
  satelliteSlots,
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
  DEATH_STAR,
} from '@astera/rules';
import { minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  buildings,
  buildOrders,
  missions,
  planets,
  players,
  satellites,
  seasons,
  strategicAssets,
  units,
} from '../db/schema.js';

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

/**
 * Installed orbit rows to the effective slots opened by the current Core.
 *
 * Keeping this as the one projection matters for reads assembled without
 * `loadLocked` too: a stored satellite in a closed slot must not improve mining
 * just because that endpoint used a cheaper query shape.
 */
export function orbitFromRows(
  rows: readonly { slot: number; type: string }[],
  coreLevel: number,
): SatelliteSet {
  // A joined read can repeat a hardware row once per active flight. Collapse by
  // its real primary key before applying the slot limit.
  const bySlot = new Map<number, string>();
  for (const row of rows) {
    if (KNOWN_SATELLITES.has(row.type) && !bySlot.has(row.slot)) {
      bySlot.set(row.slot, row.type);
    }
  }
  return [...bySlot]
    .toSorted(([a], [b]) => a - b)
    .slice(0, satelliteSlots(coreLevel))
    .map(([, type]) => type as SatelliteId);
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
  kind: 'CAPITAL' | 'COLONY';
  seasonId: string;
  seasonStart: Date;
  seasonEndsAt: Date;
  name: string;
  x: number; y: number; z: number;
  /** In storage: spendable, vault-protected, fully exposed to a raid. */
  alloy: number;
  crystal: number;
  deuterium: number;
  /** In the works: not spendable until collected, exposed at half. D16. */
  bufferAlloy: number;
  bufferCrystal: number;
  bufferDeuterium: number;
  shield: number;
  disruptedUntil: Date | null;
  recoveryUntil: Date | null;
  protectedUntil: Date | null;
  buildings: BuildingLevels;
  /** Ground installations, with their levels. */
  instruments: InstrumentLevels;
  /** Effects after Core and active-Uplink prerequisites are applied. */
  effectiveInstruments: InstrumentLevels;
  /** What is in orbit. Presence is the whole state — D25. */
  orbit: SatelliteSet;
  /** Every installed satellite, including slots made inactive by Core damage. */
  storedOrbit: SatelliteSet;
  /** Units physically at home right now. Anything in flight is not here. */
  homeFleet: Fleet;
  ground: Fleet;
  /** Minutes since season start, at the moment the lock was taken. */
  nowMinutes: number;
  now: Date;
}

/** The figures a refusal is built from, sent alongside it so it can be re-said. */
export type ErrorParams = Record<string, string | number>;

/**
 * A refusal the player is allowed to read.
 *
 * `message` is the English sentence and stays authoritative for anything that
 * cannot look the code up. `params` is the same fact taken apart: the client has
 * its own catalogue keyed by `code`, and a sentence with its numbers already
 * baked in cannot be translated after the fact — "All 4 flight bays are in use"
 * is finished English. Sending both costs one object and is what lets the same
 * refusal arrive in Turkish with the 4 still in it.
 *
 * Only interpolating errors need it. A refusal whose sentence is fixed carries no
 * params and needs none.
 */
export class GameError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly params?: ErrorParams,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/** Mutations and launches stop for the whole exact recovery window. */
export function assertWorldOperational(planet: LockedPlanet): void {
  if (planet.recoveryUntil !== null && planet.recoveryUntil > planet.now) {
    throw new GameError('WORLD_RECOVERING', 'That world is recovering', 409, {
      until: planet.recoveryUntil.toISOString(),
    });
  }
}

/**
 * The season is always locked before a planet. D85.
 *
 * Shared locks let ordinary mutations run together but make freeze wait for every
 * one that already began. Once freeze commits, the next waiter reads `frozen` and
 * is refused before it can touch a planet row.
 */
export async function lockSeason(
  tx: Tx,
  seasonId: string,
  requireLive = true,
): Promise<typeof seasons.$inferSelect> {
  const [season] = await tx
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .for('share');
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  if (requireLive && season.status !== 'live') {
    throw new GameError('SEASON_FROZEN', 'That season is over', 409);
  }
  return season;
}

/** A new commitment may not leave unresolved state behind the season boundary. */
export function assertSeasonOpenThrough(planet: LockedPlanet, completesAt: Date): void {
  if (completesAt.getTime() <= planet.seasonEndsAt.getTime()) return;
  throw new GameError(
    'SEASON_ENDS_BEFORE_RETURN',
    'That squadron cannot return before the season ends',
    409,
    { endsAt: planet.seasonEndsAt.toISOString() },
  );
}

/**
 * Load a planet under a row lock and advance its continuous state to `now`.
 *
 * The lazy tick runs INSIDE the lock, which is what makes double-spending
 * impossible: a second transaction blocks here, then re-reads post-commit state
 * and fails its own affordability check.
 */
export async function loadLocked(
  tx: Tx,
  planetId: string,
  clock: Clock,
  options: { requireLive?: boolean; expectedPlayerId?: string } = {},
): Promise<LockedPlanet> {
  // Resolve the parent first without locking the child, then take locks in the
  // global season → planet order. A planet never changes season after creation.
  const [identity] = await tx
    .select({ seasonId: planets.seasonId })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!identity) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);

  const season = await lockSeason(tx, identity.seasonId, options.requireLive ?? true);
  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (!row) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  if (!row.controllerPlayerId || row.kind === 'NEUTRAL') {
    throw new GameError('PLANET_NOT_OWNED', 'That world has no commander', 403);
  }
  if (options.expectedPlayerId !== undefined && row.controllerPlayerId !== options.expectedPlayerId) {
    throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
  }

  const [buildingRows, satelliteRows, unitRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, planetId)),
    tx.select().from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home'))),
  ]);

  const levels = buildingLevelsFrom(buildingRows);

  const { instruments } = installedFrom(satelliteRows);
  // Stored hardware is a physical slot sequence too. SQL row order is not a
  // contract; using the same projection as the effective prefix prevents Core
  // damage from making a different satellite active on different reads.
  const storedOrbit = orbitFromRows(satelliteRows, Number.MAX_SAFE_INTEGER);
  const orbit = orbitFromRows(satelliteRows, levels.CORE);
  const effectiveInstruments = Object.fromEntries(
    INSTRUMENT_IDS.map((id) => [
      id,
      (id === 'TELESCOPE' || id === 'RADAR') && !orbit.includes('UPLINK')
        ? 0
        : Math.min(instruments[id] ?? 0, levels.CORE),
    ]),
  ) as InstrumentLevels;

  const homeFleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    (HULLS[u.hull].ground ? ground : homeFleet)[u.hull] = u.count;
  }

  const requestedNow = clock.now();
  const now = season.status === 'live' || requestedNow <= season.endsAt
    ? requestedNow
    : season.endsAt;
  const nowMinutes = minutesSince(season.startsAt, now);

  const recovering = row.recoveryUntil !== null && row.recoveryUntil > now;
  const advanced = recovering ? {
    alloy: row.alloy,
    crystal: row.crystal,
    deuterium: row.deuterium,
    bufferAlloy: row.bufferAlloy,
    bufferCrystal: row.bufferCrystal,
    bufferDeuterium: row.bufferDeuterium,
    shield: row.shield,
    lastTickMinutes: nowMinutes,
  } : advanceEconomy(
    {
      alloy: row.alloy,
      crystal: row.crystal,
      deuterium: row.deuterium,
      bufferAlloy: row.bufferAlloy,
      bufferCrystal: row.bufferCrystal,
      bufferDeuterium: row.bufferDeuterium,
      shield: row.shield,
      lastTickMinutes: minutesSince(season.startsAt, row.lastTickAt),
      disruptedUntilMinutes: row.disruptedUntil
        ? minutesSince(season.startsAt, row.disruptedUntil)
        : 0,
    },
    {
      refineryLevel: levels.REFINERY,
      extractorLevel: levels.EXTRACTOR,
      // The store's ceiling scales with the Vault now, so `collect()` needs it.
      vaultLevel: levels.VAULT,
      aegisLevel: effectiveInstruments.AEGIS ?? 0,
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
        deuterium: advanced.deuterium,
        bufferAlloy: advanced.bufferAlloy,
        bufferCrystal: advanced.bufferCrystal,
        bufferDeuterium: advanced.bufferDeuterium,
        shield: advanced.shield,
        lastTickAt: now,
      })
      .where(eq(planets.id, planetId));
  }

  return {
    planetId: row.id,
    playerId: row.controllerPlayerId,
    kind: row.kind,
    seasonId: row.seasonId,
    seasonStart: season.startsAt,
    seasonEndsAt: season.endsAt,
    name: row.name,
    x: row.x, y: row.y, z: row.z,
    alloy: advanced.alloy,
    crystal: advanced.crystal,
    deuterium: advanced.deuterium,
    bufferAlloy: advanced.bufferAlloy,
    bufferCrystal: advanced.bufferCrystal,
    bufferDeuterium: advanced.bufferDeuterium,
    shield: advanced.shield,
    disruptedUntil: row.disruptedUntil,
    recoveryUntil: row.recoveryUntil,
    protectedUntil: row.protectedUntil,
    buildings: levels,
    instruments,
    effectiveInstruments,
    orbit,
    storedOrbit,
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
  expectedPlayerId?: string,
): Promise<T> {
  return db.transaction(async (tx) => fn(
    tx,
    await loadLocked(tx, planetId, clock, { expectedPlayerId }),
  ));
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
    deuterium: number;
    /** Omit to leave the works untouched — most callers only move storage. */
    bufferAlloy?: number;
    bufferCrystal?: number;
    bufferDeuterium?: number;
    shield?: number;
    disruptedUntil?: Date | null;
  },
): Promise<void> {
  await tx
    .update(planets)
    .set({
      alloy: next.alloy,
      crystal: next.crystal,
      deuterium: next.deuterium,
      ...(next.bufferAlloy !== undefined ? { bufferAlloy: next.bufferAlloy } : {}),
      ...(next.bufferCrystal !== undefined ? { bufferCrystal: next.bufferCrystal } : {}),
      ...(next.bufferDeuterium !== undefined
        ? { bufferDeuterium: next.bufferDeuterium }
        : {}),
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
  ownerPlayerId?: string,
): Promise<void> {
  const entries = Object.entries(fleet) as [HullId, number][];
  if (entries.length === 0) return;
  const owner = ownerPlayerId ?? (await tx
    .select({ id: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, planetId)))[0]?.id;
  if (!owner) throw new GameError('PLANET_NOT_OWNED', 'Units need a commander', 409);
  for (const [hull, count] of entries) {
    await tx
      .insert(units)
      .values({ planetId, ownerPlayerId: owner, hull, location, count: Math.max(0, count) })
      .onConflictDoUpdate({
        target: [units.planetId, units.hull, units.location],
        set: { ownerPlayerId: owner, count: Math.max(0, count) },
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
  if (!row?.controllerPlayerId) return 0;

  return recomputePlayerWealth(tx, row.controllerPlayerId);
}

/** Commander-wide Wealth across every controlled world and every owned flight. */
export async function recomputePlayerWealth(tx: Tx, playerId: string): Promise<number> {
  const worlds = await tx
    .select()
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  if (worlds.length === 0) {
    await tx.update(players).set({ wealth: 0 }).where(eq(players.id, playerId));
    return 0;
  }
  const worldIds = worlds.map((world) => world.id);

  const [
    buildingRows,
    satelliteRows,
    unitRows,
    inventoryAssets,
    launchedAssets,
    cargoMissions,
    committedBuilds,
  ] = await Promise.all([
    tx.select().from(buildings).where(inArray(buildings.planetId, worldIds)),
    tx.select().from(satellites).where(inArray(satellites.planetId, worldIds)),
    tx.select().from(units).where(or(
      eq(units.ownerPlayerId, playerId),
      and(isNull(units.ownerPlayerId), inArray(units.planetId, worldIds)),
    )),
    tx.select({ id: strategicAssets.id }).from(strategicAssets).where(and(
      inArray(strategicAssets.planetId, worldIds),
      inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
    )),
    tx
      .select({ id: strategicAssets.id })
      .from(strategicAssets)
      .innerJoin(missions, eq(strategicAssets.missionId, missions.id))
      .where(and(
        eq(strategicAssets.status, 'LAUNCHED'),
        eq(missions.ownerPlayerId, playerId),
      )),
    tx
      .select({ cargo: missions.cargo, loot: missions.loot })
      .from(missions)
      .where(and(eq(missions.ownerPlayerId, playerId), eq(missions.status, 'in_flight'))),
    tx
      .select({ cost: buildOrders.cost })
      .from(buildOrders)
      .where(and(
        inArray(buildOrders.planetId, worldIds),
        eq(buildOrders.status, 'BUILDING'),
      )),
  ]);

  let value = 0;
  for (const world of worlds) {
    const levels = buildingLevelsFrom(buildingRows.filter((row) => row.planetId === world.id));
    const { instruments, orbit } = installedFrom(
      satelliteRows.filter((row) => row.planetId === world.id),
    );
    value += wealth({
      buildings: levels,
      instruments,
      satellites: orbit,
      fleet: {},
      ground: {},
      alloy: world.alloy + world.bufferAlloy,
      crystal: world.crystal + world.bufferCrystal,
      deuterium: world.deuterium + world.bufferDeuterium,
    });
  }
  for (const unit of unitRows) {
    if (unit.count <= 0) continue;
    const hull = HULLS[unit.hull];
    value += unit.count * (hull.alloy + hull.crystal + hull.deuterium);
  }
  const strategicUnitValue =
    DEATH_STAR.cost.alloy + DEATH_STAR.cost.crystal + DEATH_STAR.cost.deuterium;
  value += (inventoryAssets.length + launchedAssets.length) * strategicUnitValue;
  for (const mission of cargoMissions) {
    const cargo = mission.cargo;
    const loot = mission.loot;
    if (cargo) value += cargo.alloy + cargo.crystal + cargo.deuterium;
    if (loot) value += loot.alloy + loot.crystal + loot.deuterium;
  }
  // Queueing changes where value sits, never whether the commander owns it. D4.
  for (const order of committedBuilds) {
    value += order.cost.alloy + order.cost.crystal + order.cost.deuterium;
  }
  value = Math.round(value);
  await tx.update(players).set({ wealth: value }).where(eq(players.id, playerId));
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
  const [rows, [core]] = await Promise.all([
    tx.select().from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select({ level: buildings.level }).from(buildings)
      .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE'))),
  ]);
  return orbitFromRows(rows, core?.level ?? 0);
}

/** Building levels for a planet we are not holding a lock on. */
export async function buildingLevelsOf(tx: Tx, planetId: string): Promise<BuildingLevels> {
  const rows = await tx.select().from(buildings).where(eq(buildings.planetId, planetId));
  return buildingLevelsFrom(rows);
}

export const planetIdsOfPlayers = (tx: Tx, playerIds: string[]) =>
  tx.select().from(planets).where(inArray(planets.controllerPlayerId, playerIds));
