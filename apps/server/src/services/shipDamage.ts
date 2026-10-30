import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  dockLocation,
  fleetEntries,
  repairPct,
  shipHpRepairCost,
  shipHpRepairMinutes,
  type TechLevels,
  type DamageLot,
  type DamageLots,
  type Fleet,
  type HullId,
  type HpDamageLot,
  type HpDamageLots,
} from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { buildOrders, shipDamageLots, units } from '../db/schema.js';
import { setUnits } from './planet.js';
import { readHomeHealth, writeHomeHealth } from './homeHealth.js';
import { maintenanceLanding } from '@astera/rules';
import { projectLateHomeArrival, settlePlanetRadiationAt } from './planetRadiation.js';

/**
 * KALICI GEMİ HASARI — the Repair Station's dock, in storage. `plan.md` F2.
 *
 * Wounds persist at home. Only an explicit workshop action moves ships to `dock:<lot>`,
 * where no launch lane and no defending line will find them. Every function
 * moves counts between `units` locations, and `units` stays the only record of how many
 * ships a world has.
 */

export interface DockedLot {
  id: string;
  hull: HullId;
  count: number;
  damageBp: number;
  remainderBp?: number;
  /** A `BUILDING` repair order names this lot. Derived, never stored. */
  repairing: boolean;
  /** That order, so a job holding several hulls can list them; null while the lot waits. */
  orderId: string | null;
}

/** Historical report shape. Manual landings leave both notice arrays empty. */
export interface DockReport {
  /** Historic free-repair notice; new landings do not heal. */
  autoRepaired: DamageLot[];
  /** Historic auto-dock notice; workshop entry is now manual. */
  docked: DamageLot[];
}

export interface HpDockReport extends DockReport {
  autoRepaired: HpDamageLot[];
  docked: HpDamageLot[];
}

/** How many ships a list of lots holds. */
export const shipsIn = (lots: DamageLots): number => lots.reduce((sum, lot) => sum + lot.count, 0);

/**
 * THE REPAIR STATION'S VERDICT, AS THE BELL SAYS IT.
 *
 * Only what happened: a landing or a battle with nothing damaged carries neither field,
 * so every payload before the rule reads exactly as it did.
 */
export function dockNotice(report: DockReport): { docked?: number; autoRepaired?: number } {
  return {
    ...(report.docked.length > 0 ? { docked: shipsIn(report.docked) } : {}),
    ...(report.autoRepaired.length > 0 ? { autoRepaired: shipsIn(report.autoRepaired) } : {}),
  };
}

/** Every lot waiting at this world, oldest first, with the ships `units` holds for it. */
export async function dockLotsOf(tx: Queryable, planetId: string, inventory?: readonly (typeof units.$inferSelect)[]): Promise<DockedLot[]> {
  const lots = await tx.select().from(shipDamageLots)
    .where(eq(shipDamageLots.planetId, planetId))
    .orderBy(asc(shipDamageLots.createdAt), asc(shipDamageLots.id));
  if (lots.length === 0) return [];

  const rows = inventory ?? await tx.select().from(units).where(and(
    eq(units.planetId, planetId),
    inArray(units.location, lots.map((lot) => dockLocation(lot.id))),
  ));
  return dockedLots(lots, rows, await runningRepairs(tx, lots), inventory);
}

/** `dockLotsOf` for several worlds, each with its projected inventory. Scaling plan F1.4. */
export async function dockLotsFor(tx: Queryable,
  inventories: ReadonlyMap<string, readonly (typeof units.$inferSelect)[]>): Promise<Map<string, DockedLot[]>> {
  const lots = await tx.select().from(shipDamageLots)
    .where(inArray(shipDamageLots.planetId, [...inventories.keys()]))
    .orderBy(asc(shipDamageLots.createdAt), asc(shipDamageLots.id));
  const running = await runningRepairs(tx, lots);
  return new Map([...inventories].map(([planetId, inventory]) => [planetId,
    dockedLots(lots.filter(lot => lot.planetId === planetId), inventory, running, inventory)]));
}

async function runningRepairs(tx: Queryable, lots: readonly (typeof shipDamageLots.$inferSelect)[]): Promise<Set<string>> {
  const orderIds = lots.flatMap((lot) => (lot.repairOrderId ? [lot.repairOrderId] : []));
  return new Set(orderIds.length === 0 ? [] : (await tx.select({ id: buildOrders.id })
    .from(buildOrders)
    .where(and(inArray(buildOrders.id, orderIds), eq(buildOrders.status, 'BUILDING'))))
    .map((order) => order.id));
}

function dockedLots(lots: readonly (typeof shipDamageLots.$inferSelect)[], rows: readonly (typeof units.$inferSelect)[],
  running: ReadonlySet<string>, inventory?: readonly (typeof units.$inferSelect)[]): DockedLot[] {
  const counts = new Map(rows.map((row) => [row.location, row.count]));
  // Only an explicit projected inventory can override canonical dock HP.
  const projectedDamage = new Map((inventory ?? []).filter(row => row.damage.length > 0).map(row => [row.location, row.damage[0]! ]));
  return lots.flatMap((lot) => {
    const count = counts.get(dockLocation(lot.id)) ?? 0;
    if (count <= 0) return [];
    const job = lot.repairOrderId !== null && running.has(lot.repairOrderId) ? lot.repairOrderId : null;
    const health = projectedDamage.get(dockLocation(lot.id)) ?? lot;
    return [{
      id: lot.id,
      hull: lot.hull,
      count,
      damageBp: health.damageBp,
      ...((health.remainderBp ?? 0) > 0 ? { remainderBp: health.remainderBp } : {}),
      repairing: job !== null,
      orderId: job,
    }];
  });
}

/** The ships a list of docked lots holds, by hull. */
export function shipsOfLots(lots: readonly DockedLot[]): Fleet {
  const out: Fleet = {};
  for (const lot of lots) out[lot.hull] = (out[lot.hull] ?? 0) + lot.count;
  return out;
}

/**
 * THE DOCK AS THE PLANET SCREEN SHOWS IT, PRICED ON THE SERVER. Every figure the Repair
 * Station will charge is here before anybody taps, from the same functions the job
 * uses: this world's Shipyard, this commander's research, Industrial's share. Pure.
 */
export function dockView(lots: readonly DockedLot[], yard: number, tech: TechLevels) {
  const pct = repairPct(tech);
  const waiting = lots.filter((lot) => !lot.repairing);
  return {
    lots: lots.map((lot) => ({
      ...lot,
      cost: shipHpRepairCost([lot], pct),
      minutes: shipHpRepairMinutes([lot], yard, tech, pct),
    })),
    /** "Repair all": every lot not already under repair. */
    waiting: {
      cost: shipHpRepairCost(waiting, pct),
      minutes: shipHpRepairMinutes(waiting, yard, tech, pct),
    },
    /** The share of a repair Industrial leaves: 100, 75 or 50. */
    pct,
  };
}

async function homeOf(tx: Tx, planetId: string): Promise<Fleet> {
  const rows = await tx.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const out: Fleet = {};
  for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
  return out;
}

export interface Landing {
  planetId: string;
  ownerPlayerId: string;
  fleet: Fleet;
  /** What the ships carry; null or empty when every one of them is whole. */
  damage: HpDamageLots | null | undefined;
  at: Date;
  /** A delayed worker observes now, but these ships began occupying home at arrival. */
  radiationAt?: Date;
}

/**
 * SHIPS COME DOWN ON A WORLD. The one landing every lane uses.
 *
 * Every survivor joins the home population with its exact wounds. The caller holds
 * the world's row lock; workshop entry is a separate explicit maintenance action.
 */
export async function landShips(tx: Tx, input: Landing): Promise<DockReport> {
  return landHpShips(tx, input);
}

/** The same physical landing, preserving HP fractions through the Repair Station. */
export async function landHpShips(tx: Tx, input: Omit<Landing, 'damage'> & { damage: HpDamageLots | null | undefined }): Promise<HpDockReport> {
  const arrivedAt = input.radiationAt ?? input.at;
  const state = await settlePlanetRadiationAt(tx, input.planetId, arrivedAt, input.at);
  const exposure = state ? await projectLateHomeArrival(tx, state, input.fleet, input.damage, arrivedAt) : null;
  const landing = maintenanceLanding(exposure?.fleet ?? input.fleet, exposure?.lots ?? input.damage);
  const home = await readHomeHealth(tx, input.planetId);
  const merged = home.fleet;
  for (const [hull, count] of fleetEntries(landing.home)) merged[hull] = (merged[hull] ?? 0) + count;
  await setUnits(tx, input.planetId, merged, 'home', input.ownerPlayerId);
  await writeHomeHealth(tx, input.planetId, merged, [...home.damage, ...landing.damage]);
  return { autoRepaired: landing.autoRepaired, docked: landing.docked };
}

/**
 * A REPAIR ORDER HAS FINISHED: its ships stand at home again, whole, and their lots are
 * gone. Idempotent through the order's own status claim in `applyBuildCompletion`.
 */
export async function releaseRepairedLots(
  tx: Tx,
  input: { planetId: string; ownerPlayerId: string; orderId: string },
): Promise<void> {
  const lots = await tx.select().from(shipDamageLots)
    .where(and(eq(shipDamageLots.planetId, input.planetId), eq(shipDamageLots.repairOrderId, input.orderId)));
  if (lots.length === 0) return;
  const locations = lots.map((lot) => dockLocation(lot.id));
  const rows = await tx.select().from(units)
    .where(and(eq(units.planetId, input.planetId), inArray(units.location, locations)));
  const merged = await homeOf(tx, input.planetId);
  for (const row of rows) merged[row.hull] = (merged[row.hull] ?? 0) + row.count;
  await tx.delete(units).where(and(eq(units.planetId, input.planetId), inArray(units.location, locations)));
  await tx.delete(shipDamageLots).where(inArray(shipDamageLots.id, lots.map((lot) => lot.id)));
  await setUnits(tx, input.planetId, merged, 'home', input.ownerPlayerId);
}

/**
 * A DEFENDER'S BATTLE HAS ENDED ON ITS OWN WORLD. Record the survivors' wounds at home;
 * the historical function name remains for callers, but it never auto-docks a ship.
 */
export async function dockDamaged(
  tx: Tx,
  input: { planetId: string; ownerPlayerId: string; lots: HpDamageLots; at: Date },
): Promise<DockReport> {
  const standing = await homeOf(tx, input.planetId);
  await writeHomeHealth(tx, input.planetId, standing, input.lots);
  return { autoRepaired: [], docked: [] };
}
