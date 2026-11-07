import { deliverRepairNotice, deliverShipPush } from '../services/starter/noticeQueue.js';
import { openFeatures } from '@astera/rules';
import { eq } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { vesselOrders, vessels } from '../db/schema.js';
import { resolveMissionArrival, resolveMissionReturn } from '../services/starter/arrival.js';
import { deliverRadarWarning, warnShieldFalling } from '../services/starter/fleet.js';
import { ringShip } from '../services/starter/push.js';
import { progressOf, settleVesselById } from '../services/starter/vessel.js';
import type { StarterEventRow } from './starterQueue.js';

export interface StarterHandlerContext { db: Db; clock: Clock }
export type StarterHandler = (ctx: StarterHandlerContext, event: StarterEventRow) => Promise<void>;

const systemsOpen = async (db: Db, vesselId: string): Promise<number> => {
  const [row] = await db.select().from(vessels).where(eq(vessels.id, vesselId));
  return row ? openFeatures(progressOf(row)).size : 0;
};

/**
 * Handlers of this galaxy's queue. Each is safe to run twice: delivery is at least once, and a
 * command may have settled the ship before the event came due.
 */
export const STARTER_HANDLERS: Partial<Record<StarterEventRow['kind'], StarterHandler>> & { vessel_order_complete: StarterHandler } = {
  vessel_repair_notice: async ({ db, clock }, event) => deliverRepairNotice(db, clock, event),
  vessel_push: async ({ db, clock }, event) => deliverShipPush(db, clock, event),
  /** A cancelled or already finished order settles nothing, and a deleted ship has no row to find. */
  vessel_order_complete: async ({ db, clock }, event) => {
    if (!event.refId) return;
    const [order] = await db.select({ vesselId: vesselOrders.vesselId }).from(vesselOrders).where(eq(vesselOrders.id, event.refId));
    if (!order) return;
    const before = await systemsOpen(db, order.vesselId);
    await settleVesselById(db, order.vesselId, clock);
    // Finished by a command, the player was right there. Finished here, it is a reason to come back (§3.10).
    if (await systemsOpen(db, order.vesselId) > before) await ringShip(db, order.vesselId, { kind: 'system_open', refId: event.refId }, clock.now());
  },

  vessel_mission_arrival: async ({ db, clock }, event) => {
    if (event.refId) await resolveMissionArrival(db, event.refId, clock);
  },

  vessel_mission_return: async ({ db, clock }, event) => {
    if (event.refId) await resolveMissionReturn(db, event.refId, clock);
  },

  pvp_shield_warning: async ({ db, clock }, event) => {
    if (event.refId) await warnShieldFalling(db, event.refId, clock);
  },

  vessel_radar_warning: async ({ db, clock }, event) => {
    if (event.refId) await deliverRadarWarning(db, event.refId, clock);
  },
};
