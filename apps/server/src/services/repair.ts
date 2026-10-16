import { and, eq, inArray } from 'drizzle-orm';
import {
  repairPct,
  dockLocation,
  shipDamageApplies,
  shipHpRepairCost,
  shipHpRepairMinutes,
  honorRepairResources,
  type HonorBenefitTier,
  type HpDamageLot,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { shipDamageLots, units } from '../db/schema.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { GameError, assertWorldOperational, loadLocked } from './planet.js';
import { idempotentMutation } from './idempotency.js';
import { loadPlanetViewData, buildPlanetView, type PlanetView } from './planetView.js';
import { asTech } from './researchState.js';
import { dockLotsOf } from './shipDamage.js';
import { assertWorkshopOpen } from './workshop.js';
import { readHonorBenefits, assertHonorBenefitsQuote } from './honorBenefits.js';

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

export type RepairRequest = ({ lotIds: readonly string[] } | { all: true }
  | { lots: readonly { id: string; count: number; damageBp?: number; remainderBp?: number }[] }) & { expectedHonorTier?: HonorBenefitTier };

export async function startRepair(
  db: Db,
  planetId: string,
  request: RepairRequest,
  clock: Clock,
  expectedPlayerId?: string,
  key?: string,
): Promise<{ orderId: string; planet: PlanetView }> {
  const mutate = async (tx: Tx) => {
    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    await assertWorkshopOpen(tx, planet);
    if (!shipDamageApplies(planet.rulesetVersion)) {
      throw new GameError('SHIP_DAMAGE_UNAVAILABLE', 'This season has no Repair Station', 403);
    }
    // Refuses a full lane or a head that is settling before a lot is looked at.
    const context = await buildQueueContext(tx, planet, 'REPAIR');
    const benefits = await readHonorBenefits(tx, planet.seasonId, planet.playerId);
    assertHonorBenefitsQuote(benefits, request.expectedHonorTier);

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
    } else if ('lotIds' in request) {
      chosen = [...new Set(request.lotIds)].map((id) => {
        const lot = docked.find((row) => row.id === id);
        if (!lot) throw new GameError('REPAIR_LOT_NOT_FOUND', 'No damaged ships like that wait here', 404);
        if (lot.repairing) throw new GameError('REPAIR_LOT_BUSY', 'Those ships are already under repair', 409);
        return lot;
      });
    } else {
      const seen = new Set<string>();
      chosen = [];
      for (const picked of request.lots) {
        const lot = docked.find((row) => row.id === picked.id);
        if (!lot || seen.has(picked.id) || !Number.isSafeInteger(picked.count) || picked.count < 1 || picked.count > lot.count) {
          throw new GameError('SHIP_SELECTION_CHANGED', 'The selected dock group changed; refresh the selection', 409);
        }
        if (lot.repairing) throw new GameError('REPAIR_LOT_BUSY', 'Those ships are already under repair', 409);
        if ((picked.damageBp !== undefined && picked.damageBp !== lot.damageBp)
          || (picked.remainderBp !== undefined && picked.remainderBp !== (lot.remainderBp ?? 0))) {
          throw new GameError('SHIP_SELECTION_CHANGED', 'The selected ships have changed health; refresh the quote', 409);
        }
        seen.add(picked.id);
        if (picked.count === lot.count) chosen.push(lot);
        else {
          const [split] = await tx.insert(shipDamageLots).values({ planetId, hull: lot.hull, damageBp: lot.damageBp,
            remainderBp: lot.remainderBp ?? 0, createdAt: planet.now }).returning({ id: shipDamageLots.id });
          if (!split) throw new Error('partial repair lot insert returned no row');
          await tx.update(units).set({ count: lot.count - picked.count })
            .where(and(eq(units.planetId, planetId), eq(units.location, dockLocation(lot.id))));
          await tx.insert(units).values({ planetId, ownerPlayerId: planet.playerId, hull: lot.hull,
            location: dockLocation(split.id), count: picked.count });
          chosen.push({ ...lot, id: split.id, count: picked.count });
        }
      }
    }

    const lots: HpDamageLot[] = chosen.map(({ hull, count, damageBp, remainderBp }) => ({ hull, count, damageBp, remainderBp: remainderBp ?? 0 }));
    if (lots.length === 0) throw new GameError('REPAIR_NOTHING_WAITING', 'No damaged ship selected', 409);
    const tech = asTech(context.projected.research);
    const pct = repairPct(tech);
    const hulls = new Set(lots.map((lot) => lot.hull));
    const order = await placeBuildOrder(tx, planet, context, {
      kind: 'REPAIR',
      subject: hulls.size === 1 ? [...hulls][0] ?? 'ALL' : 'ALL',
      count: lots.reduce((sum, lot) => sum + lot.count, 0),
      cost: benefits ? honorRepairResources(shipHpRepairCost(lots, pct), benefits) : shipHpRepairCost(lots, pct),
      minutes: shipHpRepairMinutes(lots, planet.buildings.SHIPYARD, tech, pct),
    });
    await tx.update(shipDamageLots).set({ repairOrderId: order.id })
      .where(inArray(shipDamageLots.id, chosen.map((lot) => lot.id)));

    return { orderId: order.id };
  };
  let receipt: { orderId: string };
  if (key !== undefined) {
    if (!expectedPlayerId) throw new GameError('PLANET_NOT_OWNED', 'A repair retry needs its commander', 403);
    receipt = await idempotentMutation(db, { playerId: expectedPlayerId, operation: `repair:${planetId}`, key,
      body: request, now: clock.now() }, mutate);
  } else receipt = await db.transaction(mutate);
  const planet = await db.transaction(async tx => {
    await loadLocked(tx, planetId, clock, { expectedPlayerId });
    return loadPlanetViewData(tx, planetId, clock);
  });
  return { ...receipt, planet: buildPlanetView(planet) };

}
