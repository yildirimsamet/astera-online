import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  FAULT,
  advanceEconomy,
  advanceLoyalty,
  alloyRate,
  faultsPossible,
  crystalRate,
  deuteriumRate,
  productionMult,
  satelliteSlots,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type FaultKind,
  type FaultSet,
  type Fleet,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type Resources,
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
  clanLootShares,
  missions,
  planetFaults,
  planets,
  players,
  researchOrders,
  satellites,
  seasonTelemetrySegments,
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

/**
 * What a world's installed rows add up to, as every read of the world sees it.
 *
 * Stored hardware is a physical slot sequence too. SQL row order is not a contract;
 * using the same projection as the effective prefix prevents Core damage from making
 * a different satellite active on different reads.
 */
export function hardwareOf(
  rows: readonly { slot: number; type: string; level: number }[],
  levels: BuildingLevels,
) {
  const { instruments } = installedFrom(rows);
  const storedOrbit = orbitFromRows(rows, Number.MAX_SAFE_INTEGER);
  const orbit = orbitFromRows(rows, levels.CORE);
  const effectiveInstruments = Object.fromEntries(
    INSTRUMENT_IDS.map((id) => [
      id,
      (id === 'TELESCOPE' || id === 'RADAR') && !orbit.includes('UPLINK')
        ? 0
        : Math.min(instruments[id] ?? 0, levels.CORE),
    ]),
  ) as InstrumentLevels;
  return { instruments, effectiveInstruments, orbit, storedOrbit };
}

/**
 * WHERE A WORLD'S ECONOMY STANDS AT `requestedNow`, COMPUTED AND NEVER WRITTEN. D199.
 *
 * `loadLocked` writes what this returns; a probe reads it and writes nothing. One
 * piece of arithmetic for both, so a report and the raid that follows it cannot
 * look at two different worlds — which they did while the probe read the row as it
 * lay, hours of production short of what the raid then found.
 *
 * A world in recovery is frozen where it stands, and a season that has ended stops
 * the clock at its end.
 */
export function economyAt(
  row: typeof planets.$inferSelect,
  levels: BuildingLevels,
  hardware: { effectiveInstruments: InstrumentLevels; orbit: SatelliteSet },
  season: Pick<typeof seasons.$inferSelect, 'startsAt' | 'endsAt' | 'status'>,
  requestedNow: Date,
  /**
   * WHAT IS BROKEN HERE, and every caller has to be able to say so.
   *
   * A probe reads this function too (`intel.ts`), and a report that quoted a stock
   * computed as though the refinery were running would be the intel layer lying about
   * something the observer paid for. Defaults to nothing broken, so a caller with no
   * fault rows to hand reads exactly the figures it always did.
   */
  faults: FaultSet = [],
  leakedSoFar?: Resources,
) {
  // The deadline is an economic boundary even when the worker claims the freeze
  // event late. Status remains `live` during afterglow, but production does not.
  const now = requestedNow <= season.endsAt ? requestedNow : season.endsAt;
  const nowMinutes = minutesSince(season.startsAt, now);

  const recovering = row.recoveryUntil !== null && row.recoveryUntil > now;
  const economyInput = {
    refineryLevel: levels.REFINERY,
    extractorLevel: levels.EXTRACTOR,
    plantLevel: levels.DEUTERIUM_PLANT,
    vaultLevel: levels.VAULT,
    aegisLevel: hardware.effectiveInstruments.AEGIS ?? 0,
    production: productionMult(hardware.orbit),
    recoveryBoostUntilMinutes: row.recoveryBoostUntil
      ? minutesSince(season.startsAt, row.recoveryBoostUntil)
      : null,
    faults,
    ...(leakedSoFar ? { leakedSoFar } : {}),
  };
  const state = recovering ? {
    alloy: row.alloy,
    crystal: row.crystal,
    deuterium: row.deuterium,
    bufferAlloy: row.bufferAlloy,
    bufferCrystal: row.bufferCrystal,
    bufferDeuterium: row.bufferDeuterium,
    shield: row.shield,
    lastTickMinutes: nowMinutes,
    // A world under recovery is frozen, and that includes a broken vault: nothing is
    // produced, so nothing is bleeding. The piles are carried across untouched.
    pendingLeakAlloy: row.pendingLeakAlloy,
    pendingLeakCrystal: row.pendingLeakCrystal,
    pendingLeakDeuterium: row.pendingLeakDeuterium,
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
      // A lazy tick advances the SAME pending pile. Omitting these three made every
      // read replace the previous interval with the newest one, so a leak observed
      // twice never accumulated beyond one observation interval.
      pendingLeakAlloy: row.pendingLeakAlloy,
      pendingLeakCrystal: row.pendingLeakCrystal,
      pendingLeakDeuterium: row.pendingLeakDeuterium,
    },
    economyInput,
    nowMinutes,
  );
  const produced = {
    alloy: Math.max(0, state.bufferAlloy - row.bufferAlloy),
    crystal: Math.max(0, state.bufferCrystal - row.bufferCrystal),
    deuterium: Math.max(0, state.bufferDeuterium - row.bufferDeuterium),
  };
  const boost = economyInput.production;
  const rates = [
    alloyRate(economyInput.refineryLevel) * boost,
    crystalRate(economyInput.extractorLevel) * boost,
    deuteriumRate(economyInput.plantLevel) * boost,
  ];
  const generated = [produced.alloy, produced.crystal, produced.deuterium];
  const productiveSeconds = Math.max(...generated.map((amount, index) => {
    const rate = rates[index] ?? 0;
    return rate <= 0 ? 0 : amount / rate * 3_600;
  }));
  return { state, now, nowMinutes, produced, productiveSeconds };
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
  /**
   * How far this world's commander got through the Academy, or null if it was
   * never claimed through one. The single server-side answer to "is this
   * commander NEW" — see `planetView`, which publishes it.
   */
  academyStep: number | null;
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
  /** The recovery shield's production boost on this world; see `planets.recoveryBoostUntil`. */
  recoveryBoostUntil: Date | null;
  buildings: BuildingLevels;
  /** Ground installations, with their levels. */
  instruments: InstrumentLevels;
  /** Effects after Core and active-Uplink prerequisites are applied. */
  effectiveInstruments: InstrumentLevels;
  /** What is in orbit. Presence is the whole state — D25. */
  orbit: SatelliteSet;
  /** Every installed satellite, including slots made inactive by Core damage. */
  storedOrbit: SatelliteSet;
  seasonTelemetry: (typeof planets.$inferSelect)['seasonTelemetry'];
  /**
   * WHAT IS BROKEN HERE. Koloni arızaları; empty on a capital, always.
   *
   * Loaded under the same lock as everything else, so a caller deciding whether a
   * fleet may leave reads the same instant as the caller deciding what the works
   * produced. Five of the eight are enforced by their READER rather than here — the
   * flight bay, the battle, the sensor post — and this list is what they all read.
   */
  faults: FaultKind[];
  /**
   * 0-100 on a colony past the Core gate; `FAULT.loyaltyMax` everywhere else.
   *
   * Already advanced to `now`, like the ore. A caller that wants "how long has this
   * world got" asks `minutesUntilLoyaltyZero` with this and `faults.length`.
   */
  loyalty: number;
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
  if (planet.kind === 'COLONY' && planet.loyalty <= 0) {
    /*
      ZERO IS ALREADY THE SECESSION BOUNDARY.

      The scheduled event performs the ownership hand-over, but a worker may claim it
      a fraction late. Without this guard, a request in that seam could launch a fleet,
      place an order or even start a repair after the lazy tick had proved the colony
      was no longer loyal. The queue remains the writer; player actions simply cannot
      step past its authoritative boundary.
    */
    throw new GameError(
      'COLONY_SECESSION_PENDING',
      'That colony has reached zero loyalty and is seceding',
      409,
    );
  }
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
  // global season → planet order. The pre-read locates a lock, not authority.
  const [identity] = await tx
    .select({ seasonId: planets.seasonId })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!identity) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);

  const season = await lockSeason(tx, identity.seasonId, options.requireLive ?? true);
  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
  if (!row) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  if (row.seasonId !== season.id) {
    throw new GameError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
  }
  if (!row.controllerPlayerId || row.kind === 'NEUTRAL') {
    throw new GameError('PLANET_NOT_OWNED', 'That world has no commander', 403);
  }
  if (options.expectedPlayerId !== undefined && row.controllerPlayerId !== options.expectedPlayerId) {
    throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
  }

  const [buildingRows, satelliteRows, unitRows, faultRows] = await Promise.all([
    tx.select().from(buildings).where(eq(buildings.planetId, planetId)),
    tx.select().from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home'))),
    tx.select().from(planetFaults).where(eq(planetFaults.planetId, planetId)),
  ]);
  const faults = faultRows.map((fault) => fault.kind);
  /*
    THE LEAK'S OWN CEILING, and it is read off the fault rather than the world.

    `FAULT.leakTotalStores` caps what ONE occurrence may cost. A vault repaired and
    broken again is a second flood with a second budget, which is what the commander
    paid the repair for.
  */
  const leak = faultRows.find((fault) => fault.kind === 'VAULT_LEAK');
  /*
    SPENT = WHAT REACHED ORBIT + WHAT IS ON ITS WAY THERE.

    The fault row counts only what a flush has already turned into a field; the rest is
    sitting in `pending_leak_*` on this row. Passing the first without the second would
    let a leak overrun its ceiling by one flush interval every time — and the flush
    moves the figure between the two columns, so their sum is what the ceiling is
    actually about.
  */
  const leakedSoFar = leak && {
    alloy: leak.leakedAlloy + row.pendingLeakAlloy,
    crystal: leak.leakedCrystal + row.pendingLeakCrystal,
    deuterium: leak.leakedDeuterium + row.pendingLeakDeuterium,
  };

  const levels = buildingLevelsFrom(buildingRows);
  const { instruments, effectiveInstruments, orbit, storedOrbit } = hardwareOf(satelliteRows, levels);

  const homeFleet: Fleet = {};
  const ground: Fleet = {};
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    (HULLS[u.hull].ground ? ground : homeFleet)[u.hull] = u.count;
  }

  const { state: advanced, now, nowMinutes, produced, productiveSeconds } = economyAt(
    row,
    levels,
    { effectiveInstruments, orbit },
    season,
    clock.now(),
    faults,
    leakedSoFar ?? undefined,
  );

  /*
    SADAKAT DUVAR SAATİYLE İLERLER, üretken dakikalarla değil.

    It is about NEGLECT, not about output: a raid that stopped the works did not repair
    anything, and a world sitting broken through a disruption is still sitting broken.
    The shield already keeps wall time for the same kind of reason.

    A world that cannot break holds the maximum rather than being left at whatever it
    last had. `planetView` publishes null there, so the figure is never read — but a
    colony demoted below the gate coming back with a half-empty bar it can no longer
    refill is the sort of state nothing would ever repair.
  */
  const breakable = faultsPossible({
    kind: row.kind,
    coreLevel: levels.CORE,
    plantLevel: levels.DEUTERIUM_PLANT,
  });
  const loyalty = breakable
    ? advanceLoyalty(row.loyalty, faults.length, (now.getTime() - row.lastTickAt.getTime()) / 60_000)
    : FAULT.loyaltyMax;

  if (advanced.lastTickMinutes !== minutesSince(season.startsAt, row.lastTickAt)) {
    /*
      A HAND-OVER THAT DID NOT COME THROUGH `transferPlanetControl`, REPAIRED
      RATHER THAN REFUSED.

      The telemetry counter on the row belongs to ONE actor at a time, and the
      ordinary conquest path closes the old actor's segment and restarts the
      counter in the same statement. Anything else that moves `player_id` — an
      operator's SQL, a CLI, a fixture, a future writer that forgets — would leave
      the counter accumulating the new controller's production under the old
      commander's name.

      THIS USED TO THROW, AND THAT WAS THE MORE DANGEROUS ANSWER. `loadLocked` is
      the gate every screen, every launch and every worker tick passes through, so
      an exception here does not lose a statistic: it takes the world off the board
      entirely, for everyone, until somebody notices — the exact shape of the D47
      outage `schema-drift.test.ts` exists to remember. A season metric must never
      be able to do that.

      So the mismatch is closed the same way a real hand-over is: the former
      actor's accumulated figures become an immutable segment, and the counter
      restarts for whoever holds the world now. The interval being advanced right
      now is credited to the current controller, because the row records no instant
      at which control actually moved.
    */
    const formerActor = row.statsOwnerPlayerId !== null
      && row.statsOwnerPlayerId !== row.controllerPlayerId
      ? row.statsOwnerPlayerId
      : null;
    if (formerActor !== null) {
      await tx.insert(seasonTelemetrySegments).values({
        seasonId: row.seasonId,
        playerId: formerActor,
        sourcePlanetId: planetId,
        telemetry: row.seasonTelemetry,
        closedAt: row.lastTickAt,
      });
      row.seasonTelemetry = {
        produced: { alloy: 0, crystal: 0, deuterium: 0 },
        productiveSeconds: 0,
        shipsBuilt: {},
      };
    }
    row.seasonTelemetry = {
      produced: {
        alloy: row.seasonTelemetry.produced.alloy + produced.alloy,
        crystal: row.seasonTelemetry.produced.crystal + produced.crystal,
        deuterium: row.seasonTelemetry.produced.deuterium + produced.deuterium,
      },
      productiveSeconds: row.seasonTelemetry.productiveSeconds + productiveSeconds,
      shipsBuilt: row.seasonTelemetry.shipsBuilt,
    };
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
        pendingLeakAlloy: advanced.pendingLeakAlloy ?? row.pendingLeakAlloy,
        pendingLeakCrystal: advanced.pendingLeakCrystal ?? row.pendingLeakCrystal,
        pendingLeakDeuterium: advanced.pendingLeakDeuterium ?? row.pendingLeakDeuterium,
        loyalty,
        lastTickAt: now,
        statsOwnerPlayerId: row.controllerPlayerId,
        seasonTelemetry: row.seasonTelemetry,
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
    academyStep: row.academyStep,
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
    recoveryBoostUntil: row.recoveryBoostUntil,
    buildings: levels,
    instruments,
    effectiveInstruments,
    orbit,
    storedOrbit,
    seasonTelemetry: row.seasonTelemetry,
    faults,
    loyalty,
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
    committedResearch,
    [unclaimedClanLoot],
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
      .select({ cargo: missions.cargo, loot: missions.loot, salvage: missions.salvage })
      .from(missions)
      .where(and(eq(missions.ownerPlayerId, playerId), eq(missions.status, 'in_flight'))),
    tx
      .select({ cost: buildOrders.cost })
      .from(buildOrders)
      .where(and(
        inArray(buildOrders.planetId, worldIds),
        eq(buildOrders.status, 'BUILDING'),
      )),
    tx
      .select({ cost: researchOrders.cost })
      .from(researchOrders)
      .where(and(
        eq(researchOrders.playerId, playerId),
        eq(researchOrders.status, 'BUILDING'),
      )),
    tx
      .select({
        alloy: sql<number>`coalesce(sum(${clanLootShares.remainingAlloy}), 0)`,
        crystal: sql<number>`coalesce(sum(${clanLootShares.remainingCrystal}), 0)`,
        deuterium: sql<number>`coalesce(sum(${clanLootShares.remainingDeuterium}), 0)`,
      })
      .from(clanLootShares)
      .where(eq(clanLootShares.playerId, playerId)),
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
    // The wreck a return leg's collectors lifted is owned in the air as surely as its loot. D200.
    const salvage = mission.salvage;
    if (cargo) value += cargo.alloy + cargo.crystal + cargo.deuterium;
    if (loot) value += loot.alloy + loot.crystal + loot.deuterium;
    if (salvage) value += salvage.alloy + salvage.crystal + salvage.deuterium;
  }
  // Queueing changes where value sits, never whether the commander owns it. D4.
  for (const order of committedBuilds) {
    value += order.cost.alloy + order.cost.crystal + order.cost.deuterium;
  }
  for (const order of committedResearch) {
    value += order.cost.alloy + order.cost.crystal + order.cost.deuterium;
  }
  if (unclaimedClanLoot) {
    value += unclaimedClanLoot.alloy + unclaimedClanLoot.crystal + unclaimedClanLoot.deuterium;
  }
  value = Math.round(value);
  await tx.update(players).set({ wealth: value }).where(eq(players.id, playerId));
  return value;
}

/** Convenience for callers that already hold a lock. */
export const refreshWealth = (tx: Tx, planet: LockedPlanet): Promise<number> =>
  recomputeWealth(tx, planet.planetId);

/** Everything a player currently owns, including fleets that are away. */
export async function totalUnitsOf(tx: Queryable, planetId: string): Promise<Fleet> {
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
