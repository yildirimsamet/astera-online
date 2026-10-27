import { holdPoints } from './farms.js';
import type { Resources } from './economy.js';
import type { ShipClass } from './classes.js';
import type { AbilityPoints } from './ranks.js';
import type { Tactic } from './pilot.js';

export const TEAM_CLAIM_DAYS = 7;
export const TEAM_CONNECT_SECONDS = 30;
export interface SortieLoadout {
  sortieId: string; ship: ShipClass; level: number; fuel: number; ammo: number; hold: number[]; refilled: number;
  abilities: AbilityPoints; clanId?: string | null; teamId?: string; tactic?: Tactic;
  /** A reconnected observer's ended flight, never a new flight. */
  spectating?: 'dead' | 'extracted' | 'towed' | 'recalled' | 'test';
}
export interface TeamMemberView {
  playerId: string; name: string; ready: boolean; tactic: Tactic; outcome: string | null; blocked: string | null;
  ship: { class: ShipClass; level: number; fuel: number; fuelMax: number; readyAt: string | null } | null;
}
export interface TeamView {
  playerId: string; clanId: string | null; capacity: number; canCreate: boolean;
  team: { id: string; state: 'forming' | 'flying'; leaderId: string; joined: boolean; members: TeamMemberView[] } | null;
  claims: { teamId: string; share: Resources; finishedAt: string; autoAt: string }[];
  receipt?: { deposit: Resources; overflow: Resources };
}

/** Owner 2026-10-24: equal whole shares; all remainders go to the highest extracted value. */
export function splitTeamLoot(members: readonly { playerId: string; extracted: Resources }[]): { playerId: string; share: Resources }[] {
  if (members.length === 0 || new Set(members.map(m => m.playerId)).size !== members.length) throw new Error('Invalid team roster');
  const kinds = ['alloy', 'crystal', 'deuterium'] as const;
  const pool = { alloy: 0, crystal: 0, deuterium: 0 };
  for (const m of members) for (const kind of kinds) {
    const n = m.extracted[kind];
    if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(pool[kind] + n)) throw new Error('Invalid team cargo');
    pool[kind] += n;
  }
  const value = (m: typeof members[number]): number => holdPoints([m.extracted.alloy, m.extracted.crystal, m.extracted.deuterium]);
  if (members.some(m => !Number.isSafeInteger(value(m)))) throw new Error('Unsafe team value');
  const winner = [...members].sort((a, b) => value(b) - value(a) || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))[0];
  return members.map(m => {
    const units = (kind: typeof kinds[number]): number => Math.floor(pool[kind] / members.length) + (m === winner ? pool[kind] % members.length : 0);
    return { playerId: m.playerId, share: { alloy: units('alloy'), crystal: units('crystal'), deuterium: units('deuterium') } };
  });
}
