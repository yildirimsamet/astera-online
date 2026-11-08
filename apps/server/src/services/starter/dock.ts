import { STARTER, dockBill } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { vesselOrders, vesselUnits } from '../../db/schema.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { vesselProvenance } from '../commandOrigin.js';
import { planStarterReturn } from '../returnPlanning.js';
import { markProgress } from './quiet.js';
import { activeOrders, vesselView, withVesselLock } from './vessel.js';
import { assertFeatureOpen } from './world.js';

/**
 * The Repair Station takes everything hurt at home. It opens with the shipyard and has work only when
 * a ship is hurt, so an outpost's damage mends without the shield and its PvP (owner 2026-11-08, N2).
 */
export const dockFleet = (db: Db, accountId: string, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'fleet');
    if ((await activeOrders(tx, vessel.row.id, 'DOCK')).length >= STARTER.queues.dock) throw new GameError('QUEUE_FULL', 'The station is busy', 409, { context: 'dock' });
    const units = await tx.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, vessel.row.id), eq(vesselUnits.location, 'HOME')));
    const { cost, minutes } = dockBill(units.flatMap(unit => unit.damage));
    if (minutes <= 0) throw new GameError('NOTHING_TO_REPAIR', 'Nothing here needs the station', 409);
    if (vessel.row.alloy < cost.alloy || vessel.row.crystal < cost.crystal || vessel.row.deuterium < cost.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources', 409, { ...cost });
    }
    await markProgress(tx, vessel, clock);
    vessel.row = { ...vessel.row, alloy: vessel.row.alloy - cost.alloy, crystal: vessel.row.crystal - cost.crystal, deuterium: vessel.row.deuterium - cost.deuterium };
    const remainingSeconds = Math.max(1, Math.ceil(minutes * 60));
    const readyAt = new Date(vessel.now.getTime() + remainingSeconds * 1000);
    const [order] = await tx.insert(vesselOrders).values({
      vesselId: vessel.row.id, queue: 'DOCK', slot: 0, subject: 'DOCK', stage: 1, count: 1,
      startedAt: vessel.now, readyAt, remainingSeconds, cost, ...vesselProvenance(vessel.now),
    }).returning({ id: vesselOrders.id });
    await scheduleStarter(tx, { starterGalaxyId: vessel.row.starterGalaxyId, kind: 'vessel_order_complete', refId: order!.id, resolveAt: readyAt });
    await planStarterReturn(tx, vessel.row, vessel.now, vessel.returnEligible);
    return { orderId: order!.id, vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal) };
  });
