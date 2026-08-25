import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  BUILD,
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  SATELLITE_IDS,
  cancelRefund,
  coreTier,
  satelliteSlots,
  type BuildQueueId,
  type BuildingId,
  type BuildingLevels,
  type Fleet,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  buildOrders,
  planetResearch,
  planets,
  satellites,
  scheduledEvents,
  type BuildOrderKind,
} from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { publicPlanetIdentity, recordGalaxyEvent } from './chronicle.js';
import {
  GameError,
  addUnits,
  assertWorldOperational,
  loadLocked,
  refreshWealth,
  saveResources,
  setBuildingLevel,
  totalUnitsOf,
  withPlanetLock,
  type LockedPlanet,
} from './planet.js';
import { planetView, type PlanetView } from './planetView.js';
import { completedResearch } from './researchState.js';

type BuildOrder = typeof buildOrders.$inferSelect;

const BUILDINGS = new Set<string>(BUILDING_IDS);
const INSTRUMENTS = new Set<string>(INSTRUMENT_IDS);
const SATELLITES = new Set<string>(SATELLITE_IDS);
const RESEARCH = new Set<string>(RESEARCH_PROJECT_IDS);

const isBuilding = (value: string): value is BuildingId => BUILDINGS.has(value);
const isHull = (value: string): value is HullId => Object.hasOwn(HULLS, value);
const isInstrument = (value: string): value is InstrumentId => INSTRUMENTS.has(value);
const isSatellite = (value: string): value is SatelliteId => SATELLITES.has(value);
const isResearch = (value: string): value is ResearchProjectId => RESEARCH.has(value);

export interface ProjectedBuildState {
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  /** Every installed or earlier-queued satellite, in physical slot order. */
  orbit: SatelliteId[];
  /** Only the prefix whose slots the projected Core has opened. */
  effectiveOrbit: SatelliteId[];
  research: Set<ResearchProjectId>;
  units: Fleet;
}

export interface BuildQueueContext {
  queue: BuildQueueId;
  orders: BuildOrder[];
  projected: ProjectedBuildState;
}

/**
 * Read the state a new order will inherit.
 *
 * Only orders in THIS queue are ahead of the new one. The two queues run in
 * parallel, so a Shipyard still building in CONSTRUCTION cannot honestly unlock a
 * hull that may finish first in YARD. Within one queue, however, projected gates
 * are the point: Core 1→2 may be followed immediately by Refinery 1→2.
 */
export async function buildQueueContext(
  tx: Tx,
  planet: LockedPlanet,
  queue: BuildQueueId,
): Promise<BuildQueueContext> {
  const orders = await tx
    .select()
    .from(buildOrders)
    .where(and(
      eq(buildOrders.planetId, planet.planetId),
      eq(buildOrders.queue, queue),
      eq(buildOrders.status, 'BUILDING'),
    ))
    .orderBy(asc(buildOrders.slot));

  if (orders.length >= BUILD.queueDepth) {
    throw new GameError('QUEUE_FULL', `The ${queue.toLowerCase()} queue is full`, 409, {
      queue,
      max: BUILD.queueDepth,
    });
  }
  if (orders.some((order, index) => order.slot !== index)) {
    throw new Error(`build queue ${planet.planetId}/${queue} is not compact`);
  }
  if (orders[0] && orders[0].readyAt <= planet.now) {
    throw new GameError('QUEUE_SETTLING', 'The completed order is settling now', 409, { queue });
  }

  const [research, units] = await Promise.all([
    completedResearch(tx, planet.planetId),
    totalUnitsOf(tx, planet.planetId),
  ]);
  const projected: ProjectedBuildState = {
    buildings: { ...planet.buildings },
    instruments: { ...planet.instruments },
    orbit: [...planet.storedOrbit],
    effectiveOrbit: [...planet.orbit],
    research,
    units,
  };

  for (const order of orders) projectOrder(projected, order);
  return { queue, orders, projected };
}

function projectOrder(state: ProjectedBuildState, order: BuildOrder): void {
  switch (order.kind) {
    case 'BUILDING':
      if (isBuilding(order.subject)) {
        state.buildings[order.subject] += 1;
        if (order.subject === 'CORE') projectEffectiveOrbit(state);
      }
      return;
    case 'HULL':
      if (isHull(order.subject)) {
        state.units[order.subject] = (state.units[order.subject] ?? 0) + order.count;
      }
      return;
    case 'INSTRUMENT':
      if (isInstrument(order.subject)) {
        state.instruments[order.subject] = (state.instruments[order.subject] ?? 0) + 1;
      }
      return;
    case 'SATELLITE':
      if (isSatellite(order.subject) && !state.orbit.includes(order.subject)) {
        state.orbit.push(order.subject);
        projectEffectiveOrbit(state);
      }
      return;
    case 'RESEARCH':
      if (isResearch(order.subject)) state.research.add(order.subject);
  }
}

/** A Core owns a prefix of physical orbit slots; damage never reorders hardware. */
function projectEffectiveOrbit(state: ProjectedBuildState): void {
  state.effectiveOrbit = state.orbit.slice(0, satelliteSlots(state.buildings.CORE));
}

/**
 * Whether removing an earlier commitment would change what a later one means.
 *
 * A build row deliberately stores the subject rather than a target level. Its
 * meaning therefore comes from every order ahead of it: two queued Core orders
 * mean L1→L2 and L2→L3, not two interchangeable "+1" writes. Core also prices
 * the duration of every later CONSTRUCTION order. The remaining relationships
 * are the gates which can be supplied by an earlier order in that same queue.
 *
 * Player cancellation refuses to cut such a dependency out from under the tail.
 * A system abandonment cannot refuse, so it uses the same predicate to fail and
 * fully refund the affected tail as well.
 */
function dependsOnEarlier(later: BuildOrder, earlier: BuildOrder): boolean {
  if (later.queue !== earlier.queue || later.slot <= earlier.slot) return false;
  if (earlier.queue === 'YARD') return false;

  if (earlier.kind === 'BUILDING') {
    // Core is both a gate and the throughput input for everything behind it.
    if (earlier.subject === 'CORE') return true;
    return later.kind === 'BUILDING' && later.subject === earlier.subject;
  }
  if (earlier.kind === 'INSTRUMENT') {
    return later.kind === 'INSTRUMENT' && later.subject === earlier.subject;
  }
  if (earlier.kind === 'SATELLITE' && earlier.subject === 'UPLINK') {
    return later.kind === 'INSTRUMENT'
      && (later.subject === 'TELESCOPE' || later.subject === 'RADAR');
  }
  if (earlier.kind === 'RESEARCH' && later.kind === 'RESEARCH' && isResearch(later.subject)) {
    let prerequisite = RESEARCH_PROJECTS[later.subject].prerequisite;
    while (prerequisite !== null) {
      if (prerequisite === earlier.subject) return true;
      prerequisite = RESEARCH_PROJECTS[prerequisite].prerequisite;
    }
  }
  return false;
}

/** Includes transitive dependants: removing Isotope also removes Dense, then its children. */
function dependentTail(queue: readonly BuildOrder[], removed: BuildOrder): BuildOrder[] {
  const affected: BuildOrder[] = [removed];
  for (const candidate of queue) {
    if (affected.some((earlier) => dependsOnEarlier(candidate, earlier))) affected.push(candidate);
  }
  return affected.slice(1);
}

export interface NewBuildOrder {
  kind: BuildOrderKind;
  subject: string;
  count: number;
  cost: Resources;
  minutes: number;
}

/** Commit resources and schedule one completion in the transaction holding the planet lock. */
export async function placeBuildOrder(
  tx: Tx,
  planet: LockedPlanet,
  context: BuildQueueContext,
  input: NewBuildOrder,
): Promise<BuildOrder> {
  if (context.orders.length >= BUILD.queueDepth) {
    throw new GameError('QUEUE_FULL', `The ${context.queue.toLowerCase()} queue is full`, 409, {
      queue: context.queue,
      max: BUILD.queueDepth,
    });
  }
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new GameError('BAD_COUNT', 'Count must be a positive integer');
  }
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
    throw new Error(`invalid build duration for ${input.kind}/${input.subject}`);
  }
  if (
    planet.alloy < input.cost.alloy
    || planet.crystal < input.cost.crystal
    || planet.deuterium < input.cost.deuterium
  ) {
    throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
  }

  const durationSeconds = Math.max(1, Math.ceil(input.minutes * 60));
  const startedAt = context.orders.at(-1)?.readyAt ?? planet.now;
  const readyAt = new Date(startedAt.getTime() + durationSeconds * 1_000);
  // The freeze event owns the deadline itself. Equality would leave two due
  // events whose UUID ordering decides whether the purchase completes or is
  // frozen first, so a build must finish strictly before the boundary.
  if (readyAt >= planet.seasonEndsAt) {
    throw new GameError(
      'SEASON_ENDS_BEFORE_BUILD',
      'That order cannot finish before the season ends',
      409,
      { endsAt: planet.seasonEndsAt.toISOString() },
    );
  }

  planet.alloy -= input.cost.alloy;
  planet.crystal -= input.cost.crystal;
  planet.deuterium -= input.cost.deuterium;
  await saveResources(tx, planet.planetId, {
    alloy: planet.alloy,
    crystal: planet.crystal,
    deuterium: planet.deuterium,
  });

  const [order] = await tx
    .insert(buildOrders)
    .values({
      planetId: planet.planetId,
      queue: context.queue,
      slot: context.orders.length,
      kind: input.kind,
      subject: input.subject,
      count: input.count,
      status: 'BUILDING',
      startedAt,
      readyAt,
      remainingSeconds: durationSeconds,
      cost: input.cost,
    })
    .returning();
  if (!order) throw new Error('build order insert returned no row');

  await schedule(tx, {
    seasonId: planet.seasonId,
    kind: 'build_complete',
    refId: order.id,
    payload: { expectedReadyAt: readyAt.toISOString() },
    resolveAt: readyAt,
  });
  await refreshWealth(tx, planet);
  return order;
}

export interface CancelBuildResult {
  orderId: string;
  refund: Resources;
  planet: PlanetView;
}

/** Player choice: remove one order, return half, and pull everything behind it forward. */
export async function cancelBuildOrder(
  db: Db,
  planetId: string,
  orderId: string,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<CancelBuildResult> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const active = await activeQueue(tx, planetId);
    const order = active.find((candidate) => candidate.id === orderId);
    if (!order) throw new GameError('BUILD_ORDER_NOT_FOUND', 'No active build order by that id', 404);
    if (order.readyAt <= planet.now) {
      throw new GameError('BUILD_ORDER_FINISHED', 'That order has already finished', 409);
    }
    const sameQueue = active.filter((candidate) => candidate.queue === order.queue);
    const dependants = dependentTail(sameQueue, order);
    if (dependants.length > 0) {
      throw new GameError(
        'BUILD_ORDER_HAS_DEPENDENTS',
        'Cancel the dependent orders behind this one first',
        409,
        { count: dependants.length },
      );
    }
    const head = active.find((candidate) => candidate.queue === order.queue);
    const refund = cancelRefund(order.cost);

    await tx
      .update(buildOrders)
      .set({ status: 'CANCELLED' })
      .where(and(eq(buildOrders.id, order.id), eq(buildOrders.status, 'BUILDING')));
    await tx
      .update(scheduledEvents)
      .set({ status: 'done', claimedAt: null })
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        eq(scheduledEvents.refId, order.id),
        inArray(scheduledEvents.status, ['pending', 'processing']),
      ));

    planet.alloy += refund.alloy;
    planet.crystal += refund.crystal;
    planet.deuterium += refund.deuterium;
    await saveResources(tx, planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await reflowQueue(tx, planetId, order.queue, planet.now, head?.id !== order.id);
    await refreshWealth(tx, planet);
    return { orderId, refund, planet: await planetView(tx, planetId, clock) };
  }, expectedPlayerId);
}

/**
 * WHAT A BOMBARDMENT DOES TO THE WORK IN PROGRESS. D113, owner instruction.
 *
 * Every building order on this world is cancelled where it stands and NOTHING is
 * returned. `cancelBuildOrder` hands back half because cancelling is the player's
 * own change of mind; this is not that. The scaffolding was on the ground when the
 * rocket landed, so the alloy in it is gone with everything else that was.
 *
 * IT IS ALSO THE FIX FOR A REAL HOLE. `applyOrderEffect` raises a building to
 * `before + 1` without re-reading the Core ceiling, so an order placed while the
 * Core was high could complete after a strike had lowered it and leave a Refinery
 * standing ABOVE a Core that `build.ts` would never let it reach. Cancelling the
 * order removes the only way that state was reachable.
 *
 * BUILDINGS ONLY, and that is deliberate. Instruments are effective-capped by the
 * Core already (D97) so one stored a level high is inert and self-corrects;
 * satellites are gated by slot count, not level; research carries no level at all;
 * and hulls are in the other queue, which a strike does not touch. Widening this
 * would burn resources to fix problems that do not exist.
 */
export async function destroyBuildingOrders(
  tx: Tx,
  planetId: string,
  now: Date,
): Promise<{ id: string; subject: string; cost: Resources }[]> {
  const doomed = (await activeQueue(tx, planetId))
    .filter((order) => order.queue === 'CONSTRUCTION' && order.kind === 'BUILDING');
  if (doomed.length === 0) return [];
  const ids = doomed.map((order) => order.id);
  await tx
    .update(buildOrders)
    .set({ status: 'CANCELLED' })
    .where(and(inArray(buildOrders.id, ids), eq(buildOrders.status, 'BUILDING')));
  await tx
    .update(scheduledEvents)
    .set({ status: 'done', claimedAt: null })
    .where(and(
      eq(scheduledEvents.kind, 'build_complete'),
      inArray(scheduledEvents.refId, ids),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ));
  // The tail closes up behind them. `preserveFirst` is false because the head of
  // this queue may itself be one of the orders that just went.
  await reflowQueue(tx, planetId, 'CONSTRUCTION', now, false);
  return doomed.map((order) => ({ id: order.id, subject: order.subject, cost: order.cost }));
}

/** The event handler's idempotent state transition. */
export async function applyBuildCompletion(
  tx: Tx,
  orderId: string,
  expectedReadyAt: string,
  clock: Clock,
): Promise<boolean> {
  const [identity] = await tx
    .select({ planetId: buildOrders.planetId })
    .from(buildOrders)
    .where(eq(buildOrders.id, orderId));
  if (!identity) return false;

  const planet = await loadLocked(tx, identity.planetId, clock, { requireLive: false });
  const queue = await activeQueue(tx, identity.planetId);
  const [order] = queue.filter((candidate) => candidate.id === orderId);
  if (order?.readyAt.toISOString() !== expectedReadyAt) return false;
  const head = queue.find((candidate) => candidate.queue === order.queue);
  if (head?.id !== order.id) throw new Error(`build order ${order.id} completed out of sequence`);

  const claimed = await tx
    .update(buildOrders)
    .set({ status: 'COMPLETED' })
    .where(and(eq(buildOrders.id, order.id), eq(buildOrders.status, 'BUILDING')))
    .returning({ id: buildOrders.id });
  if (claimed.length === 0) return false;

  await applyOrderEffect(tx, planet, order);
  await reflowQueue(tx, order.planetId, order.queue, planet.now, true);
  await refreshWealth(tx, planet);
  return true;
}

/** System fault: fully refund the order and any tail whose meaning depended on it. */
export async function abandonBuildOrder(db: Db, orderId: string, clock: Clock): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ planetId: buildOrders.planetId })
      .from(buildOrders)
      .where(eq(buildOrders.id, orderId));
    if (!identity) return false;
    const planet = await loadLocked(tx, identity.planetId, clock, { requireLive: false });
    const active = await activeQueue(tx, identity.planetId);
    const order = active.find((candidate) => candidate.id === orderId);
    if (!order) return false;
    const head = active.find((candidate) => candidate.queue === order.queue);
    const sameQueue = active.filter((candidate) => candidate.queue === order.queue);
    const abandoned = [order, ...dependentTail(sameQueue, order)];
    const abandonedIds = abandoned.map((candidate) => candidate.id);

    const failed = await tx
      .update(buildOrders)
      .set({ status: 'FAILED' })
      .where(and(inArray(buildOrders.id, abandonedIds), eq(buildOrders.status, 'BUILDING')))
      .returning({ id: buildOrders.id });
    if (!failed.some((candidate) => candidate.id === order.id)) return false;

    // Completion events for automatically failed dependants must not wake later
    // and try to apply an order whose prerequisite the system already refunded.
    await tx
      .update(scheduledEvents)
      .set({ status: 'done', claimedAt: null })
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        inArray(scheduledEvents.refId, abandonedIds),
        inArray(scheduledEvents.status, ['pending', 'processing']),
      ));

    for (const candidate of abandoned) {
      planet.alloy += candidate.cost.alloy;
      planet.crystal += candidate.cost.crystal;
      planet.deuterium += candidate.cost.deuterium;
    }
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await reflowQueue(tx, order.planetId, order.queue, planet.now, head?.id !== order.id);
    await refreshWealth(tx, planet);
    return true;
  });
}

async function activeQueue(tx: Tx, planetId: string): Promise<BuildOrder[]> {
  return tx
    .select()
    .from(buildOrders)
    .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
    .orderBy(asc(buildOrders.queue), asc(buildOrders.slot));
}

/** Re-number one queue and make its absolute instants agree with the cancellation. */
async function reflowQueue(
  tx: Tx,
  planetId: string,
  queue: BuildQueueId,
  now: Date,
  preserveFirst: boolean,
): Promise<void> {
  const rows = (await activeQueue(tx, planetId)).filter((order) => order.queue === queue);
  let at = now;
  for (const [slot, row] of rows.entries()) {
    const preserve = slot === 0 && preserveFirst;
    const startedAt = preserve ? row.startedAt : at;
    const readyAt = preserve
      ? row.readyAt
      : new Date(startedAt.getTime() + row.remainingSeconds * 1_000);
    at = readyAt;
    await tx
      .update(buildOrders)
      .set({ slot, startedAt, readyAt })
      .where(and(eq(buildOrders.id, row.id), eq(buildOrders.status, 'BUILDING')));
    await tx
      .update(scheduledEvents)
      .set({
        resolveAt: readyAt,
        payload: { expectedReadyAt: readyAt.toISOString() },
      })
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        eq(scheduledEvents.refId, row.id),
        inArray(scheduledEvents.status, ['pending', 'processing']),
      ));
  }
}

async function applyOrderEffect(tx: Tx, planet: LockedPlanet, order: BuildOrder): Promise<void> {
  switch (order.kind) {
    case 'BUILDING': {
      if (!isBuilding(order.subject)) throw new Error(`unknown building ${order.subject}`);
      const before = planet.buildings[order.subject];
      const after = before + 1;
      await setBuildingLevel(tx, planet.planetId, order.subject, after);
      planet.buildings[order.subject] = after;
      if (order.subject === 'CORE' && coreTier(after) !== coreTier(before)) {
        await publishShard(tx, planet.seasonId, 'world');
        const identity = await publicPlanetIdentity(tx, planet.planetId);
        if (identity) {
          await recordGalaxyEvent(tx, {
            seasonId: planet.seasonId,
            kind: 'core_tier',
            refId: `${planet.planetId}:${String(coreTier(after))}`,
            subjectPlanetId: planet.planetId,
            payload: { ...identity, tier: coreTier(after) },
            occurredAt: order.readyAt,
          });
        }
      }
      return;
    }
    case 'HULL':
      if (!isHull(order.subject)) throw new Error(`unknown hull ${order.subject}`);
      await addUnits(tx, planet.planetId, { [order.subject]: order.count });
      await tx
        .update(planets)
        .set({
          builtEver: sql`jsonb_set(
            ${planets.builtEver}, ${`{${order.subject}}`},
            to_jsonb(coalesce((${planets.builtEver} ->> ${order.subject})::int, 0)
              + ${order.count}), true)`,
        })
        .where(eq(planets.id, planet.planetId));
      return;
    case 'INSTRUMENT':
      if (!isInstrument(order.subject)) throw new Error(`unknown instrument ${order.subject}`);
      await writeInstalled(
        tx,
        planet.planetId,
        order.subject,
        (planet.instruments[order.subject] ?? 0) + 1,
      );
      return;
    case 'SATELLITE':
      if (!isSatellite(order.subject)) throw new Error(`unknown satellite ${order.subject}`);
      await writeInstalled(tx, planet.planetId, order.subject, 1);
      await publishShard(tx, planet.seasonId, 'world');
      return;
    case 'RESEARCH':
      if (!isResearch(order.subject)) throw new Error(`unknown research ${order.subject}`);
      await tx
        .insert(planetResearch)
        .values({
          planetId: planet.planetId,
          projectId: order.subject,
          completedAt: order.readyAt,
        })
        .onConflictDoNothing();
  }
}

/** Instruments and satellites share storage; a new thing takes the next physical slot. */
async function writeInstalled(
  tx: Tx,
  planetId: string,
  type: string,
  level: number,
): Promise<number> {
  const existing = await tx.select().from(satellites).where(eq(satellites.planetId, planetId));
  const slot = existing.find((row) => row.type === type)?.slot
    ?? (existing.length > 0 ? Math.max(...existing.map((row) => row.slot)) + 1 : 0);
  await tx
    .insert(satellites)
    .values({ planetId, slot, type, level })
    .onConflictDoUpdate({
      target: [satellites.planetId, satellites.slot],
      set: { type, level },
    });
  return slot;
}
