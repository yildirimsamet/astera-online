import { combatValue, fleetDiff, fleetEntries } from './hulls.js';
import type { Fleet } from './types.js';
import type { CombatRound } from './combat.js';

export interface RetreatWindow { chance: number; threshold: number }

/** The whole side's entry power, never cargo or the evolving survivor count. */
export function battleRetreatPolicy(attacker: Fleet, defender: Fleet): { attacker: RetreatWindow; defender: RetreatWindow } {
  const a = combatValue(attacker), d = combatValue(defender);
  const small = Math.min(a, d), ratio = a === d ? 1 : small > 0 ? Math.max(a, d) / small : Infinity;
  const [weak, strong]: [RetreatWindow, RetreatWindow] = ratio >= 3
    ? [{ chance: 0.7, threshold: 0.7 }, { chance: 0.1, threshold: 0.25 }]
    : ratio >= 2
      ? [{ chance: 0.55, threshold: 0.55 }, { chance: 0.15, threshold: 0.3 }]
      : ratio >= 1.5
        ? [{ chance: 0.33, threshold: 0.3 }, { chance: 0.2, threshold: 0.3 }]
        : [{ chance: 0.25, threshold: 0.25 }, { chance: 0.25, threshold: 0.25 }];
  return { attacker: a < d ? weak : strong, defender: d < a ? weak : strong };
}

/** Physical survival is for ownership/accounting; only the active remainder can fight or loot. */
export const activeBattleFleet = (survivors: Fleet, retreated?: Fleet): Fleet => fleetDiff(survivors, retreated ?? {});

/** Sum immutable ownership telemetry without exposing the raw owner rows. */
function battleOwnedFleet(rounds: readonly CombatRound[], field: 'retreats' | 'casualties', side: 'ATTACK' | 'DEFENCE', playerId?: string): Fleet {
  const result: Fleet = {};
  for (const round of rounds) for (const row of round[field] ?? []) {
    if (row.side !== side || (playerId !== undefined && row.playerId !== playerId)) continue;
    for (const [hull, count] of fleetEntries(row.fleet)) result[hull] = (result[hull] ?? 0) + count;
  }
  return result;
}

export const battleRetreated = (rounds: readonly CombatRound[], side: 'ATTACK' | 'DEFENCE', playerId?: string): Fleet =>
  battleOwnedFleet(rounds, 'retreats', side, playerId);
export const battleCasualties = (rounds: readonly CombatRound[], side: 'ATTACK' | 'DEFENCE', playerId: string): Fleet =>
  battleOwnedFleet(rounds, 'casualties', side, playerId);
