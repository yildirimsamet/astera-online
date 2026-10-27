import type { CombatSide } from '../combat.js';
import type { Grade } from '../types.js';
import { levelOf } from './progression.js';
import { ARENA_ECONOMY as E } from './economy.js';
import type { ShipClass } from './classes.js';

/** A season dealt at this ruleset carries escorts from its start. */
export const ADMIRAL_RULESET = 19;
export const admiralApplies = (rulesetVersion: number): boolean => rulesetVersion >= ADMIRAL_RULESET;
/**
 * Escorts are open: dealt with the season, or switched on in a live one from `admiralStartsAt`
 * (owner 2026-10-26: "canlı aktif sezonda açıcaz"). An escort changes no battle it does not join,
 * so a live season can take it mid-way; one already in the air keeps the rules it left with.
 */
export const admiralOpen = (season: { rulesetVersion: number; admiralStartsAt: Date | null }, now: Date): boolean =>
  admiralApplies(season.rulesetVersion) || (season.admiralStartsAt !== null && now >= season.admiralStartsAt);
export interface AdmiralBonuses { damage: number; hull: number; time: number; fuel: number }
export type AdmiralFlightKind = 'mission' | 'pirate' | 'mining' | 'trade' | 'convoy' | 'monument' | 'signal' | 'defence';
export interface AdmiralSnapshot { ship: ShipClass; level: number }

/** These multipliers sit outside research; they never raise or consume its 25% ceiling. */
export function admiralBonuses(ship: ShipClass, level: number): AdmiralBonuses {
  const progress = (levelOf(level) - 1) / 19;
  const bonuses = { damage: 1, hull: 1, time: 1, fuel: 1 };
  if (ship === 'akinci') bonuses.damage += .02 + .03 * progress;
  else if (ship === 'muhafiz') bonuses.hull += .02 + .03 * progress;
  else { bonuses.time -= .03 + .03 * progress; bonuses.fuel -= .05 + .05 * progress; }
  return bonuses;
}

/**
 * XP from an escort (owner 2026-10-25: "savaşın büyüklüğüne göre"): the ship value both sides lost,
 * per `perValue`, bounded; a quiet escort earns `idle`. Below the Yarık's hourly yield on purpose.
 */
export const ADMIRAL_XP = { perValue: 200, min: 10, max: 100, idle: 5 } as const;
export function admiralXp(fought: boolean, lostValue: number): number {
  if (!fought) return ADMIRAL_XP.idle;
  const xp = Number.isFinite(lostValue) ? Math.round(lostValue / ADMIRAL_XP.perValue) : 0;
  return Math.min(ADMIRAL_XP.max, Math.max(ADMIRAL_XP.min, xp));
}

/**
 * Was the escorted side beaten? (owner 2026-10-25). Grades are the attacker's: an attack is lost
 * when repelled; a defence when the attacker wins decisively.
 */
export const admiralDefeated = (side: 'attack' | 'defence', grade: Grade): boolean =>
  side === 'attack' ? grade === 'REPELLED' : grade === 'DECISIVE';

/**
 * The admiral never fights and never dies (owner 2026-10-25): a lost battle, or a fleet lost to the
 * last ship, sends it home to repair; any other return is the bay's service.
 */
export function admiralOutcome(input: { fought: boolean; lost: boolean; landedShips: number; lostValue: number }): {
  xp: number; readyReason: 'repair' | 'service'; minutes: number;
} {
  const repair = input.lost || input.landedShips <= 0;
  return { xp: admiralXp(input.fought, input.lostValue),
    readyReason: repair ? 'repair' : 'service', minutes: repair ? E.repairMinutes : E.serviceMinutes };
}

/** Preserve other combat modifiers and the research snapshot; only this fleet receives its escort. */
export function withAdmiral(side: CombatSide, admiral: AdmiralSnapshot | null | undefined): CombatSide {
  if (!admiral) return side;
  const bonus = admiralBonuses(admiral.ship, admiral.level);
  return { ...side, damageMult: (side.damageMult ?? 1) * bonus.damage, hullMult: (side.hullMult ?? 1) * bonus.hull };
}
