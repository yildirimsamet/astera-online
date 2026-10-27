import type { ShipClass } from './classes.js';
import { levelOf, shipStats } from './progression.js';

/**
 * THE SHIP'S REAL ECONOMY (Y6a, plan 14 §7; owner 2026-10-23). What a pilot farms lands in the
 * capital one for one, through an exit only. The tank and magazine are filled from the capital's
 * deuterium before a flight, the missing part only; what is left stays aboard. Each day carries at
 * most capHours of the capital's own production of each resource. A destroyed ship is repaired
 * for free in repairMinutes; every flight ends with serviceMinutes of maintenance. Both are 3 min
 * for now (owner 2026-10-28: "biraz oynasınlar alışsınlar"); an escort keeps its own (ADMIRAL_WAIT).
 */
export const ARENA_ECONOMY = Object.freeze({
  /** Komuta Merkezi level that gives a commander a ship (plan 14 §3). */
  minCore: 9,
  /** Deuterium for a full tank and a full magazine, by class (level one). */
  refill: Object.freeze({
    akinci: Object.freeze({ fuel: 30, ammo: 15 }),
    kilavuz: Object.freeze({ fuel: 40, ammo: 22 }),
    muhafiz: Object.freeze({ fuel: 50, ammo: 30 }),
  }) satisfies Readonly<Record<ShipClass, Readonly<{ fuel: number; ammo: number }>>>,
  capHours: 4,
  repairMinutes: 3,
  serviceMinutes: 3,
  freeChangeHours: 24,
  /** Entry closes this long before the season ends (KG-A16). */
  entryClosesMinutes: 10,
});

export interface Resources { alloy: number; crystal: number; deuterium: number }
const KINDS = ['alloy', 'crystal', 'deuterium'] as const;

/** Plan 14 §7.4: the wait after payment, and its price. The free repair stays available. */
export function repairQuote(level: number): { minutes: number; cost: Resources } {
  const at = levelOf(level);
  return { minutes: 15 + Math.round(15 * (at - 1) / 19), cost: { alloy: 150 + 25 * at, crystal: 50 + 10 * at, deuterium: 0 } };
}

/**
 * WHAT THE LAUNCH PUTS ABOARD (owner 2026-10-27: half a tank, a light magazine). A plan in percent:
 * the tank in quarters, the magazine from empty (a miner's run). The launch tops each up to its
 * plan; what is aboard above the plan stays, and is never bought back.
 */
export const LOADOUT = Object.freeze({ fuel: Object.freeze([25, 50, 75, 100]), ammo: Object.freeze([0, 25, 50, 75, 100]) });
export interface LoadoutPlan { fuel: number; ammo: number }
export const FULL_LOADOUT: LoadoutPlan = Object.freeze({ fuel: 100, ammo: 100 });

/** The plan when both parts are steps `LOADOUT` offers, else null. */
export function loadoutPlan(plan: LoadoutPlan): LoadoutPlan | null {
  return LOADOUT.fuel.includes(plan.fuel) && LOADOUT.ammo.includes(plan.ammo) ? { fuel: plan.fuel, ammo: plan.ammo } : null;
}

/**
 * Deuterium that tops `ship` up from `fuel` and `ammo` to `plan`: each part rounded up, so nothing
 * is filled free. A full tank costs the same at every level (Y6b): a grown tank holds more for the price.
 */
export function refillCost(ship: ShipClass, fuel: number, ammo: number, level = 1, plan: LoadoutPlan = FULL_LOADOUT): { fuel: number; ammo: number; total: number } {
  const stats = shipStats(ship, level); const price = ARENA_ECONOMY.refill[ship];
  const part = (left: number, full: number, want: number, cost: number): number =>
    Math.max(0, Math.ceil(Math.max(0, Math.min(1, want / 100) - Math.max(0, left / full)) * cost - 1e-9));
  const tank = part(fuel, stats.fuelTank, plan.fuel, price.fuel); const magazine = part(ammo, stats.ammoCapacity, plan.ammo, price.ammo);
  return { fuel: tank, ammo: magazine, total: tank + magazine };
}

/** The tank and magazine a launch flies with: the plan, or what is aboard when that is more; never past full. */
export function launchLoad(ship: ShipClass, level: number, fuel: number, ammo: number, plan: LoadoutPlan): { fuel: number; ammo: number } {
  const stats = shipStats(ship, level);
  const load = (left: number, full: number, want: number): number => Math.min(full, Math.max(left, full * Math.min(1, want / 100)));
  return { fuel: load(fuel, stats.fuelTank, plan.fuel), ammo: load(ammo, stats.ammoCapacity, plan.ammo) };
}

/** A day's transfer limit: capHours of each hourly rate, in whole resources (a fraction is dropped). */
export function dailyCap(perHour: Resources): Resources {
  const cap = (rate: number): number => Math.floor(Math.max(0, rate) * ARENA_ECONOMY.capHours + 1e-9);
  return { alloy: cap(perHour.alloy), crystal: cap(perHour.crystal), deuterium: cap(perHour.deuterium) };
}

/** What an extracted hold lands with `room` left today: whole resources up to the room; the rest is overflow. */
export function settleHold(hold: readonly number[], room: Resources): { deposit: Resources; overflow: Resources } {
  const deposit: Resources = { alloy: 0, crystal: 0, deuterium: 0 }; const overflow: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  KINDS.forEach((kind, i) => {
    const carried = Math.floor(Math.max(0, hold[i] ?? 0) + 1e-9);
    deposit[kind] = Math.min(carried, Math.max(0, Math.floor(room[kind] + 1e-9)));
    overflow[kind] = carried - deposit[kind];
  });
  return { deposit, overflow };
}

/** The one free class change: not used yet, inside freeChangeHours of the first choice. */
export function classChangeOpen(chosenAt: Date, changedAt: Date | null, now: Date): boolean {
  return changedAt === null && now.getTime() < chosenAt.getTime() + ARENA_ECONOMY.freeChangeHours * 3_600_000;
}

/** A flight may start until entryClosesMinutes before the season's end. */
export function entryOpen(seasonEndsAt: Date, now: Date): boolean {
  return now.getTime() < seasonEndsAt.getTime() - ARENA_ECONOMY.entryClosesMinutes * 60_000;
}
