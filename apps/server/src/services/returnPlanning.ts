import {
  REWARD_CHAINS, REPAIR_LADDER, alloyRate, buildingCost, collectorCap, crystalRate,
  nextRequiredStep, type BuildingId,
} from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import type { vessels } from '../db/schema.js';
import type { Tx } from '../db/client.js';
import { buildOrders, players, returnReminders, vesselMigrations, vesselOrders } from '../db/schema.js';
import { nextReturnCheck, plannedReturnCheck } from './returnSchedule.js';
import type { LockedPlanet } from './planet.js';

const HOUR = 3_600_000, DAY = 24 * HOUR;
type Ship = typeof vessels.$inferSelect;
interface Purse { alloy: number; crystal: number; bufferAlloy: number; bufferCrystal: number }
interface Target { subject: string; alloy: number; crystal: number }

/** No appointment is made for a price that production cannot reach before the works fill. */
function affordableAt(target: Target | undefined, held: Purse, rates: { alloy: number; crystal: number }, now: Date): Date | null {
  if (!target) return null;
  const wait = (price: number, store: number, buffer: number, rate: number): number => {
    if (price <= store + buffer) return 0;
    if (rate <= 0 || price > store + collectorCap(rate)) return Infinity;
    return (price - store - buffer) / rate * HOUR;
  };
  const ms = Math.max(wait(target.alloy, held.alloy, held.bufferAlloy, rates.alloy), wait(target.crystal, held.crystal, held.bufferCrystal, rates.crystal));
  return Number.isFinite(ms) ? new Date(now.getTime() + Math.ceil(ms)) : null;
}
export async function starterTarget(tx: Tx, ship: Ship): Promise<Target | undefined> {
  const orders = await tx.select().from(vesselOrders).where(and(eq(vesselOrders.vesselId, ship.id), eq(vesselOrders.queue, 'CONSTRUCTION'), eq(vesselOrders.status, 'BUILDING')));
  const queued = orders.flatMap(o => REPAIR_LADDER.find(s => s.module === o.subject && s.stage === o.stage) ?? []);
  const next = nextRequiredStep({ modules: ship.modules, facts: ship.facts, parts: ship.parts, fuel: ship.fuel }, queued);
  if (!next || next.missing.length) return undefined;
  return { ...next.step, subject: `${next.step.module}:${String(next.step.stage)}` };
}
export async function planStarterReturn(tx: Tx, ship: Ship, now: Date, eligible = false): Promise<void> {
  if (!eligible) return;
  if (ship.status === 'DEPARTED' || ship.status === 'DEPARTING') return;
  const target = await starterTarget(tx, ship);
  const nextRepairAt = affordableAt(target, ship, { alloy: alloyRate(ship.modules.REFINERY ?? 0), crystal: crystalRate(ship.modules.EXTRACTOR ?? 0) }, now);
  await tx.insert(returnReminders).values({ accountId: ship.accountId, vesselId: ship.id, subject: target?.subject ?? null, nextRepairAt, nextCheckAt: nextReturnCheck(ship.lastSeenAt, 0, nextRepairAt), absenceAt: ship.lastSeenAt })
    .onConflictDoUpdate({ target: returnReminders.accountId, set: { vesselId: ship.id, planetId: null, subject: target?.subject ?? null, nextRepairAt, nextCheckAt: plannedReturnCheck } });
}

/** After landing, follow the existing building reward goals in their published order. */
const MAIN_ROAD: readonly BuildingId[] = ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'];
export async function mainTarget(tx: Tx, planet: LockedPlanet): Promise<Target | undefined> {
  const orders = await tx.select().from(buildOrders).where(and(eq(buildOrders.planetId, planet.planetId), eq(buildOrders.kind, 'BUILDING'), eq(buildOrders.status, 'BUILDING')));
  for (const module of MAIN_ROAD) {
    const level = planet.buildings[module] + orders.filter(o => o.subject === module).length;
    if (!REWARD_CHAINS.find(chain => chain.id === module)?.tiers.some(tier => tier.goal > level)) continue;
    return { subject: `${module}:${String(level + 1)}`, ...buildingCost(module, level) };
  }
  return undefined;
}
export async function planPlanetReturn(tx: Tx, planet: LockedPlanet): Promise<void> {
  if (planet.kind !== 'CAPITAL' || planet.returnEligible !== true) return;
  const [player] = await tx.select({ accountId: players.accountId, lastActiveAt: players.lastActiveAt }).from(players).where(eq(players.id, planet.playerId));
  if (!player) return;
  const [landing] = await tx.select({ at: vesselMigrations.completedAt }).from(vesselMigrations).where(and(eq(vesselMigrations.playerId, planet.playerId), eq(vesselMigrations.status, 'DONE')));
  const target = landing?.at && planet.now.getTime() - landing.at.getTime() < 7 * DAY ? await mainTarget(tx, planet) : undefined;
  const nextRepairAt = affordableAt(target, planet, { alloy: alloyRate(planet.buildings.REFINERY), crystal: crystalRate(planet.buildings.EXTRACTOR) }, planet.now);
  await tx.insert(returnReminders).values({ accountId: player.accountId, planetId: planet.planetId, subject: target?.subject ?? null, nextRepairAt, nextCheckAt: nextReturnCheck(player.lastActiveAt, 0, nextRepairAt), absenceAt: player.lastActiveAt })
    .onConflictDoUpdate({ target: returnReminders.accountId, set: { vesselId: null, planetId: planet.planetId, subject: target?.subject ?? null, nextRepairAt, nextCheckAt: plannedReturnCheck } });
}

