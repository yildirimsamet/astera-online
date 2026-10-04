import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  dockLocation,
  fleetEntries,
  repairPct,
  shipHpRepairCost,
  shipHpRepairMinutes,
  splitForHpLanding,
  splitForLanding,
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

/**
 * KALICI GEMİ HASARI — the Repair Station's dock, in storage. `plan.md` F2.
 *
 * `damage.ts` decides what damage means; this file writes the answer down. Ships above
 * the owner's twenty percent leave `home` for `dock:<lot>`, where no launch lane and no
 * defending line will find them. Nothing here creates or destroys a ship: every function
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

/** What the Repair Station did with ships just judged, for the report and the bell. */
export interface DockReport {
  /** At or under the line: patched free, now standing at home. */
  autoRepaired: DamageLot[];
  /** Above it: waiting in the dock. */
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
export async function dockLotsOf(tx: Queryable, planetId: string): Promise<DockedLot[]> {
  const lots = await tx.select().from(shipDamageLots)
    .where(eq(shipDamageLots.planetId, planetId))
    .orderBy(asc(shipDamageLots.createdAt), asc(shipDamageLots.id));
  if (lots.length === 0) return [];

  const rows = await tx.select().from(units).where(and(
    eq(units.planetId, planetId),
    inArray(units.location, lots.map((lot) => dockLocation(lot.id))),
  ));
  const counts = new Map(rows.map((row) => [row.location, row.count]));
  const orderIds = lots.flatMap((lot) => (lot.repairOrderId ? [lot.repairOrderId] : []));
  const running = new Set(orderIds.length === 0 ? [] : (await tx.select({ id: buildOrders.id })
    .from(buildOrders)
    .where(and(inArray(buildOrders.id, orderIds), eq(buildOrders.status, 'BUILDING'))))
    .map((order) => order.id));

  return lots.flatMap((lot) => {
    const count = counts.get(dockLocation(lot.id)) ?? 0;
    if (count <= 0) return [];
    const job = lot.repairOrderId !== null && running.has(lot.repairOrderId) ? lot.repairOrderId : null;
    return [{
      id: lot.id,
      hull: lot.hull,
      count,
      damageBp: lot.damageBp,
      ...(lot.remainderBp > 0 ? { remainderBp: lot.remainderBp } : {}),
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

/** One lot row per landing's damage state, and its ships at `dock:<lot>`. Never merged. */
async function dock(tx: Tx, planetId: string, ownerPlayerId: string, lots: HpDamageLots, at: Date): Promise<void> {
  for (const lot of lots) {
    const [row] = await tx.insert(shipDamageLots)
      .values({ planetId, hull: lot.hull, damageBp: lot.damageBp, remainderBp: lot.remainderBp ?? 0, createdAt: at })
      .returning({ id: shipDamageLots.id });
    if (!row) throw new Error('dock lot insert returned no row');
    await tx.insert(units).values({
      planetId, ownerPlayerId, hull: lot.hull, location: dockLocation(row.id), count: lot.count,
    });
  }
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
}

/**
 * SHIPS COME DOWN ON A WORLD. The one landing every lane uses.
 *
 * Undamaged, this is the read-merge-write every landing already did. Damaged, the
 * Repair Station judges each ship as it lands: at or under the line it is patched and
 * joins the others at home, above it it goes to the dock. The caller holds the world's
 * row lock, as every landing already does.
 */
export async function landShips(tx: Tx, input: Landing): Promise<DockReport> {
  if (input.damage?.some((lot) => lot.remainderBp !== undefined)) return landHpShips(tx, input);
  const landing = splitForLanding(input.fleet, input.damage);
  const merged = await homeOf(tx, input.planetId);
  for (const [hull, count] of fleetEntries(landing.home)) merged[hull] = (merged[hull] ?? 0) + count;
  await setUnits(tx, input.planetId, merged, 'home', input.ownerPlayerId);
  await dock(tx, input.planetId, input.ownerPlayerId, landing.docked, input.at);
  return { autoRepaired: landing.autoRepaired, docked: landing.docked };
}

/** The same physical landing, preserving HP fractions through the Repair Station. */
export async function landHpShips(tx: Tx, input: Omit<Landing, 'damage'> & { damage: HpDamageLots | null | undefined }): Promise<HpDockReport> {
  const landing = splitForHpLanding(input.fleet, input.damage);
  const merged = await homeOf(tx, input.planetId);
  for (const [hull, count] of fleetEntries(landing.home)) merged[hull] = (merged[hull] ?? 0) + count;
  await setUnits(tx, input.planetId, merged, 'home', input.ownerPlayerId);
  await dock(tx, input.planetId, input.ownerPlayerId, landing.docked, input.at);
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
 * A DEFENDER'S BATTLE HAS ENDED ON ITS OWN WORLD. The same judgement as a landing, with
 * the ships already standing at home: the badly damaged step off the line into the dock
 * before anything else can read the garrison.
 */
export async function dockDamaged(
  tx: Tx,
  input: { planetId: string; ownerPlayerId: string; lots: HpDamageLots; at: Date },
): Promise<DockReport> {
  const standing = await homeOf(tx, input.planetId);
  const judged = input.lots.some((lot) => lot.remainderBp !== undefined) ? splitForHpLanding(standing, input.lots) : splitForLanding(standing, input.lots);
  const moved: Fleet = {};
  for (const lot of judged.docked) moved[lot.hull] = judged.home[lot.hull] ?? 0;
  await setUnits(tx, input.planetId, moved, 'home', input.ownerPlayerId);
  await dock(tx, input.planetId, input.ownerPlayerId, judged.docked, input.at);
  return { autoRepaired: judged.autoRepaired, docked: judged.docked };
}
