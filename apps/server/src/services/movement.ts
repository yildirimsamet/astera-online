import { and, eq, sql } from 'drizzle-orm';
import {
  HULLS,
  MULTI_WORLD,
  distance,
  fleetCount,
  fleetSpeedMult,
  fleetTravelExact,
  allowedPaces,
  isMissionPace,
  hangarCapacity,
  hangarLoad,
  interpolatePosition,
  missionFuel,
  prospectorCeiling,
  TRANSFER_COOLDOWN_MINUTES,
  prospectorRoom,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type NeutralTier,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  attackCommitments,
  buildings,
  clanRaidRoster,
  missions,
  neutralPlanetState,
  planets,
  scheduledEvents,
  units,
} from '../db/schema.js';
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

/**
 * THE THREE STRUCTURAL REFUSALS EVERY CARGO LAUNCH MAKES, IN ONE PLACE.
 *
 * Exported for the trade lane (D156), which is the second path in the game to send
 * transports somewhere and therefore the second path that has to say "that is not
 * a fleet" before it says anything about what the fleet is FOR. Structure first,
 * semantics second — and one statement of it rather than two, because two copies
 * of a refusal ladder is two chances to answer the same bad request differently.
 */
export function validateTransferFleet(fleet: Fleet): void {
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
  if (prospectors > 0) {
    /*
      THE CEILING BELONGS TO WHOEVER HOLDS THE TARGET. D170.

      The third rung of Prospector Holds buys a third craft, and research belongs
      to the COMMANDER (D134) — so the question "how many may stand here" is
      answered by the world's controller, not by the fleet arriving or by a
      constant. A neutral or unheld world has no commander and therefore no rung,
      which is the two-craft answer every caller had before this existed.
    */
    const [world] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, targetPlanetId));
    const tech = world?.playerId ? await techOf(tx, world.playerId) : {};
    const ceiling = prospectorCeiling(tech);
    if (prospectors > prospectorRoom(held, tech)) {
      return {
        code: 'TARGET_PROSPECTOR_CAP',
        message:
          `That world may hold ${String(ceiling)} Prospectors, and it has ${String(held)}.`,
        params: { max: ceiling, have: held },
      };
    }
  }

  /*
    THE HANGAR DOES NOT CARE WHICH DOOR A SHIP CAME THROUGH. T4, restored 2026-09-18.

    A transfer or a clan gift arriving at a full world would otherwise be the one
    way past the ceiling the Yard enforces. Overflow already standing there is
    legal; only new ingress is refused, and a missing row reads as the base rung.
  */
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
  /**
   * HOW FAST TO FLY IT. Owner decision, 2026-09-21.
   *
   * THIS IS THE LANE THE CHOICE EXISTS FOR. A commander who is about to be asleep sends the fleet
   * to their own colony and picks a pace that lands it after they are back — the raid that arrives
   * in between finds an empty hangar. Omitted is full speed, which is what every transfer flew
   * before the choice existed.
   */
  pace?: number,
) {
  validateTransferFleet(fleet);
  if ((fleet.PROSPECTOR ?? 0) > 0) {
    throw new GameError(
      'PROSPECTOR_TRANSFER_FORBIDDEN',
      'Prospectors cannot be transferred between worlds',
      400,
    );
  }
  validateResources(cargo);
  if (originPlanetId === targetPlanetId) throw new GameError('SELF_TRANSFER', 'Choose another world');
  /*
    THE HOLD IS CHECKED INSIDE THE LOCK, NOT HERE. D180.

    It used to be checked in this preamble, which was correct only while a hold was
    a property of the HULLS alone. `CARGO_HOLDS` now lifts `transferCargoCapacity`,
    so the answer depends on the commander's research — and research is a row that
    another transaction can be completing right now. Read out here it would be read
    before the world is locked and before the economy is advanced, which is the one
    ordering this codebase does not allow (lock → advance → validate → mutate).

    So the two refusals moved down, beside the fuel and resource checks, where
    `techOf` has already run under the lock.
  */

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
    const tech = await techOf(tx, ownerPlayerId);
    /*
      THE HOLD, AND IT IS ASKED FIRST OF THE THINGS THAT CAN REFUSE. D181.

      Both refusals are the same two sentences they always were, and they used to
      sit in the pre-transaction preamble. `CARGO_HOLDS` now lifts the figure, so
      the answer depends on a research row another transaction can be completing —
      which puts it inside the lock, after `techOf`, or the check reads a value it
      does not hold.

      IT STAYS AHEAD OF THE STORE CHECKS, and that ordering is deliberate rather
      than incidental: "your ships cannot carry this" is a fact about the request
      and "you do not have this" is a fact about the world, and a commander who is
      wrong about both should be told the one they can fix by changing the form in
      front of them. Dropped to the bottom it read `INSUFFICIENT_RESOURCES` for an
      overloaded convoy.
    */
    const hold = transferCargoCapacity(fleet, tech);
    if (resourcesTotal(cargo) > hold) {
      throw new GameError('CARGO_CAPACITY', 'Cargo exceeds dedicated transport capacity', 400);
    }
    if (resourcesTotal(cargo) > 0 && hold <= 0) {
      throw new GameError('TRANSFER_NEEDS_CARGO_HULL', 'Resources need a transport hull', 400);
    }
    if (origin.alloy < cargo.alloy || origin.crystal < cargo.crystal || origin.deuterium < cargo.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    /*
      THE PAUSE AFTER A SQUADRON LANDED HERE. Faz 2A.3 — `TRANSFER_COOLDOWN_MINUTES`.

      Refused at launch rather than smoothed over, because the whole point is that the fleet is on
      the ground and catchable for those minutes. The ATTACK lane never reads this: reinforcing a
      world is not a reason it may not fight from there.
    */
    if (origin.transferReadyAt !== null && origin.transferReadyAt > origin.now) {
      const seconds = Math.ceil((origin.transferReadyAt.getTime() - origin.now.getTime()) / 1_000);
      throw new GameError(
        'TRANSFER_COOLDOWN',
        'That world is still unloading the last squadron',
        409,
        { seconds },
      );
    }
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE, origin.faults);
    // Refused at LAUNCH as well as on arrival, so a player is never charged a
    // flight for craft that could not have landed. Both worlds are already held
    // by `lockWorlds`, so the counts cannot move under the check. A conflict
    // rather than a bad request: the fleet is legal, the world at the far end is
    // the thing that cannot take it.
    const blocked = await landingBlock(tx, targetPlanetId, fleet);
    if (blocked) throw new GameError(blocked.code, blocked.message, 409, blocked.params);
    const dist = distance(origin, target);
    /*
      THE PACE IS CHECKED BEFORE THE TANK, exactly as the attack lane checks it. Review finding 3,
      2026-09-22: this lane asked the tank first, so an impossible pace on an empty tank came back
      as INSUFFICIENT_FUEL — and a commander goes and buys deuterium for an order the server would
      have refused whatever they paid. An order that was never legal should say so first.
    */
    const mods = { boost: fleetSpeedMult(origin.orbit), tech };
    const chosenPace = pace ?? 1;
    if (!isMissionPace(chosenPace)) {
      throw new GameError('BAD_PACE', 'that is not a flight speed this fleet can be set to', 400);
    }
    if (!allowedPaces(dist, fleet, mods).includes(chosenPace)) {
      throw new GameError(
        'PACE_TOO_SLOW',
        'at that speed the fleet would be in the air past the twelve-hour ceiling',
        400,
      );
    }
    /*
      ONE LEG, AT THE HOMEWARD RATE. T6 + owner decision 2026-09-21.

      One leg because a transfer arrives and stays — the craft become the destination's. Homeward
      because both ends are already checked to be this commander's own worlds a few lines up
      (`PLANET_NOT_OWNED` on the origin, the controller check on the target), which is exactly the
      flight the discount is for: it reaches nobody else, so cutting its price cannot cut the price
      of reach. `FUEL.laneShare` states the whole argument.
    */
    const fuel = missionFuel(fleet, dist, 1, 'HOMEWARD');
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
    const oneWay = fleetTravelExact(dist, fleet, { ...mods, pace: chosenPace });
    if (!Number.isFinite(oneWay)) throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel');
    const arriveAt = addMinutes(origin.now, oneWay);
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx.insert(missions).values({
      fuelPaid: fuel,
      seasonId: origin.seasonId,
      kind: 'transfer',
      ownerPlayerId,
      originPlanetId,
      targetPlanetId,
      fleet,
      cargo,
      tech,
      distance: dist,
      pace: chosenPace,
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
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE, origin.faults);
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
    const cost = MULTI_WORLD.settlement.charge;
    if (origin.alloy < cost.alloy || origin.crystal < cost.crystal) {
      throw new GameError('SETTLEMENT_REQUIREMENTS', 'Settlement resources are missing', 409);
    }
    const dist = distance(origin, neutral.world);
    /*
      ONE LEG, FULL SPEED, FULL RATE — and each of those three is deliberate.

      One leg because the settlers land and become the colony (T6). FULL SPEED because a claim has
      a WINDOW: `settlementCanArrive` refuses a flight that cannot reach the world before the claim
      expires, so offering a commander a slower pace would be offering them a way to miss it. FULL
      RATE because the far end is not their world yet — the homeward discount is for moving ships
      between worlds a commander already holds, and a claim flight reaches somewhere new.
    */
    const fuel = missionFuel(fleet, dist, 1);
    /*
      THE FOUNDING STOCK TRAVELS WITH THEM, SO IT IS SPENT BEFORE THE FLIGHT IS. T6.

      `MULTI_WORLD.settlement.cost` is the cargo of this mission, not a fee. Since D209
      it is spent on a successful landing rather than handed to the colony, and it
      comes home if the race is lost. Its deuterium is zero today and this guard
      read the bare store, which is the same shape `launchTransfer` shipped as a
      bug — the day the founding stock carries any fuel, a settlement would fly on
      deuterium it had already given away and write a negative tank. Stated through
      the one guard so it cannot be true on one path and false on another.
    */
    assertFuel(fuel, origin.deuterium, cost.deuterium);
    const tech = await techOf(tx, ownerPlayerId);
    const oneWay = fleetTravelExact(dist, fleet, { boost: 1, tech });
    const arriveAt = addMinutes(origin.now, oneWay);
    if (arriveAt >= neutral.state.claimUntil) {
      throw new GameError('RECOVERY_WINDOW_TOO_SHORT', 'The claim closes before arrival', 409, {
        claimUntil: neutral.state.claimUntil.toISOString(),
      });
    }
    assertSeasonOpenThrough(origin, arriveAt);
    const [mission] = await tx.insert(missions).values({
      fuelPaid: fuel,
      seasonId: origin.seasonId,
      kind: 'settlement',
      ownerPlayerId,
      originPlanetId,
      targetPlanetId,
      fleet,
      cargo: MULTI_WORLD.settlement.cost,
      settlementEscrow: MULTI_WORLD.settlement.fee,
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
  /*
    WHERE THE FLEET ACTUALLY IS WHEN THIS FIRES. A reroute happens at the end of a leg, so the
    craft are over the world the leg was AIMED at — which for a recalled flight is the world it
    launched from, not the one it had been sent to. Reading `targetPlanetId` unconditionally would
    measure the new leg from a world the fleet turned away from hours ago.
  */
  const fromId = mission.recalledAt !== null ? mission.originPlanetId : mission.targetPlanetId;
  const [from, home] = await Promise.all([
    tx.select().from(planets).where(eq(planets.id, fromId)).then((rows) => rows[0]),
    tx.select().from(planets).where(eq(planets.id, homeId)).then((rows) => rows[0]),
  ]);
  if (!from || !home) throw new Error('reroute endpoint vanished');
  const dist = distance(from, home);
  const homeOrbit = await orbitOf(tx, homeId);
  const oneWay = fleetTravelExact(
    dist,
    mission.fleet,
    { boost: fleetSpeedMult(homeOrbit), tech: mission.tech ?? {} },
  );
  if (!Number.isFinite(oneWay)) throw new Error('rerouted transfer has no mobile craft');
  const arriveAt = addMinutes(now, oneWay);
  const [returnMission] = await tx.insert(missions).values({
    // A return leg is already paid for: fuel is charged in full at the outbound launch.
    fuelPaid: 0,
    seasonId: mission.seasonId,
    kind: 'transfer',
    ownerPlayerId: mission.ownerPlayerId,
    originPlanetId: fromId,
    targetPlanetId: homeId,
    fleet: mission.fleet,
    cargo: mission.cargo ?? EMPTY,
    settlementEscrow: mission.settlementEscrow,
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

/**
 * CALL YOUR OWN FLEET BACK. Owner decision, 2026-09-21.
 *
 * THE LOUDEST LOSS IN THE CHAT LOGS IS A FLEET, NOT A MINE. *"Ben sabah kalktım sıfırım."* A
 * commander could watch a raid close on the world their ships were flying to and do nothing about
 * it, because a launch was final the instant it left. This is the one decision they get back.
 *
 * THE WAY HOME TAKES AS LONG AS WAS ALREADY FLOWN, and that is the whole balance of it. An instant
 * recall would delete "catch the fleet while it is out" — the only counter-play a raider has
 * against a fleetsave — and turn a decision with a cost into a safety switch. Half an hour out is
 * half an hour back, and in that half hour the world it left is still short of its garrison.
 *
 * TRANSFERS AND RAIDS. A raid turns by the same rule since K8 (owner, 2026-09-23;
 * docs/ui-v2/gozlemevi.md). The bet survives because the turn is not free: the fuel stays spent and
 * the way home is as long as the way out was. A turned raid fights nothing, so it lands home like a
 * return leg (`onMissionArrival`), stops being a hostile flight (`isHostileMission`), and gives back
 * the launch's entry in `attack_commitments` — the repeat-attack limit and the clan quota count
 * hits, and this one never landed. Probes, settlements, Death Stars and clan-war legs do not turn.
 *
 * NO FUEL IS CHARGED AND NONE IS RETURNED. The flight was paid for at launch, and a fleet in the
 * air has no access to a store to be charged from — the same rule every other leg in this file
 * obeys.
 */
export async function recallFlight(
  db: Db,
  missionId: string,
  clock: Clock,
  expectedPlayerId: string,
): Promise<{ missionId: string; arriveAt: Date }> {
  return db.transaction(async (tx) => {
    const now = clock.now();
    const [mission] = await tx
      .select()
      .from(missions)
      .where(eq(missions.id, missionId))
      .for('update');
    if (!mission) throw new GameError('NOT_FOUND', 'That flight no longer exists', 404);
    if (mission.ownerPlayerId !== expectedPlayerId) {
      throw new GameError('PLANET_NOT_OWNED', 'That is not your flight', 403);
    }
    /*
      ONE TURN, ON AN OUTBOUND TRANSFER OR RAID THAT IS STILL IN THE AIR.

      `recalledAt` is the guard against a second turn: a flight that can keep turning around never
      has to land, which is the "fleet parked in space" the pace ceiling exists to prevent.
      `arriveAt` is the guard against recalling something that is already down — the worker may not
      have committed it yet, but the decision window closed when the ships reached the world — for a
      raid, the moment its engagement begins. There is no earlier lock: a second out still turns.
    */
    if (
      (mission.kind !== 'transfer' && mission.kind !== 'attack')
      || mission.status !== 'in_flight'
      || mission.recalledAt !== null
      || mission.parentMissionId !== null
      || now.getTime() >= mission.arriveAt.getTime()
    ) {
      throw new GameError('NOT_RECALLABLE', 'That flight cannot be called back', 409);
    }

    const [from] = await tx.select().from(planets).where(eq(planets.id, mission.originPlanetId));
    const [to] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
    if (!from || !to) throw new Error('recall endpoint vanished');

    // Where it actually is, on the true centres — the standoff is a drawing detail the disc adds.
    const turnedAt = interpolatePosition(
      from, to, mission.departAt.getTime(), mission.arriveAt.getTime(), now.getTime(),
    );
    const flownMinutes = (now.getTime() - mission.departAt.getTime()) / 60_000;
    const arriveAt = addMinutes(now, flownMinutes);

    await tx
      .update(missions)
      .set({ recalledAt: now, recallFrom: turnedAt, arriveAt })
      .where(eq(missions.id, mission.id));
    /*
      THE LANDING MOVES WITH IT. The arrival was already queued for the far world's clock; leaving
      it there would land the ships at the wrong minute, and inserting a second one would land them
      twice. `radar.ts` reschedules the same way.
    */
    await tx
      .update(scheduledEvents)
      .set({ resolveAt: arriveAt })
      .where(and(
        eq(scheduledEvents.refId, mission.id),
        eq(scheduledEvents.kind, 'mission_arrival'),
        eq(scheduledEvents.status, 'pending'),
      ));
    if (mission.kind === 'attack') {
      await tx.delete(clanRaidRoster).where(eq(clanRaidRoster.missionId, mission.id));
      await tx.delete(attackCommitments).where(eq(attackCommitments.missionId, mission.id));
    }
    await publishShard(tx, mission.seasonId, 'launch');
    return { missionId: mission.id, arriveAt };
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
  /**
   * A RECALLED FLIGHT LANDS WHERE IT LEFT FROM, AND IT ALWAYS LANDS. Owner decision, 2026-09-21.
   *
   * Chat: *`hangar dolu diye geri donuyordu`*. A fleet coming home is not an arrival to be
   * refused — there is nowhere else for it to go, and bouncing it would be the exact bug the
   * reroute path exists to avoid. So the capacity check below is skipped, like it is for every
   * other system leg, and the destination is the world the ships started at.
   *
   * The OWNERSHIP check still applies: a commander who lost the world they launched from while the
   * fleet was in the air is rerouted to a world they still hold, the same as any other arrival.
   */
  const landingPlanetId = mission.recalledAt !== null
    ? mission.originPlanetId
    : mission.targetPlanetId;
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, landingPlanetId))
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
  if (
    mission.parentMissionId === null
    && mission.recalledAt === null
    && await landingBlock(tx, target.id, mission.fleet)
  ) {
    await rerouteToSafeHome(tx, mission, now);
    return 'REROUTED_CAPACITY';
  }
  await clearReservedFleet(tx, mission);
  await addUnits(tx, target.id, mission.fleet);
  /*
    THE SQUADRON IS ON THE GROUND, AND STAYS THERE FOR A MOMENT. Faz 2A.3.

    Stamped on the world it landed on, including a recalled flight coming home: the bounce this
    closes works in either direction, and a recall that reset nothing would leave the hole open.
    Being CAUGHT by the pause is what a recall is exempt from, not causing one.
  */
  await tx
    .update(planets)
    .set({ transferReadyAt: addMinutes(now, TRANSFER_COOLDOWN_MINUTES) })
    .where(eq(planets.id, target.id));
  const stock = mission.cargo ?? EMPTY;
  const escrow = mission.settlementEscrow ?? EMPTY;
  const cargo = { alloy: stock.alloy + escrow.alloy, crystal: stock.crystal + escrow.crystal, deuterium: stock.deuterium + escrow.deuterium };
  /*
    THERE IS NO DEADLINE TO ANSWER ANY MORE. D179.

    A ship landing on a dark world used to stamp `recoveryReliefAt` here, and that
    stamp was the difference between keeping a struck colony and losing it at the
    end of the window. D179 removed the loss, so the stamp answers a question
    nobody asks: a landing on a recovering world is now an ordinary delivery.
  */
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
  /*
    A SETTLED WORLD OPENS ON ITS TIER'S CAPTURE STOCK, AND ON NOTHING ELSE. D209.

    It used to keep whatever the caretaker was holding — full stores and a season's
    deuterium — and receive the founding cargo on top, which made a settlement a
    profit at the moment it landed. The stores are SET, the works are emptied, and
    the founding charge (cargo and fee alike) is spent whole on success. A settler
    who loses the race still gets both back through `rerouteToSafeHome`.
    The tier is read off the row selected above: `transferPlanetControl` has
    already deleted `neutral_planet_state`.
  */
  const stock = MULTI_WORLD.neutral[target.state.tier as NeutralTier].captureStock;
  await tx.update(planets).set({
    alloy: stock.alloy,
    crystal: stock.crystal,
    deuterium: stock.deuterium,
    bufferAlloy: 0,
    bufferCrystal: 0,
    bufferDeuterium: 0,
  }).where(eq(planets.id, target.world.id));
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
