import { and, eq, sql } from 'drizzle-orm';
import {
  HULLS,
  MULTI_WORLD,
  PROSPECTOR,
  distance,
  fleetCount,
  fleetSpeedMult,
  fleetTravelExact,
  hangarCapacity,
  hangarLoad,
  missionFuel,
  prospectorRoom,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { buildings, missions, neutralPlanetState, planets, units } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import {
  assertColonyCapacity,
  capitalPlanet,
  lockWorlds,
  safeHomePlanet,
  transferPlanetControl,
} from './ownership.js';
import {
  GameError,
  addUnits,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  orbitOf,
  recomputePlayerWealth,
  saveResources,
  setUnits,
  totalUnitsOf,
} from './planet.js';
import { planetView } from './planetView.js';
import { pendingThreads } from './session.js';
import { techOf } from './researchState.js';
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';

const EMPTY: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

function validateResources(cargo: Resources): void {
  for (const [resource, amount] of Object.entries(cargo)) {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
      throw new GameError('BAD_CARGO', `Bad ${resource} amount`, 400);
    }
  }
}

function validateTransferFleet(fleet: Fleet): void {
  if (fleetCount(fleet) <= 0) throw new GameError('EMPTY_FLEET', 'Send at least one craft', 400);
  for (const [hull, count] of Object.entries(fleet) as [HullId, number][]) {
    if (!Number.isInteger(count) || count < 0) throw new GameError('BAD_FLEET', 'Bad craft count', 400);
    if (HULLS[hull].ground) throw new GameError('GROUND_UNIT', 'Ground defence cannot move', 400);
  }
}

async function reserveFleet(
  tx: Tx,
  originPlanetId: string,
  ownerPlayerId: string,
  home: Fleet,
  fleet: Fleet,
  missionId: string,
): Promise<void> {
  const remaining: Fleet = { ...home };
  for (const [hull, count] of Object.entries(fleet) as [HullId, number][]) {
    if ((home[hull] ?? 0) < count) {
      throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
    }
    remaining[hull] = (remaining[hull] ?? 0) - count;
  }
  await setUnits(tx, originPlanetId, remaining, 'home', ownerPlayerId);
  await setUnits(tx, originPlanetId, fleet, missionId, ownerPlayerId);
}

export interface LandingBlock {
  code: 'TARGET_PROSPECTOR_CAP' | 'TARGET_HANGAR_FULL';
  message: string;
  params: Record<string, number>;
}

/**
 * WHY THIS PAYLOAD CANNOT LAND HERE, OR NULL. T1 · T4.
 *
 * ONE RULE, READ BY BOTH DOORS. A transfer is judged at launch — so a player is
 * never charged a flight for craft that could not have landed — and again on
 * arrival, because the far world goes on living for the whole trip and can build
 * its own pair, or its own fleet, while this one is in the air. Two copies of the
 * question would answer it differently the first time either moved.
 *
 * COUNTED OVER EVERY UNIT ROW FOR THE WORLD, never over its home stack: a craft
 * away mining is still a craft that world owns, and a ceiling a launch could empty
 * is not a ceiling.
 *
 * The arriving squadron is never in the figure. `reserveFleet` leaves a stack
 * booked to the world it LEFT for the whole trip, so a flight to another world
 * cannot see itself here — which is also exactly why the origin's own quota stays
 * spent while its craft are away.
 *
 * The OWNED figures rather than the remaining room, because a world can legally be
 * over a line and a refusal has to be able to say by how much. `prospectorRoom`
 * floors at zero, so deriving a count back out of it would report a fortress of
 * three as a fortress of two.
 */
export async function landingBlock(
  tx: Queryable,
  targetPlanetId: string,
  fleet: Fleet,
): Promise<LandingBlock | null> {
  const owned = await totalUnitsOf(tx, targetPlanetId);

  const prospectors = fleet.PROSPECTOR ?? 0;
  const held = owned.PROSPECTOR ?? 0;
  if (prospectors > 0 && prospectors > prospectorRoom(held)) {
    return {
      code: 'TARGET_PROSPECTOR_CAP',
      message:
        `That world may hold ${String(PROSPECTOR.max)} Prospectors, and it has ${String(held)}.`,
      params: { max: PROSPECTOR.max, have: held },
    };
  }

  const incoming = hangarLoad(fleet);
  if (incoming > 0) {
    const [row] = await tx
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, targetPlanetId), eq(buildings.type, 'HANGAR')));
    const capacity = hangarCapacity(row?.level ?? 0);
    const used = hangarLoad(owned);
    if (used + incoming > capacity) {
      return {
        code: 'TARGET_HANGAR_FULL',
        message: `That world's Hangar holds ${String(capacity)} and is carrying ${String(used)}.`,
        params: { capacity, used, needed: incoming },
      };
    }
  }
  return null;
}

export async function launchTransfer(
  db: Db,
  ownerPlayerId: string,
  originPlanetId: string,
  targetPlanetId: string,
  fleet: Fleet,
  cargo: Resources,
  clock: Clock,
) {
  validateTransferFleet(fleet);
  validateResources(cargo);
  if (originPlanetId === targetPlanetId) throw new GameError('SELF_TRANSFER', 'Choose another world');
  if (resourcesTotal(cargo) > transferCargoCapacity(fleet)) {
    throw new GameError('CARGO_CAPACITY', 'Cargo exceeds dedicated transport capacity', 400);
  }
  if (resourcesTotal(cargo) > 0 && transferCargoCapacity(fleet) <= 0) {
    throw new GameError('TRANSFER_NEEDS_CARGO_HULL', 'Resources need a transport hull', 400);
  }

  return db.transaction(async (tx) => {
    await lockWorlds(tx, [originPlanetId, targetPlanetId]);
    const origin = await loadLocked(tx, originPlanetId, clock);
    assertWorldOperational(origin);
    if (origin.playerId !== ownerPlayerId) throw new GameError('PLANET_NOT_OWNED', 'Origin changed', 403);
    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (target?.controllerPlayerId !== ownerPlayerId) {
      throw new GameError('PLANET_NOT_OWNED', 'Target is not yours', 403);
    }
    if (target.seasonId !== origin.seasonId) throw new GameError('CROSS_SEASON', 'Another galaxy', 403);
    if (origin.alloy < cargo.alloy || origin.crystal < cargo.crystal || origin.deuterium < cargo.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE);
    // Refused at LAUNCH as well as on arrival, so a player is never charged a
    // flight for craft that could not have landed. Both worlds are already held
    // by `lockWorlds`, so the counts cannot move under the check. A conflict
    // rather than a bad request: the fleet is legal, the world at the far end is
    // the thing that cannot take it.
    const blocked = await landingBlock(tx, targetPlanetId, fleet);
    if (blocked) throw new GameError(blocked.code, blocked.message, 409, blocked.params);
    const dist = distance(origin, target);
    // One leg: a transfer arrives and stays. The craft become the destination's. T6.
    const fuel = missionFuel(fleet, dist, 1);
    /*
      THE CARGO IS ALREADY SPOKEN FOR. T6.

      This read `origin.deuterium < fuel`, and the cargo check above it read
      `origin.deuterium < cargo.deuterium` — neither looked at the SUM. A commander
      shipping their whole tank as cargo passed both and the store was written as
      `held - cargo - fuel`, which is NEGATIVE. Nothing downstream defends against
      that: the lazy tick, the loot maths and the readout all take it at face value.
      `assertFuel` is that sum, and it is now the only place any launch states it.
    */
    assertFuel(fuel, origin.deuterium, cargo.deuterium);
    const tech = await techOf(tx, ownerPlayerId);
    const oneWay = fleetTravelExact(dist, fleet, fleetSpeedMult(origin.orbit), tech);
    if (!Number.isFinite(oneWay)) throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel');
    const arriveAt = addMinutes(origin.now, oneWay);
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx.insert(missions).values({
      seasonId: origin.seasonId,
      kind: 'transfer',
      ownerPlayerId,
      originPlanetId,
      targetPlanetId,
      fleet,
      cargo,
      tech,
      distance: dist,
      departAt: origin.now,
      arriveAt,
    }).returning();
    if (!mission) throw new Error('transfer mission insert returned no row');
    await reserveFleet(tx, originPlanetId, ownerPlayerId, origin.homeFleet, fleet, mission.id);
    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - cargo.alloy,
      crystal: origin.crystal - cargo.crystal,
      deuterium: origin.deuterium - cargo.deuterium - fuel,
    });
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    await publishShard(tx, origin.seasonId, 'launch');
    if (fleetChangesWatch(fleet)) await publishWatchChanges(tx, [originPlanetId]);
    await recomputePlayerWealth(tx, ownerPlayerId);
    return {
      missionId: mission.id,
      arriveAt,
      pending: await pendingThreads(tx, originPlanetId, origin.now),
      planet: await planetView(tx, originPlanetId, clock),
    };
  });
}

export async function launchSettlement(
  db: Db,
  ownerPlayerId: string,
  originPlanetId: string,
  targetPlanetId: string,
  clock: Clock,
) {
  return db.transaction(async (tx) => {
    const capital = await capitalPlanet(tx, ownerPlayerId);
    await lockWorlds(tx, [capital.id, originPlanetId, targetPlanetId]);
    const origin = await loadLocked(tx, originPlanetId, clock);
    assertWorldOperational(origin);
    if (origin.playerId !== ownerPlayerId) throw new GameError('PLANET_NOT_OWNED', 'Origin changed', 403);
    await assertColonyCapacity(tx, ownerPlayerId, origin.seasonId);
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE);
    const [neutral] = await tx
      .select({ world: planets, state: neutralPlanetState })
      .from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .where(and(eq(planets.id, targetPlanetId), eq(planets.kind, 'NEUTRAL')));
    if (!neutral) throw new GameError('TARGET_CHANGED', 'That world is no longer neutral', 409);
    if (!neutral.state.claimUntil) throw new GameError('NO_ACTIVE_CLAIM', 'No claim is open', 409);
    if (neutral.state.claimUntil <= origin.now) {
      throw new GameError('CLAIM_EXPIRED', 'That claim has closed', 409, {
        claimUntil: neutral.state.claimUntil.toISOString(),
      });
    }
    const fleet = settlementFleet();
    const transportHull = MULTI_WORLD.settlement.transportHull;
    const transports = MULTI_WORLD.settlement.transports;
    if ((origin.homeFleet[transportHull] ?? 0) < transports) {
      throw new GameError('SETTLEMENT_REQUIREMENTS', 'Settlement transports are missing', 409);
    }
    const cost = MULTI_WORLD.settlement.cost;
    if (origin.alloy < cost.alloy || origin.crystal < cost.crystal) {
      throw new GameError('SETTLEMENT_REQUIREMENTS', 'Settlement resources are missing', 409);
    }
    const dist = distance(origin, neutral.world);
    // One leg: the settlers land and become the colony. T6.
    const fuel = missionFuel(fleet, dist, 1);
    /*
      THE FOUNDING STOCK TRAVELS WITH THEM, SO IT IS SPENT BEFORE THE FLIGHT IS. T6.

      `MULTI_WORLD.settlement.cost` is the cargo of this mission, not a fee: it is
      handed to the colony on landing. Its deuterium is zero today and this guard
      read the bare store, which is the same shape `launchTransfer` shipped as a
      bug — the day the founding stock carries any fuel, a settlement would fly on
      deuterium it had already given away and write a negative tank. Stated through
      the one guard so it cannot be true on one path and false on another.
    */
    assertFuel(fuel, origin.deuterium, cost.deuterium);
    const tech = await techOf(tx, ownerPlayerId);
    const oneWay = fleetTravelExact(dist, fleet, 1, tech);
    const arriveAt = addMinutes(origin.now, oneWay);
    if (arriveAt >= neutral.state.claimUntil) {
      throw new GameError('RECOVERY_WINDOW_TOO_SHORT', 'The claim closes before arrival', 409, {
        claimUntil: neutral.state.claimUntil.toISOString(),
      });
    }
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx.insert(missions).values({
      seasonId: origin.seasonId,
      kind: 'settlement',
      ownerPlayerId,
      originPlanetId,
      targetPlanetId,
      fleet,
      cargo: cost,
      tech,
      distance: dist,
      departAt: origin.now,
      arriveAt,
    }).returning();
    if (!mission) throw new Error('settlement mission insert returned no row');
    await reserveFleet(tx, originPlanetId, ownerPlayerId, origin.homeFleet, fleet, mission.id);
    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - cost.alloy,
      crystal: origin.crystal - cost.crystal,
      // The stock the settlers carry, and then the flight. Both, for the same
      // reason the guard above counts both.
      deuterium: origin.deuterium - cost.deuterium - fuel,
    });
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    await publishShard(tx, origin.seasonId, 'launch');
    if (fleetChangesWatch(fleet)) await publishWatchChanges(tx, [originPlanetId]);
    await recomputePlayerWealth(tx, ownerPlayerId);
    return {
      missionId: mission.id,
      arriveAt,
      pending: await pendingThreads(tx, originPlanetId, origin.now),
      planet: await planetView(tx, originPlanetId, clock),
    };
  });
}

/** Exact shared founding manifest; exported so route/service tests cannot restate it. */
export const settlementFleet = (): Fleet => ({
  [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports,
});

async function clearReservedFleet(tx: Tx, mission: typeof missions.$inferSelect): Promise<void> {
  // A rerouted mission deliberately keeps its craft stationed on the original
  // home row while its endpoint changes. Mission ownership + location is the
  // stable identity of an away stack; keying this deletion by the new origin
  // would leave a duplicate ghost stack behind after delivery.
  await tx.delete(units).where(and(
    eq(units.ownerPlayerId, mission.ownerPlayerId),
    eq(units.location, mission.id),
  ));
}

async function rerouteToSafeHome(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<void> {
  const homeId = await safeHomePlanet(tx, mission.ownerPlayerId, mission.originPlanetId);
  const [from, home] = await Promise.all([
    tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId)).then((rows) => rows[0]),
    tx.select().from(planets).where(eq(planets.id, homeId)).then((rows) => rows[0]),
  ]);
  if (!from || !home) throw new Error('reroute endpoint vanished');
  const dist = distance(from, home);
  const homeOrbit = await orbitOf(tx, homeId);
  const oneWay = fleetTravelExact(
    dist,
    mission.fleet,
    fleetSpeedMult(homeOrbit),
    mission.tech ?? {},
  );
  if (!Number.isFinite(oneWay)) throw new Error('rerouted transfer has no mobile craft');
  const arriveAt = addMinutes(now, oneWay);
  const [returnMission] = await tx.insert(missions).values({
    seasonId: mission.seasonId,
    kind: 'transfer',
    ownerPlayerId: mission.ownerPlayerId,
    originPlanetId: mission.targetPlanetId,
    targetPlanetId: homeId,
    fleet: mission.fleet,
    cargo: mission.cargo ?? EMPTY,
    tech: mission.tech,
    distance: dist,
    departAt: now,
    arriveAt,
    parentMissionId: mission.id,
  }).returning();
  if (!returnMission) throw new Error('reroute insert returned no row');
  await tx
    .update(units)
    .set({ location: returnMission.id })
    .where(and(
      eq(units.ownerPlayerId, mission.ownerPlayerId),
      eq(units.location, mission.id),
    ));
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'mission_arrival',
    refId: returnMission.id,
    resolveAt: arriveAt,
  });
}

export async function resolveTransfer(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<'DELIVERED' | 'REROUTED_CAPACITY' | 'REROUTED_OWNERSHIP'> {
  /*
   * CARGO IS NOT A RETURN CONDITION. An empty transfer and a loaded transfer are
   * the same one-way move between the commander's worlds. Only a destination
   * that became invalid while the fleet was airborne can create a return leg.
   */
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId))
    .for('update');
  if (target?.controllerPlayerId !== mission.ownerPlayerId) {
    await rerouteToSafeHome(tx, mission, now);
    return 'REROUTED_OWNERSHIP';
  }
  /**
   * THE DESTINATION IS CHECKED AGAIN, because it went on living while this flew.
   * A transfer takes minutes and the world at the far end can build in that time;
   * a launch-time check alone lands craft on a world that filled up behind them.
   *
   * ONLY A FLIGHT THE PLAYER CHOSE. A rerouted leg carries a parent, which marks
   * it as a system path — the destination vanished, or the far world could not
   * take the payload — and those may always land. Overflow is legal and nothing
   * is ever deleted to enforce a limit, so refusing a rerouted leg would only
   * bounce it between worlds forever.
   */
  if (mission.parentMissionId === null && await landingBlock(tx, target.id, mission.fleet)) {
    await rerouteToSafeHome(tx, mission, now);
    return 'REROUTED_CAPACITY';
  }
  await clearReservedFleet(tx, mission);
  await addUnits(tx, target.id, mission.fleet);
  const cargo = mission.cargo ?? EMPTY;
  await tx.update(planets).set({
    alloy: sql`${planets.alloy} + ${cargo.alloy}`,
    crystal: sql`${planets.crystal} + ${cargo.crystal}`,
    deuterium: sql`${planets.deuterium} + ${cargo.deuterium}`,
  }).where(eq(planets.id, target.id));
  return 'DELIVERED';
}

export async function resolveSettlement(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<'CAPTURED' | 'REROUTED'> {
  const [target] = await tx
    .select({ world: planets, state: neutralPlanetState })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(and(eq(planets.id, mission.targetPlanetId), eq(planets.kind, 'NEUTRAL')))
    .for('update');
  if (!target?.state.claimUntil || target.state.claimUntil <= now) {
    await rerouteToSafeHome(tx, mission, now);
    return 'REROUTED';
  }
  await transferPlanetControl(tx, {
    targetPlanetId: target.world.id,
    newPlayerId: mission.ownerPlayerId,
    expectedControllerPlayerId: null,
    now,
    protectedUntil: addMinutes(now, MULTI_WORLD.occupationMinutes),
  });
  await clearReservedFleet(tx, mission);
  await addUnits(tx, target.world.id, mission.fleet);
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'occupation_end',
    refId: target.world.id,
    payload: { expectedUntil: addMinutes(now, MULTI_WORLD.occupationMinutes).toISOString() },
    resolveAt: addMinutes(now, MULTI_WORLD.occupationMinutes),
  });
  await recomputePlayerWealth(tx, mission.ownerPlayerId);
  return 'CAPTURED';
}
