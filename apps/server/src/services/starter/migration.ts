import { planPlanetReturn } from '../returnPlanning.js';
import { ACADEMY_STEPS, STARTER, departureBlock, fleetEntries, fuelToLoad, landingChoices, migrationCargo, vesselHull, type MigrationCargo } from '@astera/rules';
import { and, desc, eq, gt, inArray, isNull, lte, ne, sql, asc, notInArray } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { accounts, planets, seasons, shards, starterDepartures, starterEvents, units, vesselMigrations, vesselMissions, vesselNotifications, vesselOrders, vessels, vesselBotState } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';
import { BOTS } from '../bots/personas.js';
import { GameError, loadLocked, recomputeWealth, withPlanetLock } from '../planet.js';
import { joinSeason, readPlacement, slotsHeldForReturn, type JoinResult } from '../player.js';
import { galaxyOf } from '../season.js';
import { listServers, resolveJoinTarget, type JoinTarget } from '../servers.js';
import { readHome } from './fleet.js';
import { markProgress } from './quiet.js';
import { activeOrders, lockVesselForDeparture, progressOf, readVessel, saveVessel, settleVessel, vesselView, withVesselLock, type LockedVessel, type VesselOrderRow, type VesselRow, type VesselView } from './vessel.js';

/** How long a jump may be someone's own running request before the sweep takes it over. */
const SWEEP_AFTER_MS = 2 * 60_000;
/** A season this young is news to a ship that has been waiting. */
const NEW_SEASON_MS = 24 * 60 * 60_000;
const BOARD_LENGTH = 20;

export type DepartureStep = 'committed' | 'seated' | 'joined' | 'landed';
export interface DepartureOptions {
  /** The operator's `land-all` only: no route ever sets it, and no frontier is still no landing. */
  force?: boolean;
  slot?: number | undefined;
  /** The server filling a season names it. The frontier and the calendar are rules for people choosing. */
  season?: string;
  /** Between steps, where a process can die. Tests cut the jump here. */
  afterStep?: (step: DepartureStep) => void | Promise<void>;
}

export interface Landing {
  placement: { shard: string; shardName: string; seasonId: string; planetId: string; playerId: string };
  cargo: MigrationCargo;
}

const openFrontier = async (db: Db, clock: Clock) =>
  (await listServers(db, clock)).find(server => server.status === 'open') ?? null;

const flyingCount = async (q: Queryable, vesselId: string): Promise<number> => {
  const rows = await q.select({ id: vesselMissions.id }).from(vesselMissions)
    .where(and(eq(vesselMissions.ownerVesselId, vesselId), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING'])));
  return rows.length;
};

/** What the hold would take right now. Uncollected works count: nobody should lose them to one forgotten tap. */
function holdingsOf(row: Pick<VesselRow, 'alloy' | 'crystal' | 'deuterium' | 'bufferAlloy' | 'bufferCrystal' | 'bufferDeuterium'>) {
  return {
    alloy: row.alloy + row.bufferAlloy,
    crystal: row.crystal + row.bufferCrystal,
    deuterium: row.deuterium + row.bufferDeuterium,
  };
}

/** Whatever was in work comes back whole before the hold is counted, on the panel and in the jump alike. */
function paidBack<T extends Pick<VesselRow, 'alloy' | 'crystal' | 'deuterium'>>(row: T, orders: readonly Pick<VesselOrderRow, 'cost'>[]): T {
  return orders.reduce((sum, { cost }) => ({ ...sum, alloy: sum.alloy + cost.alloy, crystal: sum.crystal + cost.crystal, deuterium: sum.deuterium + cost.deuterium }), row);
}

/** The tank fills from stock, by hand: flying and leaving draw on the same Deuterium, and that is the decision. */
export const loadFuel = (db: Db, accountId: string, amount: number, clock: Clock): Promise<VesselView> =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    const progress = progressOf(vessel.row);
    const moved = fuelToLoad(progress, vessel.row.deuterium, amount);
    if (moved <= 0) {
      if (fuelToLoad(progress, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) <= 0 && progress.fuel < STARTER.fuelForJump) {
        throw new GameError('FUEL_LOCKED', 'The tank is not connected yet', 409);
      }
      throw new GameError('NOTHING_TO_LOAD', 'Nothing to load', 409);
    }
    await markProgress(tx, vessel, clock);
    vessel.row = { ...vessel.row, deuterium: vessel.row.deuterium - moved, fuel: vessel.row.fuel + moved };
    return vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal);
  });

/** Everything the panel shows before the press. Addresses are read only for a ship that can use them. */
export async function migrationView(db: Db, accountId: string, clock: Clock) {
  const ship = await readVessel(db, accountId, clock);
  const home = await readHome(db, ship.id);
  const progress = { modules: ship.modules, facts: ship.facts, parts: ship.parts, fuel: ship.fuel };
  const frontier = await openFrontier(db, clock);
  const block = frontier?.seasonEndsAt
    ? departureBlock({ progress, flying: await flyingCount(db, ship.id), seasonEndsAtMs: frontier.seasonEndsAt.getTime(), nowMs: clock.now().getTime() })
    : ship.fuel >= STARTER.fuelForJump ? { code: 'NO_FRONTIER' as const } : { code: 'MIGRATION_NOT_READY' as const };

  const held = holdingsOf(paidBack(ship, await activeOrders(db, ship.id)));
  const cargo = migrationCargo({ ...held, fleet: home.fleet, damage: home.damage });
  const carried = fleetEntries(cargo.fleet).reduce((sum, [, count]) => sum + count, 0);
  const owned = fleetEntries(home.fleet).reduce((sum, [, count]) => sum + count, 0);

  return {
    block,
    target: frontier?.seasonEndsAt ? { shard: frontier.code, name: frontier.name, seasonEndsAt: frontier.seasonEndsAt.toISOString() } : null,
    fuel: { loaded: ship.fuel, needed: STARTER.fuelForJump, canLoad: fuelToLoad(progress, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) > 0 || ship.fuel >= STARTER.fuelForJump },
    cargo,
    left: {
      alloy: Math.max(0, Math.floor(held.alloy) - cargo.alloy),
      crystal: Math.max(0, Math.floor(held.crystal) - cargo.crystal),
      deuterium: Math.max(0, Math.floor(held.deuterium) - cargo.deuterium),
      ships: owned - carried,
    },
    choices: block === null && frontier ? await addressesIn(db, frontier.code, clock) : [],
  };
}

async function addressesIn(db: Db, shardCode: string, clock: Clock) {
  const target = await resolveJoinTarget(db, shardCode, clock);
  const [season] = await db.select({ seed: seasons.seed, cycleId: seasons.cycleId, shardId: seasons.shardId }).from(seasons).where(eq(seasons.id, target.seasonId));
  const worlds = await db.select({ index: planets.slotIndex, x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.seasonId, target.seasonId));
  const { slots } = galaxyOf(target.seasonId, season!.seed, target.playerCap);
  // An address kept for a returning commander is not free, and offering it would be a promise the jump breaks.
  const held = await slotsHeldForReturn(db, { seasonId: target.seasonId, cycleId: season!.cycleId, shardId: season!.shardId }, clock.now());
  return landingChoices(slots, new Set([...worlds.map(row => row.index), ...held]), worlds);
}

/** Step 1. Under the ship's lock: the conditions, the refunds, the hold. A press on a ship already leaving joins it. */
async function commitDeparture(db: Db, accountId: string, clock: Clock, { slot, force = false, season }: DepartureOptions): Promise<string> {
  const frontier = await openFrontier(db, clock);
  // The three on the panel are the whole choice: any other free address is one nobody was offered (A7).
  const offered = slot !== undefined && !force && frontier ? await addressesIn(db, frontier.code, clock) : null;
  return db.transaction(async (tx) => {
    const vessel = await lockVesselForDeparture(tx, accountId, clock);
    if (vessel.row.status === 'DEPARTING') return vessel.row.id;
    await settleVessel(tx, vessel);
    const endsAt = season ? Number.POSITIVE_INFINITY : frontier?.seasonEndsAt?.getTime();
    const block = endsAt !== undefined
      ? departureBlock({ progress: progressOf(vessel.row), flying: await flyingCount(tx, vessel.row.id), seasonEndsAtMs: endsAt, nowMs: vessel.now.getTime() })
      : progressOf(vessel.row).fuel >= STARTER.fuelForJump ? { code: 'NO_FRONTIER' as const } : { code: 'MIGRATION_NOT_READY' as const };
    if (block && !(force && frontier?.seasonEndsAt)) {
      const { code, ...params } = block;
      throw new GameError(code, 'This ship cannot leave yet', 409, params);
    }
    if (offered && !offered.some(choice => choice.index === slot)) throw landingGone();
    await holdForDeparture(tx, vessel, slot ?? null, season ?? null);
    return vessel.row.id;
  });
}

const landingGone = () => new GameError('LANDING_GONE', 'That address is no longer open', 409);

/** The conditions have been met: the works stop, the hold is counted, and nothing can spend it now. */
async function holdForDeparture(tx: Tx, vessel: LockedVessel, slot: number | null, season: string | null): Promise<MigrationCargo> {
  await cancelAllOrders(tx, vessel);
  const home = await readHome(tx, vessel.row.id);
  const cargo = migrationCargo({ ...holdingsOf(vessel.row), fleet: home.fleet, damage: home.damage });
  await saveVessel(tx, vessel.row);
  await tx.update(vessels).set({ status: 'DEPARTING' }).where(eq(vessels.id, vessel.row.id));
  const row = { status: 'DEPARTING' as const, slotChoice: slot, cargo, cargoLanded: false, playerId: null, planetId: null, shardCode: null, shardName: null, seasonId: season, lastError: null, startedAt: vessel.now };
  await tx.insert(vesselMigrations).values({ vesselId: vessel.row.id, ...row })
    .onConflictDoUpdate({ target: vesselMigrations.vesselId, set: row });
  return cargo;
}

/** Whatever was in work comes back whole. Half back is the price of changing your mind; this is not that. */
async function cancelAllOrders(tx: Tx, vessel: LockedVessel): Promise<void> {
  const orders = await activeOrders(tx, vessel.row.id);
  vessel.row = paidBack(vessel.row, orders);
  for (const order of orders) {
    await tx.update(vesselOrders).set({ status: 'CANCELLED' }).where(eq(vesselOrders.id, order.id));
    await tx.update(starterEvents).set({ status: 'done', claimedAt: null })
      .where(and(eq(starterEvents.refId, order.id), eq(starterEvents.kind, 'vessel_order_complete'), inArray(starterEvents.status, ['pending', 'processing'])));
  }
}

const RACED = new Set(['SHARD_FULL', 'SERVER_LOCKED']);

/** Step 2. The same door a new account's claim uses, and the same three tries: two ships can reach the last seat together. */
async function takeSeat(db: Db, vesselId: string, accountId: string, clock: Clock, slot: number | null, season: string | null): Promise<{ joined: JoinResult; target: JoinTarget }> {
  // A ship the server plays lands only where the server's own commanders sit (§3.12, A11).
  const [played] = await db.select({ id: vesselBotState.vesselId }).from(vesselBotState).where(eq(vesselBotState.vesselId, vesselId));
  if (played) {
    const [seat] = await db.select({ seasonId: seasons.id, code: shards.code }).from(seasons).innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(season ? eq(seasons.id, season) : and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN'), notInArray(shards.code, [...BOTS.excludedShardCodes]))).orderBy(asc(shards.ordinal)).limit(1);
    if (!seat) throw new GameError('NO_SEASON', 'No galaxy is open', 409, { context: 'jump' });
    const target = await resolveJoinTarget(db, seat.code, clock);
    return { target, joined: await joinSeason(db, accountId, target.seasonId, clock, ACADEMY_STEPS.length, 'SERVER') };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    // The frontier has moved on, and these addresses were offered in the galaxy it left.
    if (attempt > 0 && slot !== null) throw landingGone();
    const open = await openFrontier(db, clock);
    if (!open) break;
    try {
      const target = await resolveJoinTarget(db, open.code, clock);
      return { target, joined: await joinSeason(db, accountId, target.seasonId, clock, undefined, 'COMMANDER', new Set(), slot ?? undefined) };
    } catch (err) {
      if (!(err instanceof GameError && RACED.has(err.code))) throw err;
    }
  }
  throw new GameError('NO_FRONTIER', 'Every galaxy is full right now', 409);
}

/** Step 3. The planet's lock, and the row's own flag: however many times this runs, the hold comes down once. */
const landCargo = (db: Db, vesselId: string, planetId: string, playerId: string, clock: Clock) =>
  withPlanetLock(db, planetId, clock, async (tx) => {
    const [row] = await tx.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, vesselId)).for('update');
    if (!row || row.cargoLanded) return;
    const { cargo } = row;
    await tx.update(planets).set({
      alloy: sql`${planets.alloy} + ${cargo.alloy}`,
      crystal: sql`${planets.crystal} + ${cargo.crystal}`,
      deuterium: sql`${planets.deuterium} + ${cargo.deuterium}`,
    }).where(eq(planets.id, planetId));
    for (const [hull, count] of fleetEntries(cargo.fleet)) {
      await tx.insert(units).values({ planetId, ownerPlayerId: playerId, hull, count, location: 'home' })
        .onConflictDoUpdate({ target: [units.planetId, units.hull, units.location], set: { count: sql`${units.count} + ${count}` } });
    }
    await recomputeWealth(tx, planetId, clock.now());
    await tx.update(vesselMigrations).set({ cargoLanded: true }).where(eq(vesselMigrations.vesselId, vesselId));
  });

/** Step 4. The berth is free, the board has a line, and the trigger tells every open screen. */
async function finishDeparture(db: Db, vesselId: string, clock: Clock): Promise<void> {
  await db.transaction(async (tx) => {
    const [ship] = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).for('no key update');
    if (ship?.status !== 'DEPARTING') return;
    const [account] = await tx.select({ country: accounts.countryCode }).from(accounts).where(eq(accounts.id, ship.accountId));
    await tx.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, vesselId));
    await tx.insert(starterDepartures).values({
      starterGalaxyId: ship.starterGalaxyId, accountId: ship.accountId, displayName: ship.name,
      countryCode: account?.country ?? 'TR', x: ship.x, y: ship.y, z: ship.z, at: clock.now(),
    });
    await tx.update(vesselMigrations).set({ status: 'DONE', completedAt: clock.now() }).where(eq(vesselMigrations.vesselId, vesselId));
    await publishShard(tx, ship.starterGalaxyId, 'departure');
  });
}

/**
 * Nothing was lost, so nothing is taken: the ship is as it was, and the reason goes back to the player.
 * Unless another run of this jump has its seat by now: the jump is going ahead, and that seat is answered.
 */
async function handBack(db: Db, vesselId: string, code: string, clock: Clock): Promise<JoinResult | null> {
  return db.transaction(async (tx) => {
    const [ship] = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).for('no key update');
    if (ship?.status !== 'DEPARTING') return null;
    const seated = await readPlacement(tx, ship.accountId);
    if (seated) return seated;
    await tx.update(vessels).set({ status: ship.slotIndex === null ? 'DORMANT' : 'ACTIVE', lastProgressAt: clock.now() }).where(eq(vessels.id, vesselId));
    await tx.update(vesselMigrations).set({ status: 'FAILED', lastError: code, playerId: null, planetId: null }).where(eq(vesselMigrations.vesselId, vesselId));
    return null;
  });
}

/**
 * A SEAT THAT CAME THROUGH AFTER ANOTHER RUN GAVE THE SHIP BACK. It cannot be undone, so the jump goes
 * on, from what the ship holds now and under its lock: the hold comes off the ship once either way.
 */
async function keepHold(db: Db, vesselId: string, accountId: string, clock: Clock, row: typeof vesselMigrations.$inferSelect): Promise<MigrationCargo> {
  return db.transaction(async (tx) => {
    const [ship] = await tx.select({ status: vessels.status }).from(vessels).where(eq(vessels.id, vesselId)).for('no key update');
    if (ship?.status !== 'ACTIVE' && ship?.status !== 'DORMANT') {
      const [current] = await tx.select({ cargo: vesselMigrations.cargo }).from(vesselMigrations).where(eq(vesselMigrations.vesselId, vesselId));
      return current?.cargo ?? row.cargo;
    }
    const vessel = await lockVesselForDeparture(tx, accountId, clock);
    await settleVessel(tx, vessel);
    return holdForDeparture(tx, vessel, row.slotChoice, row.seasonId);
  });
}

/** Steps 2 to 4, from wherever the last run stopped. Every step is safe to run again. */
async function carryOut(db: Db, vesselId: string, accountId: string, clock: Clock, afterStep?: DepartureOptions['afterStep']): Promise<Landing> {
  const [row] = await db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, vesselId));
  // Handed back since this run joined it: whatever refused that jump stands, and nothing may seat it now.
  if (!row || row.status === 'FAILED') throw new GameError('MIGRATION_NOT_READY', 'This ship is not leaving', 409);

  let cargo = row.cargo;
  let placed = await readPlacement(db, accountId);
  // A planet was founded for this jump and it is gone: a forced wipe got between the steps.
  if (!placed && row.planetId) {
    await handBack(db, vesselId, 'WIPED', clock);
    throw new GameError('NO_SEASON', 'The galaxy was reset during the jump', 409, { context: 'jump' });
  }
  let shard = row.shardCode && row.shardName ? { code: row.shardCode, name: row.shardName } : null;
  if (!placed) {
    try {
      const { joined, target } = await takeSeat(db, vesselId, accountId, clock, row.slotChoice, row.seasonId);
      placed = joined;
      shard = { code: target.shardCode, name: target.shardName };
      await afterStep?.('seated');
      cargo = await keepHold(db, vesselId, accountId, clock, row);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      placed = await handBack(db, vesselId, err.code, clock);
      if (!placed) throw err;
    }
  }
  if (!shard) {
    const [where] = await db.select({ code: shards.code, name: shards.name }).from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, placed.seasonId));
    shard = where ? { code: where.code, name: where.name === '' ? where.code : where.name } : { code: '', name: '' };
  }
  await db.update(vesselMigrations).set({
    playerId: placed.playerId, planetId: placed.planetId, seasonId: placed.seasonId, shardCode: shard.code, shardName: shard.name,
  }).where(eq(vesselMigrations.vesselId, vesselId));
  await afterStep?.('joined');

  await landCargo(db, vesselId, placed.planetId, placed.playerId, clock);
  await afterStep?.('landed');

  await finishDeparture(db, vesselId, clock);
  await db.transaction(async tx => {
    await planPlanetReturn(tx, await loadLocked(tx, placed.planetId, clock));
  });
  return {
    placement: { shard: shard.code, shardName: shard.name, seasonId: placed.seasonId, planetId: placed.planetId, playerId: placed.playerId },
    cargo,
  };
}

/**
 * THE JUMP. Plan §5.8. Not one transaction: `joinSeason` has its own retries, locks and conflict
 * handling and must keep them, so each step can run twice and the row says how far it got. The
 * result is written before the scene plays, so a closed browser has already landed.
 */
export async function runDeparture(db: Db, accountId: string, clock: Clock, options: DepartureOptions = {}): Promise<Landing> {
  const vesselId = await commitDeparture(db, accountId, clock, options);
  await options.afterStep?.('committed');
  return carryOut(db, vesselId, accountId, clock, options.afterStep);
}

/** A jump whose process died is finished here; a season that opened tells the ships that were waiting for one. */
export async function sweepDepartures(db: Db, clock: Clock): Promise<void> {
  const before = new Date(clock.now().getTime() - SWEEP_AFTER_MS);
  const stuck = await db.select({ vesselId: vesselMigrations.vesselId, accountId: vessels.accountId }).from(vesselMigrations)
    .innerJoin(vessels, eq(vessels.id, vesselMigrations.vesselId))
    .where(and(eq(vesselMigrations.status, 'DEPARTING'), eq(vessels.status, 'DEPARTING'), lte(vesselMigrations.startedAt, before)));
  let failure: Error | undefined;
  for (const ship of stuck) {
    try {
      await carryOut(db, ship.vesselId, ship.accountId, clock);
    } catch (err) {
      // A refusal has already handed the ship back. Anything else stays DEPARTING for the next pass, on the record.
      const message = err instanceof Error ? err.message : String(err);
      const held = await db.update(vesselMigrations).set({ lastError: message })
        .where(and(eq(vesselMigrations.vesselId, ship.vesselId), eq(vesselMigrations.status, 'DEPARTING'))).returning({ id: vesselMigrations.vesselId });
      if (held.length > 0) failure ??= err instanceof Error ? err : new Error(message);
    }
  }
  await announceNewSeason(db, clock);
  // After the others: the worker logs this, and a player's ship stuck in silence is what it is for.
  if (failure) throw failure;
}

async function announceNewSeason(db: Db, clock: Clock): Promise<void> {
  const now = clock.now();
  const fresh = await db.select({ id: seasons.id, shardName: shards.name, code: shards.code }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN'),
      gt(seasons.startsAt, new Date(now.getTime() - NEW_SEASON_MS)),
      gt(seasons.endsAt, new Date(now.getTime() + STARTER.migrationCutoffDays * 86_400_000))));
  const [season] = fresh;
  if (!season) return;
  const waiting = await db.select({ id: vessels.id }).from(vessels)
    .where(and(eq(vessels.status, 'ACTIVE'), sql`${vessels.fuel} >= ${STARTER.fuelForJump}`));
  if (waiting.length === 0) return;
  await db.insert(vesselNotifications).values(waiting.map(ship => ({
    vesselId: ship.id, kind: 'SEASON_OPEN', refId: season.id, payload: { shardName: season.shardName === '' ? season.code : season.shardName }, createdAt: now,
  }))).onConflictDoNothing();
}

/** The board: who left, where they were from, when. Nothing to act on and no id to act with. */
export async function departureBoard(db: Db, accountId: string) {
  const [ship] = await db.select({ galaxy: vessels.starterGalaxyId }).from(vessels).where(and(eq(vessels.accountId, accountId), ne(vessels.status, 'DEPARTED')));
  if (!ship) throw new GameError('PLACEMENT_CHANGED', 'Your ship has landed; refresh', 409);
  const rows = await db.select().from(starterDepartures).where(eq(starterDepartures.starterGalaxyId, ship.galaxy))
    .orderBy(desc(starterDepartures.at)).limit(BOARD_LENGTH);
  // Where it stood is public while it stood there, and it is what the neighbours watch the streak leave from.
  return { departures: rows.map(row => ({ name: row.displayName, country: row.countryCode, at: row.at.toISOString(), x: row.x, y: row.y, z: row.z })) };
}

/** Read from the main game's side, by an account that no longer has a ship to lock. */
export async function arrivalOwed(db: Db, accountId: string) {
  const [row] = await db.select({ migration: vesselMigrations }).from(vesselMigrations)
    .innerJoin(vessels, eq(vessels.id, vesselMigrations.vesselId))
    .where(and(eq(vessels.accountId, accountId), eq(vesselMigrations.status, 'DONE'), isNull(vesselMigrations.arrivalSeenAt)));
  const landed = await db.select({ at: starterDepartures.at }).from(starterDepartures).where(eq(starterDepartures.accountId, accountId)).limit(1);
  return {
    arrival: row ? { shardName: row.migration.shardName ?? '', cargo: row.migration.cargo, planetId: row.migration.planetId, hull: vesselHull(row.migration.vesselId) } : null,
    landedAt: landed[0]?.at.toISOString() ?? null,
  };
}

export async function markArrivalSeen(db: Db, accountId: string, clock: Clock): Promise<void> {
  const [ship] = await db.select({ id: vessels.id }).from(vessels).where(eq(vessels.accountId, accountId));
  if (ship) await db.update(vesselMigrations).set({ arrivalSeenAt: clock.now() }).where(eq(vesselMigrations.vesselId, ship.id));
}
