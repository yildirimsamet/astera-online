import { CLASS_HULLS, CLASS_STATS, SHIP_CLASSES, classTuning, type ClassStats, type ShipClass } from './classes.js';
import type { Resources } from './economy.js';
import type { Pilot } from './pilot.js';
import { ARENA_TUNING, type FlightTuning } from './tuning.js';

/**
 * THE SHIP'S LEVELS (Y6b, plan 14 §5, §7.4; owner 2026-10-23). A ship climbs 1–20 within a season,
 * never past its Komuta Çekirdeği. XP comes from cargo flown out (cargoPerXp resources = 1 XP, any
 * kind), from pilots brought down and helped down, and from each flight; a lost flight keeps
 * lostShare of it. A full bar takes no more until the level is bought with alloy and crystal.
 */
export const ARENA_PROGRESSION = Object.freeze({
  maxLevel: 20,
  /** XP from level n to n + 1: xpPerLevel · n. */
  xpPerLevel: 50,
  /** Alloy and crystal from level n to n + 1, times n. Yarık Özü joins this once it exists (plan §7.3). */
  cost: Object.freeze({ alloy: 150, crystal: 75 }),
  cargoPerXp: 10,
  kill: 40,
  assist: 15,
  sortie: 10,
  lostShare: 0.4,
  /** A hit counts as an assist this long before the kill. */
  assistSeconds: 10,
});
const P = ARENA_PROGRESSION;

type Grown = 'damage' | 'spreadBase' | 'speedMax' | 'hull' | 'fuelTank' | 'cargoCapacity';
/**
 * What each class has gained at level 20 over level one, linear in between (plan §3.2): a share of
 * the stat; for the spread, how much the cone has narrowed. Speed grows slowly so that the fastest
 * ship reaches 120 m/s (owner 2026-10-23). Turn, fire rate and magazine are the class's own.
 */
export const GROWTH: Readonly<Record<ShipClass, Readonly<Record<Grown, number>>>> = Object.freeze({
  akinci: Object.freeze({ damage: 0.475, spreadBase: 0.285, speedMax: 0.5, hull: 0.285, fuelTank: 0.285, cargoCapacity: 0.19 }),
  kilavuz: Object.freeze({ damage: 0.285, spreadBase: 0.19, speedMax: 0.35, hull: 0.38, fuelTank: 0.475, cargoCapacity: 0.38 }),
  muhafiz: Object.freeze({ damage: 0.285, spreadBase: 0.095, speedMax: 0.2, hull: 0.57, fuelTank: 0.285, cargoCapacity: 0.57 }),
});

/** A whole level in 1–20; anything else reads as the nearest real one. */
export const levelOf = (level: number): number => Number.isFinite(level) ? Math.min(P.maxLevel, Math.max(1, Math.floor(level))) : 1;

function grown(ship: ShipClass, level: number): Readonly<ClassStats> {
  const base = CLASS_STATS[ship]; const g = GROWTH[ship]; const t = (level - 1) / (P.maxLevel - 1);
  if (level === 1) return base;
  return Object.freeze({ ...base, damage: base.damage * (1 + g.damage * t), spreadBase: base.spreadBase * (1 - g.spreadBase * t),
    speedMax: base.speedMax * (1 + g.speedMax * t), hull: Math.round(base.hull * (1 + g.hull * t)),
    fuelTank: Math.round(base.fuelTank * (1 + g.fuelTank * t)), cargoCapacity: Math.round(base.cargoCapacity * (1 + g.cargoCapacity * t)) });
}
const LEVELS = Array.from({ length: P.maxLevel }, (_, i) => i + 1);
const STATS = Object.fromEntries(SHIP_CLASSES.map(ship => [ship, LEVELS.map(level => grown(ship, level))])) as Record<ShipClass, Readonly<ClassStats>[]>;
const TUNINGS = Object.fromEntries(SHIP_CLASSES.map(ship => [ship, LEVELS.map(level => level === 1 ? classTuning(ship)
  : Object.freeze({ ...ARENA_TUNING, ...STATS[ship][level - 1], capsules: CLASS_HULLS[ship] }))])) as Record<ShipClass, Readonly<FlightTuning>[]>;

/** A class's numbers at a level. */
export const shipStats = (ship: ShipClass, level: number): Readonly<ClassStats> => STATS[ship][levelOf(level) - 1] ?? CLASS_STATS[ship];
/** The arena tuning as one class flies it at a level. */
export const shipTuning = (ship: ShipClass, level: number): Readonly<FlightTuning> => TUNINGS[ship][levelOf(level) - 1] ?? classTuning(ship);
/** A ship's own numbers: its class at its level. */
export const statsOf = (pilot: Pick<Pilot, 'ship' | 'level'>): Readonly<ClassStats> => shipStats(pilot.ship, pilot.level);

/** The highest level a ship may reach with a Komuta Çekirdeği of `core`. */
export const levelCap = (core: number): number => levelOf(core);
/** XP from `level` to the next; 0 at the top. */
export const xpToNext = (level: number): number => levelOf(level) >= P.maxLevel ? 0 : P.xpPerLevel * levelOf(level);
/** What buying the level after `level` costs the capital. */
export const levelCost = (level: number): Resources => ({ alloy: P.cost.alloy * levelOf(level), crystal: P.cost.crystal * levelOf(level), deuterium: 0 });

export type SortieOutcome = 'extracted' | 'dead' | 'towed' | 'recalled' | 'test';
const count = (n: number): number => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
/**
 * A flight's XP: `earned` is everything it made, `kept` what the ship takes home. A recalled
 * flight keeps its fights; the cargo still aboard earns when it is flown out.
 */
export function sortieXp(flight: { outcome: SortieOutcome; hold: readonly number[]; pilotKills: number; assists: number }): { earned: number; kept: number } {
  const resources = flight.hold.reduce((sum, n) => sum + (Number.isFinite(n) ? Math.max(0, n) : 0), 0);
  const cargo = Math.floor(resources / P.cargoPerXp + 1e-9);
  const fights = P.kill * count(flight.pilotKills) + P.assist * count(flight.assists) + P.sortie;
  const earned = cargo + fights;
  switch (flight.outcome) {
    case 'extracted': return { earned, kept: earned };
    case 'recalled': return { earned: fights, kept: fights };
    case 'test': return { earned, kept: 0 };
    default: return { earned, kept: Math.floor(earned * P.lostShare + 1e-9) };
  }
}

/** XP into a ship's bar: never past a full bar, nothing at the Çekirdeği's cap or at the top. */
export function gainXp(ship: { level: number; xp: number; core: number }, gain: number): { xp: number; banked: number } {
  const room = ship.level < levelCap(ship.core) ? Math.max(0, xpToNext(ship.level) - ship.xp) : 0;
  const banked = Math.min(room, count(gain));
  return { xp: ship.xp + banked, banked };
}
