import { eq, inArray } from 'drizzle-orm';
import {
  repairPct,
  shipDamageApplies,
  shipHpRepairCost,
  shipHpRepairMinutes,
  type HpDamageLot,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { shipDamageLots } from '../db/schema.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { GameError, assertWorldOperational, withPlanetLock } from './planet.js';
import { planetView, type PlanetView } from './planetView.js';
import { asTech } from './researchState.js';
import { dockLotsOf } from './shipDamage.js';

/**
 * THE REPAIR STATION. Kalıcı gemi hasarı, owner decisions K2 and K6 (`plan.md` F4).
 *
 * Every world has one. It costs nothing, has no levels and needs no construction, and
 * nothing gates it — not the Shipyard's level, not the research that opened a hull, not
 * a revolt in the yard: it is its own facility (plan D11).
 *
 * A JOB IS A `build_orders` ROW IN ITS OWN `REPAIR` QUEUE, so it inherits every rule the
 * yard's queue has already earned: one job at a time and three deep, the next starting
 * where the last ends, half back on a cancel and all of it on a server abandonment,
 * the season-end guard, and one completion event. Which lots a job works on is written
 * on the lots themselves; a lot is under repair exactly while its order is `BUILDING`.
 *
 * THE PRICE IS READ WHEN THE JOB STARTS AND FROZEN INTO IT: the world's Shipyard and the
 * commander's research at that moment, as a hull order reads them (plan D5).
 */

export type RepairRequest = { lotIds: readonly string[] } | { all: true };

export async function startRepair(
  db: Db,
  planetId: string,
  request: RepairRequest,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<{ orderId: string; planet: PlanetView }> {
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    if (!shipDamageApplies(planet.rulesetVersion)) {
      throw new GameError('SHIP_DAMAGE_UNAVAILABLE', 'This season has no Repair Station', 403);
    }
    // Refuses a full lane or a head that is settling before a lot is looked at.
    const context = await buildQueueContext(tx, planet, 'REPAIR');

    // Under the world's row lock already; the lot rows are taken too, so the choice
    // below reads what no other transaction can move.
    await tx.select({ id: shipDamageLots.id }).from(shipDamageLots)
      .where(eq(shipDamageLots.planetId, planetId)).for('update');
    const docked = await dockLotsOf(tx, planetId);

    let chosen: typeof docked;
    if ('all' in request) {
      chosen = docked.filter((lot) => !lot.repairing);
      if (chosen.length === 0) {
        throw new GameError('REPAIR_NOTHING_WAITING', 'No damaged ship is waiting here', 409);
      }
    } else {
      chosen = [...new Set(request.lotIds)].map((id) => {
        const lot = docked.find((row) => row.id === id);
        if (!lot) throw new GameError('REPAIR_LOT_NOT_FOUND', 'No damaged ships like that wait here', 404);
        if (lot.repairing) throw new GameError('REPAIR_LOT_BUSY', 'Those ships are already under repair', 409);
        return lot;
      });
    }

    const lots: HpDamageLot[] = chosen.map(({ hull, count, damageBp, remainderBp }) => ({ hull, count, damageBp, remainderBp: remainderBp ?? 0 }));
    const tech = asTech(context.projected.research);
    const pct = repairPct(tech);
    const hulls = new Set(lots.map((lot) => lot.hull));
    const order = await placeBuildOrder(tx, planet, context, {
      kind: 'REPAIR',
      subject: hulls.size === 1 ? [...hulls][0] ?? 'ALL' : 'ALL',
      count: lots.reduce((sum, lot) => sum + lot.count, 0),
      cost: shipHpRepairCost(lots, pct),
      minutes: shipHpRepairMinutes(lots, planet.buildings.SHIPYARD, tech, pct),
    });
    await tx.update(shipDamageLots).set({ repairOrderId: order.id })
      .where(inArray(shipDamageLots.id, chosen.map((lot) => lot.id)));

    return { orderId: order.id, planet: await planetView(tx, planetId, clock) };
  }, expectedPlayerId);
}
