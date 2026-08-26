import { and, eq, sql } from 'drizzle-orm';
import {
  HULLS,
  MULTI_WORLD,
  distance,
  fleetCount,
  fleetSpeedMult,
  fleetTravelExact,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { missions, neutralPlanetState, planets, units } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { assertFreeBay } from './flight.js';
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
} from './planet.js';
import { planetView } from './planetView.js';
import { pendingThreads } from './session.js';

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
    throw new GameError('CARGO_CAPACITY', 'Cargo exceeds Hauler and Runner capacity', 400);
  }
  if (resourcesTotal(cargo) > 0 && (fleet.HAULER ?? 0) + (fleet.RUNNER ?? 0) <= 0) {
    throw new GameError('TRANSFER_NEEDS_CARGO_HULL', 'Resources need a Hauler or Runner', 400);
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
    const dist = distance(origin, target);
    const oneWay = fleetTravelExact(dist, fleet, fleetSpeedMult(origin.orbit));
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
      distance: dist,
      departAt: origin.now,
      arriveAt,
    }).returning();
    if (!mission) throw new Error('transfer mission insert returned no row');
    await reserveFleet(tx, originPlanetId, ownerPlayerId, origin.homeFleet, fleet, mission.id);
    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - cargo.alloy,
      crystal: origin.crystal - cargo.crystal,
      deuterium: origin.deuterium - cargo.deuterium,
    });
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    await publishShard(tx, origin.seasonId, 'launch');
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
    const haulers = MULTI_WORLD.settlement.haulers;
    if ((origin.homeFleet.HAULER ?? 0) < haulers) {
      throw new GameError('SETTLEMENT_REQUIREMENTS', 'Settlement Haulers are missing', 409);
    }
    const cost = MULTI_WORLD.settlement.cost;
    if (origin.alloy < cost.alloy || origin.crystal < cost.crystal) {
      throw new GameError('SETTLEMENT_REQUIREMENTS', 'Settlement resources are missing', 409);
    }
    const fleet: Fleet = { HAULER: haulers };
    const dist = distance(origin, neutral.world);
    const oneWay = fleetTravelExact(dist, fleet);
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
      distance: dist,
      departAt: origin.now,
      arriveAt,
    }).returning();
    if (!mission) throw new Error('settlement mission insert returned no row');
    await reserveFleet(tx, originPlanetId, ownerPlayerId, origin.homeFleet, fleet, mission.id);
    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - cost.alloy,
      crystal: origin.crystal - cost.crystal,
      deuterium: origin.deuterium,
    });
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    await publishShard(tx, origin.seasonId, 'launch');
    await recomputePlayerWealth(tx, ownerPlayerId);
    return {
      missionId: mission.id,
      arriveAt,
      pending: await pendingThreads(tx, originPlanetId, origin.now),
      planet: await planetView(tx, originPlanetId, clock),
    };
  });
}

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
  const oneWay = fleetTravelExact(dist, mission.fleet, fleetSpeedMult(homeOrbit));
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
): Promise<'DELIVERED' | 'REROUTED'> {
  const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
  if (target?.controllerPlayerId !== mission.ownerPlayerId) {
    await rerouteToSafeHome(tx, mission, now);
    return 'REROUTED';
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
