import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import {
  CLAN,
  clanAidAllowance,
  clanBayAvailable,
  clanAidRemaining,
  clanAidTravelMinutes,
  clanAidValue,
  clanTransferCargoCapacity,
  clanTransferFleetIsValid,
  distance,
  fleetSpeedMult,
  fleetTravelExact,
  missionFuel,
  resourcesFit,
  resourcesTotal,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts,
  buildings,
  clanAidCommitments,
  missions,
  playerResearch,
  planets,
  players,
  seasons,
  units,
} from '../db/schema.js';
import { publishPrivate, publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { clanEconomyEnvelope } from './clanLoot.js';
import { activeClanMembership, lockClanPlayers, membershipIsMature } from './clanCombat.js';
import { assertFuel, fuelAvailable } from './fuel.js';
import { assertFreeClanAidBay, baysOf } from './flight.js';
import { landingBlock } from './movement.js';
import { capitalPlanet, lockWorlds } from './ownership.js';
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
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';
import { hullProductionAccessible } from './hullAccess.js';
import { techOf } from './researchState.js';

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/** Cargo makes this a round-trip delivery; an empty hold keeps the ship-gift path. */
const isResourceDelivery = (cargo: Resources): boolean => resourcesTotal(cargo) > 0;

const aidCommitmentValue = (fleet: Fleet, cargo: Resources): Resources =>
  isResourceDelivery(cargo) ? { ...cargo } : clanAidValue(fleet, cargo);

/** Private participant projection for incoming, outgoing and returning aid. */
export async function readClanAid(db: Db, accountId: string) {
  const [actor] = await db.select({ playerId: players.id }).from(players)
    .where(eq(players.accountId, accountId));
  if (!actor) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const commitments = await db.select().from(clanAidCommitments).where(or(
    eq(clanAidCommitments.senderPlayerId, actor.playerId),
    eq(clanAidCommitments.recipientPlayerId, actor.playerId),
  )).orderBy(desc(clanAidCommitments.committedAt)).limit(30);
  if (commitments.length === 0) return { transfers: [] };

  const rootIds = commitments.map((commitment) => commitment.missionId);
  const [rootMissions, returnMissions] = await Promise.all([
    db.select().from(missions).where(inArray(missions.id, rootIds)),
    db.select().from(missions).where(inArray(missions.parentMissionId, rootIds)),
  ]);
  const missionById = new Map(rootMissions.map((mission) => [mission.id, mission]));
  const returnByRoot = new Map(returnMissions.map((mission) => [mission.parentMissionId!, mission]));
  const worldIds = [...new Set(rootMissions.flatMap((mission) => [
    mission.originPlanetId,
    mission.targetPlanetId,
  ]))];
  const counterpartIds = [...new Set(commitments.map((commitment) =>
    commitment.senderPlayerId === actor.playerId
      ? commitment.recipientPlayerId
      : commitment.senderPlayerId))];
  const [worlds, people] = await Promise.all([
    worldIds.length === 0
      ? Promise.resolve([])
      : db.select({ id: planets.id, name: planets.name }).from(planets)
          .where(inArray(planets.id, worldIds)),
    db.select({ playerId: players.id, displayName: accounts.displayName })
      .from(players)
      .innerJoin(accounts, eq(players.accountId, accounts.id))
      .where(inArray(players.id, counterpartIds)),
  ]);
  const worldName = new Map(worlds.map((world) => [world.id, world.name]));
  const personName = new Map(people.map((person) => [person.playerId, person.displayName]));

  return {
    transfers: commitments.flatMap((commitment) => {
      const root = missionById.get(commitment.missionId);
      if (!root) return [];
      const returning = returnByRoot.get(root.id);
      const current = commitment.status === 'RETURNING' && returning ? returning : root;
      const outgoing = commitment.senderPlayerId === actor.playerId;
      const counterpartPlayerId = outgoing
        ? commitment.recipientPlayerId
        : commitment.senderPlayerId;
      return [{
        id: commitment.missionId,
        direction: outgoing ? 'OUTGOING' as const : 'INCOMING' as const,
        status: commitment.status,
        counterpart: {
          playerId: counterpartPlayerId,
          username: personName.get(counterpartPlayerId) ?? 'Former commander',
        },
        origin: {
          planetId: root.originPlanetId,
          name: worldName.get(root.originPlanetId) ?? 'Former world',
        },
        target: {
          planetId: root.targetPlanetId,
          name: worldName.get(root.targetPlanetId) ?? 'Former world',
        },
        fleet: root.fleet,
        cargo: root.cargo ?? ZERO,
        value: commitment.value,
        departAt: current.departAt.toISOString(),
        arriveAt: current.arriveAt.toISOString(),
        committedAt: commitment.committedAt.toISOString(),
        allowanceReleasesAt: commitment.expiresAt.toISOString(),
        resolvedAt: commitment.resolvedAt?.toISOString() ?? null,
      }];
    }),
  };
}

const validateCargo = (cargo: Resources): void => {
  for (const [resource, amount] of Object.entries(cargo)) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new GameError('BAD_CARGO', `Bad ${resource} amount`, 400);
    }
  }
};

const assertAidPayload = (fleet: Fleet, cargo: Resources): void => {
  validateCargo(cargo);
  if (!clanTransferFleetIsValid(fleet)) {
    throw new GameError('BAD_CLAN_AID_FLEET', 'Choose at least one eligible mobile ship', 400);
  }
  if (resourcesTotal(cargo) > clanTransferCargoCapacity(fleet)) {
    throw new GameError('CLAN_AID_CARGO_CAPACITY', 'Only transport hulls carry clan resources', 400, {
      capacity: clanTransferCargoCapacity(fleet),
    });
  }
};

async function payloadCanLand(
  db: Queryable,
  targetPlanetId: string,
  fleet: Fleet,
): Promise<boolean> {
  const [yard, research] = await Promise.all([
    db.select({ level: buildings.level }).from(buildings).where(and(
      eq(buildings.planetId, targetPlanetId),
      eq(buildings.type, 'SHIPYARD'),
    )).then((rows) => rows[0]?.level ?? 0),
    /*
      THE RECIPIENT COMMANDER'S RESEARCH, reached through the world being sent to.
      T7 moved research off the planet, and a hull gate asks whether the person
      receiving it can fly the thing — which was never a property of the pad.
    */
    db.select({ projectId: playerResearch.projectId, level: playerResearch.level })
      .from(playerResearch)
      .innerJoin(planets, eq(planets.controllerPlayerId, playerResearch.playerId))
      .where(and(eq(planets.id, targetPlanetId), gt(playerResearch.level, 0))),
  ]);
  const tech = Object.fromEntries(research.map((row) => [row.projectId, row.level]));
  for (const [hull, quantity] of Object.entries(fleet) as [HullId, number][]) {
    if (quantity <= 0) continue;
    if (!hullProductionAccessible(hull, yard, tech)) return false;
  }
  /*
    THE SAME LANDING RULE A TRANSFER READS. T4.

    A gift is a craft arriving at a world, and the Hangar does not care which door
    it came through. Asking `movement.ts` rather than repeating the arithmetic is
    the point: two copies would answer differently the first time either moved, and
    the failure would be a quote that promises a landing the arrival then refuses.
  */
  if (await landingBlock(db, targetPlanetId, fleet)) return false;
  return true;
}

async function recipientAllowance(
  db: Queryable,
  recipientPlayerId: string,
  now: Date,
) {
  const economy = await clanEconomyEnvelope(db, recipientPlayerId);
  if (!economy) throw new GameError('PLAYER_NOT_FOUND', 'That commander has no worlds', 404);
  const allowance = clanAidAllowance(economy);
  const [committed] = await db.select({
    alloy: sql<string>`coalesce(sum((${clanAidCommitments.value}->>'alloy')::numeric), 0)`,
    crystal: sql<string>`coalesce(sum((${clanAidCommitments.value}->>'crystal')::numeric), 0)`,
    deuterium: sql<string>`coalesce(sum((${clanAidCommitments.value}->>'deuterium')::numeric), 0)`,
  }).from(clanAidCommitments).where(and(
    eq(clanAidCommitments.recipientPlayerId, recipientPlayerId),
    gt(clanAidCommitments.expiresAt, now),
  ));
  const [next] = await db.select({ expiresAt: clanAidCommitments.expiresAt })
    .from(clanAidCommitments).where(and(
      eq(clanAidCommitments.recipientPlayerId, recipientPlayerId),
      gt(clanAidCommitments.expiresAt, now),
    )).orderBy(asc(clanAidCommitments.expiresAt)).limit(1);
  // PostgreSQL returns aggregate NUMERIC expressions as strings even though the
  // query is statically typed. Normalise at the service boundary so the public
  // contract never depends on a driver's numeric-decoding policy.
  const used: Resources = {
    alloy: Number(committed?.alloy ?? 0),
    crystal: Number(committed?.crystal ?? 0),
    deuterium: Number(committed?.deuterium ?? 0),
  };
  return {
    allowance,
    used,
    remaining: clanAidRemaining(allowance, used),
    nextReleaseAt: next?.expiresAt ?? null,
  };
}

async function assertAidRelationship(
  db: Queryable,
  senderPlayerId: string,
  recipientPlayerId: string,
  now: Date,
) {
  /**
   * AID IS FOR SOMEBODY ELSE, and nothing downstream said so.
   *
   * `sender.clanId === recipient.clanId` is trivially true when the two are the
   * same commander, so a solo founder — mature the instant the clan exists —
   * could aim a convoy at their own world and have it deliver. `launchTransfer`
   * refuses the same shape with SELF_TRANSFER; without this the clan route was a
   * way round it that also collected the x1.10 speed and the aid-only bay.
   */
  if (senderPlayerId === recipientPlayerId) {
    throw new GameError('CLAN_AID_SELF', 'Clan aid goes to a clanmate, not to your own worlds', 400);
  }
  const [sender, recipient] = await Promise.all([
    activeClanMembership(db, senderPlayerId),
    activeClanMembership(db, recipientPlayerId),
  ]);
  if (sender?.clanId === undefined || recipient?.clanId !== sender.clanId) {
    throw new GameError('CLAN_AID_MEMBERSHIP', 'Clan aid is only for current clanmates', 403);
  }
  if (!membershipIsMature(sender, now) || !membershipIsMature(recipient, now)) {
    const until = sender.matureAt > recipient.matureAt ? sender.matureAt : recipient.matureAt;
    throw new GameError('CLAN_ADAPTING', 'Clan aid opens after adaptation', 409, {
      until: until.toISOString(),
    });
  }
  if (!recipient.aidEnabled) {
    throw new GameError('CLAN_AID_DISABLED', 'That clanmate is not accepting aid', 409);
  }
  return { sender, recipient };
}

export async function quoteClanAid(
  db: Db,
  input: {
    senderPlayerId: string;
    originPlanetId: string;
    recipientPlayerId: string;
    targetPlanetId: string;
    fleet: Fleet;
    cargo: Resources;
    now: Date;
  },
) {
  assertAidPayload(input.fleet, input.cargo);
  const relationship = await assertAidRelationship(
    db,
    input.senderPlayerId,
    input.recipientPlayerId,
    input.now,
  );
  const [origin, target] = await Promise.all([
    db.select().from(planets).where(and(
      eq(planets.id, input.originPlanetId),
      eq(planets.controllerPlayerId, input.senderPlayerId),
    )).then((rows) => rows[0]),
    db.select().from(planets).where(and(
      eq(planets.id, input.targetPlanetId),
      eq(planets.controllerPlayerId, input.recipientPlayerId),
    )).then((rows) => rows[0]),
  ]);
  if (!origin) throw new GameError('PLANET_NOT_OWNED', 'You do not control the origin', 403);
  if (target?.seasonId !== origin.seasonId) {
    throw new GameError('CLAN_AID_TARGET', 'Choose a world that clanmate controls', 404);
  }
  const [orbit, coreLevel, tech] = await Promise.all([
    orbitOf(db, origin.id),
    db.select({ level: buildings.level }).from(buildings).where(and(
      eq(buildings.planetId, origin.id),
      eq(buildings.type, 'CORE'),
    )).then((rows) => rows[0]?.level ?? 0),
    techOf(db, input.senderPlayerId),
  ]);
  const ordinaryBays = await baysOf(db, origin.id, coreLevel);
  const ordinary = fleetTravelExact(
    distance(origin, target),
    input.fleet,
    fleetSpeedMult(orbit),
    tech,
  );
  const travelMinutes = clanAidTravelMinutes(ordinary);
  const season = await db.select({ endsAt: seasons.endsAt }).from(seasons)
    .where(eq(seasons.id, origin.seasonId)).then((rows) => rows[0]);
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  const returnMinutes = clanAidTravelMinutes(fleetTravelExact(
    distance(target, origin),
    input.fleet,
    fleetSpeedMult(orbit),
    tech,
  ));
  const arriveAt = addMinutes(input.now, travelMinutes);
  const returnAt = addMinutes(arriveAt, returnMinutes);
  const delivery = isResourceDelivery(input.cargo);
  const value = aidCommitmentValue(input.fleet, input.cargo);
  const limits = await recipientAllowance(db, input.recipientPlayerId, input.now);
  /*
    THE QUOTE HAS TO KNOW ABOUT FUEL, or it says "send this" and the launch then
    refuses it. T6 added the charge and left this screen answering the question it
    was answering before — which is the one failure mode a quote has.
  */
  const fuel = missionFuel(input.fleet, distance(origin, target), delivery ? 2 : 1);
  const tank = fuelAvailable(origin.deuterium, input.cargo.deuterium);
  return {
    clanId: relationship.sender.clanId,
    canLand: delivery || await payloadCanLand(db, target.id, input.fleet),
    /** Deuterium the sender burns putting this in the air, and whether they have it. */
    fuel,
    hasFuel: Math.floor(tank) >= fuel,
    withinAllowance: resourcesFit(value, limits.remaining),
    bay: {
      used: ordinaryBays.used,
      total: ordinaryBays.total + CLAN.extraAidBays,
      available: clanBayAvailable(ordinaryBays.total, ordinaryBays.used, true),
    },
    cargoCapacity: clanTransferCargoCapacity(input.fleet),
    value,
    /**
     * REMAINING, AND NEVER THE CEILING IT WAS TAKEN FROM. D114.
     *
     * `allowance` is four hours of the recipient's nominal Alloy and Crystal and a
     * fifth of their Deuterium capacity — so publishing it hands any clanmate the
     * exact aggregate Refinery, Extractor and Vault standing that a probe is sold
     * for. Nothing on the client ever read it, or `used`.
     */
    remaining: limits.remaining,
    nextReleaseAt: limits.nextReleaseAt?.toISOString() ?? null,
    arriveAt: arriveAt.toISOString(),
    possibleReturnAt: returnAt.toISOString(),
    canFinishBeforeSeasonEnd: returnAt <= season.endsAt,
    travelMinutes,
  };
}

async function reserveAidFleet(
  tx: Tx,
  input: {
    originPlanetId: string;
    ownerPlayerId: string;
    home: Fleet;
    fleet: Fleet;
    missionId: string;
  },
): Promise<void> {
  const remaining: Fleet = { ...input.home };
  for (const [hull, quantity] of Object.entries(input.fleet) as [HullId, number][]) {
    if ((input.home[hull] ?? 0) < quantity) {
      throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
    }
    remaining[hull] = (remaining[hull] ?? 0) - quantity;
  }
  await setUnits(tx, input.originPlanetId, remaining, 'home', input.ownerPlayerId);
  await setUnits(tx, input.originPlanetId, input.fleet, input.missionId, input.ownerPlayerId);
}

export async function launchClanAid(
  tx: Tx,
  input: {
    senderPlayerId: string;
    originPlanetId: string;
    recipientPlayerId: string;
    targetPlanetId: string;
    fleet: Fleet;
    cargo: Resources;
    clock: Clock;
  },
) {
  assertAidPayload(input.fleet, input.cargo);
  const capital = await capitalPlanet(tx, input.senderPlayerId);
  const lockedWorlds = await lockWorlds(tx, [capital.id, input.originPlanetId, input.targetPlanetId]);
  const origin = await loadLocked(tx, input.originPlanetId, input.clock, {
    expectedPlayerId: input.senderPlayerId,
  });
  assertWorldOperational(origin);
  const target = lockedWorlds.get(input.targetPlanetId);
  if (target?.controllerPlayerId !== input.recipientPlayerId) {
    throw new GameError('CLAN_AID_TARGET', 'Choose a world that clanmate controls', 404);
  }
  await lockClanPlayers(tx, [input.senderPlayerId, input.recipientPlayerId]);
  const relationship = await assertAidRelationship(
    tx,
    input.senderPlayerId,
    input.recipientPlayerId,
    origin.now,
  );
  const delivery = isResourceDelivery(input.cargo);
  if (!delivery && !(await payloadCanLand(tx, target.id, input.fleet))) {
    throw new GameError('CLAN_AID_CANNOT_LAND', 'That exact aid payload cannot land there', 409);
  }
  if (origin.alloy < input.cargo.alloy
    || origin.crystal < input.cargo.crystal
    || origin.deuterium < input.cargo.deuterium) {
    throw new GameError('INSUFFICIENT_RESOURCES', 'The origin cannot load that cargo', 409);
  }
  await assertFreeClanAidBay(tx, origin.planetId, origin.buildings.CORE);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-aid:${input.recipientPlayerId}`}))`);
  const value = aidCommitmentValue(input.fleet, input.cargo);
  const limits = await recipientAllowance(tx, input.recipientPlayerId, origin.now);
  if (!resourcesFit(value, limits.remaining)) {
    throw new GameError('CLAN_AID_LIMIT', 'That payload exceeds the receiver allowance', 409, {
      nextReleaseAt: limits.nextReleaseAt?.toISOString() ?? origin.seasonEndsAt.toISOString(),
    });
  }
  const boost = fleetSpeedMult(origin.orbit);
  const tech = await techOf(tx, input.senderPlayerId);
  const dist = distance(origin, target);
  // A resource delivery always comes home; a ship gift has only its outbound leg.
  const fuel = missionFuel(input.fleet, dist, delivery ? 2 : 1);
  assertFuel(fuel, origin.deuterium, input.cargo.deuterium);
  const oneWay = clanAidTravelMinutes(fleetTravelExact(dist, input.fleet, boost, tech));
  if (!Number.isFinite(oneWay)) throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel', 400);
  const capitalWorld = lockedWorlds.get(capital.id);
  if (!capitalWorld) throw new Error('sender capital lock vanished');
  const returnDistance = distance(target, origin);
  const returnMinutes = clanAidTravelMinutes(fleetTravelExact(
    returnDistance,
    input.fleet,
    boost,
    tech,
  ));
  const arriveAt = addMinutes(origin.now, oneWay);
  assertSeasonOpenThrough(origin, addMinutes(arriveAt, returnMinutes));
  const [mission] = await tx.insert(missions).values({
    seasonId: origin.seasonId,
    kind: 'clan_transfer',
    ownerPlayerId: input.senderPlayerId,
    originPlanetId: origin.planetId,
    targetPlanetId: target.id,
    fleet: input.fleet,
    cargo: input.cargo,
    tech,
    distance: dist,
    departAt: origin.now,
    arriveAt,
  }).returning();
  if (!mission) throw new Error('clan aid mission insert returned no row');
  await reserveAidFleet(tx, {
    originPlanetId: origin.planetId,
    ownerPlayerId: input.senderPlayerId,
    home: origin.homeFleet,
    fleet: input.fleet,
    missionId: mission.id,
  });
  await saveResources(tx, origin.planetId, {
    alloy: origin.alloy - input.cargo.alloy,
    crystal: origin.crystal - input.cargo.crystal,
    deuterium: origin.deuterium - input.cargo.deuterium - fuel,
  });
  await tx.insert(clanAidCommitments).values({
    missionId: mission.id,
    seasonId: origin.seasonId,
    clanId: relationship.sender.clanId,
    senderPlayerId: input.senderPlayerId,
    recipientPlayerId: input.recipientPlayerId,
    senderHomePlanetId: origin.planetId,
    value,
    returnTravelSeconds: returnMinutes * 60,
    committedAt: origin.now,
    expiresAt: addMinutes(origin.now, CLAN.aidWindowMinutes),
  });
  await schedule(tx, {
    seasonId: origin.seasonId,
    kind: 'mission_arrival',
    refId: mission.id,
    resolveAt: arriveAt,
  });
  await recomputePlayerWealth(tx, input.senderPlayerId);
  await publishPrivate(tx, input.senderPlayerId, 'aid');
  await publishPrivate(tx, input.recipientPlayerId, 'aid');
  await publishShard(tx, origin.seasonId, 'launch');
  if (fleetChangesWatch(input.fleet)) await publishWatchChanges(tx, [origin.planetId]);
  return {
    missionId: mission.id,
    arriveAt: arriveAt.toISOString(),
    value,
    remaining: clanAidRemaining(limits.remaining, value),
    nextReleaseAt: limits.nextReleaseAt?.toISOString() ?? addMinutes(origin.now, CLAN.aidWindowMinutes).toISOString(),
    planet: await planetView(tx, origin.planetId, input.clock),
  };
}

async function clearAidUnits(tx: Tx, ownerPlayerId: string, missionId: string): Promise<void> {
  await tx.delete(units).where(and(
    eq(units.ownerPlayerId, ownerPlayerId),
    eq(units.location, missionId),
  ));
}

async function startAidReturn(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  commitment: typeof clanAidCommitments.$inferSelect,
  now: Date,
  cargo: Resources,
  delivered: boolean,
): Promise<typeof missions.$inferSelect> {
  const [home] = await tx.select().from(planets).where(and(
    eq(planets.id, commitment.senderHomePlanetId),
    eq(planets.controllerPlayerId, commitment.senderPlayerId),
  ));
  const destination = home ?? await capitalPlanet(tx, commitment.senderPlayerId);
  const [from] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
  if (!from) throw new Error('clan aid target vanished before reroute');
  const arriveAt = new Date(now.getTime() + commitment.returnTravelSeconds * 1_000);
  const [returnMission] = await tx.insert(missions).values({
    seasonId: mission.seasonId,
    kind: 'clan_transfer',
    ownerPlayerId: commitment.senderPlayerId,
    originPlanetId: mission.targetPlanetId,
    targetPlanetId: destination.id,
    fleet: mission.fleet,
    cargo,
    tech: mission.tech,
    distance: distance(from, destination),
    departAt: now,
    arriveAt,
    parentMissionId: mission.id,
  }).returning();
  if (!returnMission) throw new Error('clan aid return insert returned no row');
  await tx.update(units).set({ location: returnMission.id }).where(and(
    eq(units.ownerPlayerId, commitment.senderPlayerId),
    eq(units.location, mission.id),
  ));
  await tx.update(clanAidCommitments).set(delivered
    ? { status: 'RETURNING', resolvedAt: now }
    : { status: 'RETURNING' })
    .where(eq(clanAidCommitments.missionId, commitment.missionId));
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'mission_arrival',
    refId: returnMission.id,
    resolveAt: arriveAt,
  });
  return returnMission;
}

export async function resolveClanAid(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<'DELIVERED' | 'RETURNING' | 'RETURNED'> {
  const rootMissionId = mission.parentMissionId ?? mission.id;
  const [commitment] = await tx.select().from(clanAidCommitments)
    .where(eq(clanAidCommitments.missionId, rootMissionId)).for('update');
  if (!commitment) throw new Error(`clan aid ${rootMissionId} has no commitment`);

  if (mission.parentMissionId) {
    const [plannedTarget] = await tx.select().from(planets).where(and(
      eq(planets.id, mission.targetPlanetId),
      eq(planets.controllerPlayerId, commitment.senderPlayerId),
    ));
    // A colony may be captured while its transport is on the return leg. Never
    // strand the sender's ships on an event that can no longer resolve; the
    // protected current capital is the safe ownership fallback.
    const target = plannedTarget ?? await capitalPlanet(tx, commitment.senderPlayerId);
    await clearAidUnits(tx, commitment.senderPlayerId, mission.id);
    await addUnits(tx, target.id, mission.fleet);
    const cargo = mission.cargo ?? ZERO;
    await tx.update(planets).set({
      alloy: sql`${planets.alloy} + ${cargo.alloy}`,
      crystal: sql`${planets.crystal} + ${cargo.crystal}`,
      deuterium: sql`${planets.deuterium} + ${cargo.deuterium}`,
    }).where(eq(planets.id, target.id));
    const delivered = commitment.resolvedAt !== null;
    await tx.update(clanAidCommitments).set(delivered
      ? { status: 'DELIVERED' }
      : { status: 'RETURNED', resolvedAt: now })
      .where(eq(clanAidCommitments.missionId, rootMissionId));
    await recomputePlayerWealth(tx, commitment.senderPlayerId);
    await publishPrivate(tx, commitment.senderPlayerId, 'aid');
    await publishPrivate(tx, commitment.recipientPlayerId, 'aid');
    return delivered ? 'DELIVERED' : 'RETURNED';
  }

  await lockClanPlayers(tx, [commitment.senderPlayerId, commitment.recipientPlayerId]);
  const [sender, recipient, target] = await Promise.all([
    activeClanMembership(tx, commitment.senderPlayerId),
    activeClanMembership(tx, commitment.recipientPlayerId),
    tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId)).then((rows) => rows[0]),
  ]);
  const cargo = mission.cargo ?? ZERO;
  const delivery = isResourceDelivery(cargo);
  const valid = sender !== null
    && recipient !== null
    && sender.clanId === commitment.clanId
    && recipient.clanId === commitment.clanId
    && membershipIsMature(sender, now)
    && membershipIsMature(recipient, now)
    && recipient.aidEnabled
    && target?.controllerPlayerId === commitment.recipientPlayerId
    && (delivery || await payloadCanLand(tx, mission.targetPlanetId, mission.fleet));
  if (valid) {
    await tx.update(planets).set({
      alloy: sql`${planets.alloy} + ${cargo.alloy}`,
      crystal: sql`${planets.crystal} + ${cargo.crystal}`,
      deuterium: sql`${planets.deuterium} + ${cargo.deuterium}`,
    }).where(eq(planets.id, target.id));
    if (delivery) {
      await startAidReturn(tx, mission, commitment, now, ZERO, true);
      await recomputePlayerWealth(tx, commitment.recipientPlayerId);
      await publishPrivate(tx, commitment.senderPlayerId, 'aid');
      await publishPrivate(tx, commitment.recipientPlayerId, 'aid');
      return 'RETURNING';
    }
    await clearAidUnits(tx, commitment.senderPlayerId, mission.id);
    await addUnits(tx, target.id, mission.fleet);
    await tx.update(clanAidCommitments).set({ status: 'DELIVERED', resolvedAt: now })
      .where(eq(clanAidCommitments.missionId, rootMissionId));
    await recomputePlayerWealth(tx, commitment.senderPlayerId);
    await recomputePlayerWealth(tx, commitment.recipientPlayerId);
    await publishPrivate(tx, commitment.senderPlayerId, 'aid');
    await publishPrivate(tx, commitment.recipientPlayerId, 'aid');
    return 'DELIVERED';
  }

  await startAidReturn(tx, mission, commitment, now, cargo, false);
  await publishPrivate(tx, commitment.senderPlayerId, 'aid');
  await publishPrivate(tx, commitment.recipientPlayerId, 'aid');
  return 'RETURNING';
}
