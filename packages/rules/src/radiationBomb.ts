import { ECONOMY_ADJUSTMENT } from './tempo.js';

/**
 * Normalized nose-to-tail lengths in world space, shared by hulls and frozen flight geometry.
 * Doubled on 2026-10-16 (owner: every missile twice its size), so a new flight still stops
 * half a hull outside the surface; a flight already in the air keeps the endpoints it froze.
 */
export const RADIATION_BOMB_VISUAL = {
  1: { length: .96, glow: '#cbdc91', flame: '#a9dcff' },
  2: { length: 1.28, glow: '#75e5c6', flame: '#b0f2db' },
  3: { length: 1.68, glow: '#f0c36c', flame: '#ffd18c' },
} as const;

export type RadiationBombLevel = 1 | 2 | 3;
export type RadiationBombType = `RADIATION_BOMB_L${RadiationBombLevel}`;

/** Owner-approved catalogue. A launched bomb still occupies its level's slot. */
export const RADIATION_BOMB = {
  stockPerLevel: 1,
  requiredCore: 13,
  requiredShipyard: 5,
  /** 30% faster than the original 1,000 (owner, 2026-10-16). */
  speed: 1000 * 1.3,
  durationMinutes: 30,
  maxHpPerMinute: 50,
  levels: {
    1: { type: 'RADIATION_BOMB_L1', cost: { alloy: 30000, crystal: 20000, deuterium: 2000 }, nominalMinutes: 30, colonyLoyaltyLoss: 5, colonyFaults: 0 },
    2: { type: 'RADIATION_BOMB_L2', cost: { alloy: 40000, crystal: 28000, deuterium: 2500 }, nominalMinutes: 45, colonyLoyaltyLoss: 10, colonyFaults: 1 },
    3: { type: 'RADIATION_BOMB_L3', cost: { alloy: 50000, crystal: 35000, deuterium: 3000 }, nominalMinutes: 60, colonyLoyaltyLoss: 15, colonyFaults: 2 },
  },
} as const;

/** Persist this same integer for both remaining work and the completion deadline. */
export function radiationBombBuildSeconds(level: RadiationBombLevel): number {
  return Math.ceil(RADIATION_BOMB.levels[level].nominalMinutes * ECONOMY_ADJUSTMENT.strategicBuildTime * 60);
}

export function radiationBombLevel(type: string): RadiationBombLevel | null {
  switch (type) {
    case 'RADIATION_BOMB_L1': return 1;
    case 'RADIATION_BOMB_L2': return 2;
    case 'RADIATION_BOMB_L3': return 3;
    default: return null;
  }
}
