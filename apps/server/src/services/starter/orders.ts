import {
  HULLS, RESEARCH_PROJECTS, STARTER, hangarLoad, hullWorkMinutes, moduleStage, prospectorCeiling, prospectorRoom, researchMinutes,
  type Fleet, type HullId, type Resources, type ResearchProjectId,
} from '@astera/rules';
import { and, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable, Tx } from '../../db/client.js';
import { vesselMissions, vesselOrders, vesselUnits } from '../../db/schema.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { vesselProvenance } from '../commandOrigin.js';
import { planStarterReturn } from '../returnPlanning.js';
import { markProgress } from './quiet.js';
import { activeOrders, progressOf, vesselView, withVesselLock, type LockedVessel, type VesselQueue } from './vessel.js';
import { assertFeatureOpen } from './world.js';


/** What every other kind of work aboard shares with a repair: pay now, wait your turn, half back. */
async function placeOrder(tx: Tx, vessel: LockedVessel, clock: Clock, order: {
  queue: VesselQueue; depth: number; subject: string; stage: number; count: number; minutes: number; cost: Resources;
}): Promise<void> {
  const queue = await activeOrders(tx, vessel.row.id, order.queue);
  if (queue.length >= order.depth) throw new GameError('QUEUE_FULL', 'That queue is full', 409, { context: order.queue === 'YARD' ? 'yard' : 'research' });
  const { alloy, crystal, deuterium } = order.cost;
  if (vessel.row.alloy < alloy || vessel.row.crystal < crystal || vessel.row.deuterium < deuterium) {
    throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources', 409, { alloy, crystal, deuterium });
  }
  await markProgress(tx, vessel, clock);
  vessel.row = { ...vessel.row, alloy: vessel.row.alloy - alloy, crystal: vessel.row.crystal - crystal, deuterium: vessel.row.deuterium - deuterium };
  const startedAt = queue.at(-1)?.readyAt ?? vessel.now;
  const remainingSeconds = Math.max(1, Math.ceil(order.minutes * 60));
  const readyAt = new Date(startedAt.getTime() + remainingSeconds * 1000);
  const [row] = await tx.insert(vesselOrders).values({
    vesselId: vessel.row.id, queue: order.queue, slot: queue.length, subject: order.subject, stage: order.stage, count: order.count,
    startedAt, readyAt, remainingSeconds, cost: order.cost, ...vesselProvenance(vessel.now),
  }).returning({ id: vesselOrders.id });
  await scheduleStarter(tx, { starterGalaxyId: vessel.row.starterGalaxyId, kind: 'vessel_order_complete', refId: row!.id, resolveAt: readyAt });
  await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
}

const HANGAR_FLOOR = 0;

/** Everything the hangar answers for: at home, in the air, and already paid for in the yard. */
async function ownedFleet(q: Queryable, vesselId: string): Promise<Fleet> {
  const out: Fleet = {};
  const add = (hull: HullId, count: number) => { out[hull] = (out[hull] ?? 0) + count; };
  for (const unit of await q.select().from(vesselUnits).where(eq(vesselUnits.vesselId, vesselId))) add(unit.hull, unit.count);
  const flying = await q.select({ fleet: vesselMissions.fleet }).from(vesselMissions)
    .where(and(eq(vesselMissions.ownerVesselId, vesselId), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING'])));
  for (const { fleet } of flying) for (const [hull, count] of Object.entries(fleet)) add(hull as HullId, count);
  for (const order of await activeOrders(q, vesselId, 'YARD')) add(order.subject as HullId, order.count);
  return out;
}

export const hangarRoomOf = (stage: number): number =>
  stage > 0 ? STARTER.hangarRoom[Math.min(stage, STARTER.hangarRoom.length) - 1]! : HANGAR_FLOOR;

const isStarterHull = (hull: HullId): boolean => (STARTER.hulls as readonly HullId[]).includes(hull);

/** A wing, at the main game's price and pace. The list and the hangar are what is smaller here. */
export const buildAtVessel = (db: Db, accountId: string, hull: HullId, count: number, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'fleet');
    if (!isStarterHull(hull)) throw new GameError('HULL_LOCKED', 'That hull is built in the main galaxy', 403, { hull });
    const owned = await ownedFleet(tx, vessel.row.id);
    const prospectors = owned.PROSPECTOR ?? 0;
    if (hull === 'PROSPECTOR' && count > prospectorRoom(prospectors, vessel.row.research)) {
      const max = prospectorCeiling(vessel.row.research);
      throw new GameError('PROSPECTOR_CAP', 'That is more Prospectors than a ship can hold', 400, { max, have: prospectors, ...(prospectors >= max ? { context: 'atLimit' } : {}) });
    }
    const capacity = hangarRoomOf(moduleStage(progressOf(vessel.row), 'HANGAR'));
    const used = hangarLoad(owned);
    const needed = hangarLoad({ [hull]: count });
    if (used + needed > capacity) throw new GameError('HANGAR_FULL', 'The hangar has no room for that', 409, { context: 'ship', used, capacity, needed });
    const spec = HULLS[hull];
    await placeOrder(tx, vessel, clock, {
      queue: 'YARD', depth: STARTER.queues.yard, subject: hull, stage: 1, count,
      minutes: hullWorkMinutes(hull, count, 1, vessel.row.research),
      cost: { alloy: spec.alloy * count, crystal: spec.crystal * count, deuterium: spec.deuterium * count },
    });
    return { hull, built: count, alloy: vessel.row.alloy, crystal: vessel.row.crystal, vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal) };
  });

const isStarterProject = (id: ResearchProjectId): boolean => (STARTER.research.projects as readonly ResearchProjectId[]).includes(id);

/** Four projects of the main list, two levels each, and none of it comes along on the jump. */
export const researchAtVessel = (db: Db, accountId: string, projectId: ResearchProjectId, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'research');
    if (!isStarterProject(projectId)) throw new GameError('RESEARCH_LOCKED', 'That is researched in the main galaxy', 403, { projectId });
    const level = (vessel.row.research[projectId] ?? 0) + 1;
    if (level > STARTER.research.maxLevel) throw new GameError('RESEARCH_MAXED', 'That project is as far as it goes here', 409, { projectId });
    const cost = RESEARCH_PROJECTS[projectId].costAt(level);
    await placeOrder(tx, vessel, clock, {
      queue: 'RESEARCH', depth: STARTER.queues.research, subject: projectId, stage: level, count: 1,
      minutes: researchMinutes(cost, 1), cost,
    });
    return { projectId, vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal) };
  });
