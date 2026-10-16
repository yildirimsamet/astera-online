import { ABUSE, COMBAT } from './constants.js';

/** Stored on battle reports so later development does not rewrite the applied rules. */
export interface PvpBalance {
  readonly lootDecisive: number;
  readonly lootPartial: number;
  readonly lootBufferShare: number;
  readonly recoveryLossHours: number;
  readonly recoveryLookbackHours: number;
  readonly recoveryShieldHours: number;
}

export const STANDARD_PVP_BALANCE: PvpBalance = {
  lootDecisive: COMBAT.lootDecisive,
  lootPartial: COMBAT.lootPartial,
  lootBufferShare: COMBAT.lootBufferShare,
  recoveryLossHours: ABUSE.recoveryLossHours,
  recoveryLookbackHours: ABUSE.recoveryLookbackHours,
  recoveryShieldHours: ABUSE.recoveryShieldHours,
};

/** Owner, 2026-10-16: protect tier 1–3 commanders, including their colonies. */
export const LOW_TIER_PVP_BALANCE: PvpBalance = {
  lootDecisive: 0.25,
  lootPartial: 0.125,
  // Relative to the grade's storage share: 25% × 0.6 = 15% of Works.
  lootBufferShare: 0.6,
  recoveryLossHours: 2,
  recoveryLookbackHours: 8,
  recoveryShieldHours: 12,
};

/** Absent context means an NPC or legacy rule, never an assumed beginner. */
export const pvpBalanceForTier = (tier?: number | null): PvpBalance =>
  typeof tier === 'number' && Number.isInteger(tier) && tier >= 1 && tier <= 3
    ? LOW_TIER_PVP_BALANCE
    : STANDARD_PVP_BALANCE;
