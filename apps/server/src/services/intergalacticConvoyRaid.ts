import { createHmac } from 'node:crypto';
import { and, eq, isNull, ne } from 'drizzle-orm';
import {
  HULLS,
  MOBILE_HULLS,
  TRAVEL,
  combatValue,
  convoyProductionCap,
  distance,
  fleetEntries,
  fleetCount,
  fleetPace,
  fleetSpeedMult,
  fleetTravelExact,
  interceptIntergalacticConvoy,
  intergalacticConvoyQuoteIsFresh,
  missionFuelForDistances,
  quoteIntergalacticConvoyReward,
  rollIntergalacticConvoyAward,
  type Fleet,
  type HullId,
  type Resources,
  type TechLevels,
  type Vec3,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { addMinutes } from '../clock.js';
import { intergalacticConvoyRuns, seasons, units } from '../db/schema.js';
import { publish, publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import { intergalacticConvoyOccurrence } from './galaxyEvents.js';
import { notify } from './notifications.js';
import { safeHomePlanet } from './ownership.js';
import {
  GameError,
  assertSeasonOpenThrough,
  assertWorldOperational,
  loadLocked,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
} from './planet.js';
import { techOf } from './researchState.js';

const MOBILE = new Set<string>(MOBILE_HULLS);

export const intergalacticConvoyLocation = (runId: string): string =>
  `intergalactic-convoy:${runId}`;

export interface IntergalacticConvoyOrder {
  occurrenceId: string;
  fleet: Fleet;
  quotedAt: Date;
  quotedFlightSeconds: number;
  quotedArriveAt: Date;
}

export interface IntergalacticConvoyLaunch {
  runId: string;
  occurrenceId: string;
  fleet: Fleet;
  tech: TechLevels;
  departAt: Date;
  arriveAt: Date;
  engagementEndsAt: Date;
  homeAt: Date;
  flightSeconds: number;
  intercept: Vec3;
  engagementEnd: Vec3;
  returnPoint: Vec3;
  fuel: number;
  productionCap: Resources;
  resourceQualityFactor: number;
  shipQualityFactor: number;
  cargo: number;
  quotedResourceReward: Resources;
  shipDropChance: number;
}

function launchFleet(input: Fleet): Fleet {
  const requested: Fleet = {};
  let total = 0;
  for (const [hull, count] of Object.entries(input) as [HullId, number][]) {
    if (!MOBILE.has(hull)) {
      throw new GameError('BAD_FLEET', `${hull} cannot fly a convoy strike`, 400);
    }
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new GameError('BAD_FLEET', 'Craft counts must be positive safe integers', 400);
    }
    total += count;
    if (!Number.isSafeInteger(total)) {
      throw new GameError('BAD_FLEET', 'The fleet is too large', 400);
    }
    requested[hull] = count;
  }
  if (total === 0) throw new GameError('EMPTY_FLEET', 'Send at least one craft', 400);
  const firepower = combatValue(requested);
  if (!Number.isSafeInteger(firepower)) {
    throw new GameError('BAD_FLEET', 'The fleet firepower is too large', 400);
  }
  if (firepower <= 0) {
    throw new GameError('CONVOY_NEEDS_COMBAT_FLEET', 'Send a fleet with firepower', 400);
  }
  return requested;
}

/** Which of the two rations a unique violation names, or null for a real fault. */
const CONVOY_INDEX_REFUSALS: Record<string, { code: string; message: string }> = {
  intergalactic_convoy_runs_planet_active_idx: {
    code: 'CONVOY_FLEET_ALREADY_AWAY',
    message: 'This world already has a fleet committed to the intergalactic convoy',
  },
  intergalactic_convoy_runs_planet_occurrence_idx: {
    code: 'CONVOY_ALREADY_RAIDED',
    message: 'This world already struck this intergalactic convoy',
  },
};

async function insertRun(
  tx: Tx,
  values: typeof intergalacticConvoyRuns.$inferInsert,
): Promise<(typeof intergalacticConvoyRuns.$inferSelect)[]> {
  try {
    return await tx.insert(intergalacticConvoyRuns).values(values).returning();
  } catch (error) {
    // 23505 is unique_violation; `constraint_name` names which ration was spent.
    const detail = error as { code?: unknown; constraint_name?: unknown };
    if (detail.code === '23505' && typeof detail.constraint_name === 'string') {
      const refusal = CONVOY_INDEX_REFUSALS[detail.constraint_name];
      if (refusal) throw new GameError(refusal.code, refusal.message, 409);
    }
    throw error;
  }
}

/**
 * Commit one immutable strike against the moving public convoy.
 *
 * The caller owns the transaction so an idempotency record can be committed with
 * the command. The planet lock serialises the service checks; the two unique
 * indexes remain the database authority.
 */
export async function launchIntergalacticConvoy(
  tx: Tx,
  input: {
    planetId: string;
    expectedPlayerId: string;
    order: IntergalacticConvoyOrder;
    clock: Clock;
  },
): Promise<IntergalacticConvoyLaunch> {
  const requested = launchFleet(input.order.fleet);
  const origin = await loadLocked(tx, input.planetId, input.clock, {
    expectedPlayerId: input.expectedPlayerId,
  });
  assertWorldOperational(origin);

  const [active] = await tx
    .select({ id: intergalacticConvoyRuns.id })
    .from(intergalacticConvoyRuns)
    .where(and(
      eq(intergalacticConvoyRuns.planetId, input.planetId),
      ne(intergalacticConvoyRuns.status, 'done'),
    ))
    .limit(1);
  if (active) {
    throw new GameError(
      'CONVOY_FLEET_ALREADY_AWAY',
      'This world already has a fleet committed to the intergalactic convoy',
      409,
    );
  }

  /*
    AN ABANDONED RUN NEVER SPENT THE RATION, so it is not counted here either. The
    partial unique index states the same rule; this is the friendly answer and that
    is the authority, and the two must agree or the service refuses launches the
    database would accept.
  */
  const [prior] = await tx
    .select({ id: intergalacticConvoyRuns.id })
    .from(intergalacticConvoyRuns)
    .where(and(
      eq(intergalacticConvoyRuns.planetId, input.planetId),
      eq(intergalacticConvoyRuns.occurrenceId, input.order.occurrenceId),
      isNull(intergalacticConvoyRuns.abandonedAt),
    ))
    .limit(1);
  if (prior) {
    throw new GameError(
      'CONVOY_ALREADY_RAIDED',
      'This world already struck this intergalactic convoy',
      409,
    );
  }

  for (const [hull, count] of fleetEntries(requested)) {
    const available = origin.homeFleet[hull] ?? 0;
    if (available < count) {
      throw new GameError('NOT_ENOUGH_SHIPS', `Only ${String(available)} ${HULLS[hull].name}`, 400, {
        hull,
        available,
      });
    }
  }

  await assertFreeBay(tx, input.planetId, origin.buildings.CORE);

  const occurrence = await intergalacticConvoyOccurrence(
    tx,
    origin.seasonId,
    input.order.occurrenceId,
  );
  if (!occurrence
    || origin.nowMinutes < occurrence.spec.appearsAt
    || origin.nowMinutes >= occurrence.spec.expiresAt) {
    throw new GameError('CONVOY_WINDOW_CLOSED', 'There is no intergalactic convoy out there', 409);
  }

  const tech = await techOf(tx, origin.playerId);
  const boost = fleetSpeedMult(origin.orbit);
  const pace = fleetPace(requested, { boost, tech });
  if (!Number.isFinite(pace) || pace <= 0) {
    throw new GameError('IMMOBILE_FLEET', 'That fleet cannot reach the convoy', 400);
  }
  const hit = interceptIntergalacticConvoy({
    origin,
    spec: occurrence.spec,
    departAtMinute: origin.nowMinutes,
    fleetUnitsPerMinute: pace / TRAVEL.distanceFactor,
  });
  if (!hit) {
    throw new GameError('CONVOY_OUT_OF_REACH', 'The convoy will be gone before the strike', 409);
  }

  const flightSeconds = (hit.arrivesAtMinute - origin.nowMinutes) * 60;
  const arriveAt = addMinutes(origin.now, flightSeconds / 60);
  const engagementEndsAt = addMinutes(
    origin.now,
    (hit.engagementEndsAtMinute - origin.nowMinutes),
  );
  if (!intergalacticConvoyQuoteIsFresh({
    quotedAtMs: input.order.quotedAt.getTime(),
    quotedFlightSeconds: input.order.quotedFlightSeconds,
    quotedArriveAtMs: input.order.quotedArriveAt.getTime(),
    serverNowMs: origin.now.getTime(),
    actualFlightSeconds: flightSeconds,
    actualArriveAtMs: arriveAt.getTime(),
  })) {
    throw new GameError(
      'CONVOY_QUOTE_CHANGED',
      'The convoy moved beyond the launch you confirmed; refresh the quote',
      409,
    );
  }

  const productionCap = convoyProductionCap({
    buildings: origin.buildings,
    orbit: origin.orbit,
    effect: occurrence.effect,
  });
  let quote;
  try {
    quote = quoteIntergalacticConvoyReward({
      productionCap,
      fleet: requested,
      launchTech: tech,
      effect: occurrence.effect,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new GameError('BAD_FLEET', error.message, 400);
    }
    throw error;
  }

  const returnPoint = { x: origin.x, y: origin.y, z: origin.z };
  const outboundDistance = distance(origin, hit.intercept);
  const returnDistance = distance(hit.engagementEnd, returnPoint);
  const fuel = missionFuelForDistances(requested, [outboundDistance, returnDistance]);
  assertFuel(fuel, origin.deuterium);
  const returnMinutes = fleetTravelExact(returnDistance, requested, { boost, tech });
  const homeAt = addMinutes(engagementEndsAt, returnMinutes);
  assertSeasonOpenThrough(origin, homeAt);

  /*
    THE DATABASE IS THE AUTHORITY, SO ITS ANSWER IS TRANSLATED RATHER THAN LEAKED.

    The planet row lock serialises every launch from one world, so the two unique
    indexes should never fire — but "should never" is exactly the case a 500 is the
    wrong answer to. The refusal a racing request deserves is the same sentence the
    prechecks above would have given it, and only for the two indexes that mean it:
    anything else is a real fault and must keep travelling.
  */
  const [run] = await insertRun(tx, {
    seasonId: origin.seasonId,
    occurrenceId: input.order.occurrenceId,
    planetId: input.planetId,
    ownerPlayerId: origin.playerId,
    fleet: requested,
    tech,
    interceptX: hit.intercept.x,
    interceptY: hit.intercept.y,
    interceptZ: hit.intercept.z,
    engagementEndX: hit.engagementEnd.x,
    engagementEndY: hit.engagementEnd.y,
    engagementEndZ: hit.engagementEnd.z,
    returnX: returnPoint.x,
    returnY: returnPoint.y,
    returnZ: returnPoint.z,
    departAt: origin.now,
    arriveAt,
    engagementEndsAt,
    homeAt,
    productionCap,
    resourceQualityFactor: quote.resourceQualityFactor,
    shipQualityFactor: quote.shipQualityFactor,
    quotedResourceReward: quote.resourceReward,
  });
  if (!run) throw new Error('intergalactic convoy run insert returned no row');

  const remaining: Fleet = { ...origin.homeFleet };
  for (const [hull, count] of fleetEntries(requested)) {
    remaining[hull] = (remaining[hull] ?? 0) - count;
  }
  await setUnits(tx, input.planetId, remaining, 'home');
  await setUnits(
    tx,
    input.planetId,
    requested,
    intergalacticConvoyLocation(run.id),
    origin.playerId,
  );
  await saveResources(tx, input.planetId, {
    alloy: origin.alloy,
    crystal: origin.crystal,
    deuterium: origin.deuterium - fuel,
  });
  await schedule(tx, {
    seasonId: origin.seasonId,
    kind: 'convoy_arrival',
    refId: run.id,
    dedupeKey: `convoy:arrival:${run.id}`,
    resolveAt: engagementEndsAt,
  });
  await publishShard(tx, origin.seasonId, 'launch');
  await publish(tx, origin.playerId, 'private:convoy');
  await recomputePlayerWealth(tx, origin.playerId);

  return {
    runId: run.id,
    occurrenceId: input.order.occurrenceId,
    fleet: requested,
    tech,
    departAt: origin.now,
    arriveAt,
    engagementEndsAt,
    homeAt,
    flightSeconds,
    intercept: hit.intercept,
    engagementEnd: hit.engagementEnd,
    returnPoint,
    fuel,
    productionCap,
    resourceQualityFactor: quote.resourceQualityFactor,
    shipQualityFactor: quote.shipQualityFactor,
    cargo: quote.cargo,
    quotedResourceReward: quote.resourceReward,
    shipDropChance: quote.shipDropChance,
  };
}

async function fleetOfRun(tx: Tx, planetId: string, runId: string): Promise<Fleet> {
  const rows = await tx.select().from(units).where(and(
    eq(units.planetId, planetId),
    eq(units.location, intergalacticConvoyLocation(runId)),
  ));
  return Object.fromEntries(rows.filter(({ count }) => count > 0).map(({ hull, count }) => [hull, count]));
}

export async function clearIntergalacticConvoyUnits(
  tx: Tx,
  planetId: string,
  runId: string,
): Promise<Fleet> {
  const fleet = await fleetOfRun(tx, planetId, runId);
  await tx.delete(units).where(and(
    eq(units.planetId, planetId),
    eq(units.location, intergalacticConvoyLocation(runId)),
  ));
  return fleet;
}

/** V1 consumes at most eight uint32 draws: drop, count, then tier+hull three times. */
function rewardRng(seasonKey: string, runId: string): () => number {
  const digest = createHmac('sha256', seasonKey)
    .update(`intergalactic-convoy:reward:v1:${runId}`)
    .digest();
  let draw = 0;
  return () => {
    if (draw >= digest.length / 4) {
      throw new RangeError('convoy reward v1 exhausted its frozen random digest');
    }
    const value = digest.readUInt32BE(draw * 4) / 0x1_0000_0000;
    draw += 1;
    return value;
  };
}

/** Resolve the five-second strike exactly once and put both prizes in transit. */
export async function resolveIntergalacticConvoyArrival(
  tx: Tx,
  runId: string,
  clock: Clock,
): Promise<void> {
  const [candidate] = await tx.select().from(intergalacticConvoyRuns).where(and(
    eq(intergalacticConvoyRuns.id, runId),
    eq(intergalacticConvoyRuns.status, 'outbound'),
  )).limit(1);
  if (!candidate) return;

  const [season] = await tx.select({ asteroidKey: seasons.asteroidKey })
    .from(seasons)
    .where(eq(seasons.id, candidate.seasonId))
    .limit(1);
  const occurrence = await intergalacticConvoyOccurrence(
    tx,
    candidate.seasonId,
    candidate.occurrenceId,
  );
  if (!season || !occurrence) throw new Error(`convoy ${runId} lost its occurrence`);
  const resourceReward = { ...candidate.quotedResourceReward };
  const awardedFleet = rollIntergalacticConvoyAward({
    fleet: candidate.fleet,
    shipQualityFactor: candidate.shipQualityFactor,
    effect: occurrence.effect,
    rng: rewardRng(season.asteroidKey, candidate.id),
  });

  const [run] = await tx.update(intergalacticConvoyRuns).set({
    status: 'returning',
    resourceReward,
    awardedFleet,
  }).where(and(
    eq(intergalacticConvoyRuns.id, runId),
    eq(intergalacticConvoyRuns.status, 'outbound'),
  )).returning();
  if (!run) return;

  await notify(tx, {
    playerId: run.ownerPlayerId,
    kind: 'convoy_result',
    payload: {
      trip: 'intergalactic_convoy',
      runId: run.id,
      resourceReward,
      awardedFleet,
      inTransit: true,
    },
    at: clock.now(),
    refId: run.id,
  });
  await schedule(tx, {
    seasonId: run.seasonId,
    kind: 'convoy_return',
    refId: run.id,
    dedupeKey: `convoy:return:${run.id}`,
    resolveAt: run.homeAt,
  });
  await publishShard(tx, run.seasonId, 'arrival');
  await publish(tx, run.ownerPlayerId, 'private:convoy');
}

export interface IntergalacticConvoyDelivery {
  runId: string;
  destinationPlanetId: string;
  resourceReward: Resources;
  awardedFleet: Fleet;
}

/** Deliver the immutable launch fleet and both persisted prizes exactly once. */
export async function resolveIntergalacticConvoyReturn(
  tx: Tx,
  runId: string,
  clock: Clock,
): Promise<IntergalacticConvoyDelivery | null> {
  const [run] = await tx.update(intergalacticConvoyRuns).set({ status: 'done' }).where(and(
    eq(intergalacticConvoyRuns.id, runId),
    eq(intergalacticConvoyRuns.status, 'returning'),
  )).returning();
  if (!run) return null;
  if (run.resourceReward === null || run.awardedFleet === null) {
    throw new Error(`returning convoy ${runId} has unresolved rewards`);
  }

  const destinationPlanetId = await safeHomePlanet(tx, run.ownerPlayerId, run.planetId);
  const home = await loadLocked(tx, destinationPlanetId, clock);
  await clearIntergalacticConvoyUnits(tx, run.planetId, run.id);

  const delivered: Fleet = { ...run.fleet };
  for (const [hull, count] of fleetEntries(run.awardedFleet)) {
    const next = (delivered[hull] ?? 0) + count;
    if (!Number.isSafeInteger(next)) throw new Error(`convoy ${runId} fleet overflow`);
    delivered[hull] = next;
  }
  const merged: Fleet = { ...home.homeFleet };
  for (const [hull, count] of fleetEntries(delivered)) {
    const next = (merged[hull] ?? 0) + count;
    if (!Number.isSafeInteger(next)) throw new Error(`convoy ${runId} delivery overflow`);
    merged[hull] = next;
  }
  await setUnits(tx, destinationPlanetId, merged, 'home', run.ownerPlayerId);
  await saveResources(tx, destinationPlanetId, {
    alloy: home.alloy + run.resourceReward.alloy,
    crystal: home.crystal + run.resourceReward.crystal,
    deuterium: home.deuterium + run.resourceReward.deuterium,
  });
  await recomputePlayerWealth(tx, run.ownerPlayerId);
  if (destinationPlanetId !== run.planetId) await recomputeWealth(tx, run.planetId);

  await notify(tx, {
    playerId: run.ownerPlayerId,
    kind: 'fleet_returned',
    payload: {
      trip: 'intergalactic_convoy',
      runId: run.id,
      resourceReward: run.resourceReward,
      awardedFleet: run.awardedFleet,
      destinationPlanetId,
    },
    at: home.now,
    refId: run.id,
  });
  await publishShard(tx, run.seasonId, 'arrival');
  await publish(tx, run.ownerPlayerId, 'private:convoy');
  return {
    runId: run.id,
    destinationPlanetId,
    resourceReward: run.resourceReward,
    awardedFleet: run.awardedFleet,
  };
}

/** Recover a permanently failed convoy event without deleting player-owned value. */
export async function abandonIntergalacticConvoyRun(
  db: Db,
  runId: string,
  leg: 'outbound' | 'returning',
  clock: Clock,
): Promise<IntergalacticConvoyDelivery | null> {
  if (leg === 'returning') {
    return db.transaction((tx) => resolveIntergalacticConvoyReturn(tx, runId, clock));
  }
  return db.transaction(async (tx) => {
    const resourceReward: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
    const awardedFleet: Fleet = {};
    /*
      THE RATION COMES BACK BECAUSE THE STRIKE NEVER HAPPENED. D201.

      This path exists only when the arrival event failed permanently: the wing
      never fired, the reward is zero, and the world is flown home. Leaving the row
      holding the occurrence quota would charge a commander their single shot at a
      two-hour crossing for a fault of ours. `abandoned_at` drops it out of the
      partial unique index and nothing else changes — the row, its history and its
      notification all stay. The FUEL is not refunded: D136 refunds nothing on any
      path, and a launch that could be undone is not a decision.
    */
    const [run] = await tx.update(intergalacticConvoyRuns).set({
      status: 'done',
      resourceReward,
      awardedFleet,
      abandonedAt: clock.now(),
    }).where(and(
      eq(intergalacticConvoyRuns.id, runId),
      eq(intergalacticConvoyRuns.status, 'outbound'),
    )).returning();
    if (!run) return null;

    const destinationPlanetId = await safeHomePlanet(tx, run.ownerPlayerId, run.planetId);
    const home = await loadLocked(tx, destinationPlanetId, clock);
    await clearIntergalacticConvoyUnits(tx, run.planetId, run.id);
    const merged: Fleet = { ...home.homeFleet };
    for (const [hull, count] of fleetEntries(run.fleet)) {
      const next = (merged[hull] ?? 0) + count;
      if (!Number.isSafeInteger(next)) throw new Error(`convoy ${runId} recall overflow`);
      merged[hull] = next;
    }
    await setUnits(tx, destinationPlanetId, merged, 'home', run.ownerPlayerId);
    await recomputePlayerWealth(tx, run.ownerPlayerId);
    if (destinationPlanetId !== run.planetId) await recomputeWealth(tx, run.planetId);
    await notify(tx, {
      playerId: run.ownerPlayerId,
      kind: 'fleet_returned',
      payload: {
        trip: 'recalled',
        sourceTrip: 'intergalactic_convoy',
        runId: run.id,
        craft: fleetCount(run.fleet),
        craftKind: 'fleet',
      },
      at: home.now,
      refId: run.id,
    });
    await publishShard(tx, run.seasonId, 'arrival');
    await publish(tx, run.ownerPlayerId, 'private:convoy');
    return { runId: run.id, destinationPlanetId, resourceReward, awardedFleet };
  });
}
