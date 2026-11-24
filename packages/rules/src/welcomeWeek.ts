import type { CosmeticId } from './cosmeticCatalog.js';
import type { Resources } from './types.js';

/**
 * NEW COMMANDER 7 DAYS (plan 2026-11-06 §7.2, Y3; updated 2026-11-23).
 *
 * Once an account, from the landing on (never in the starter galaxy). No streak: boxes are counted,
 * not days, and a missed day loses nothing. One box a day at most: the next is ready `gapHours`
 * after the last was opened.
 *
 * Fixed escalating payouts so waiting to open boxes at higher mine levels never inflates the reward:
 *  - Boxes 1–7 grant strictly increasing alloy and crystal.
 *  - Boxes 4–7 (after day 3) also include escalating deuterium.
 *  - Box 3 grants the `ring-helios` planet ring cosmetic.
 *  - Box 7 (Big Box) grants the `engine-titan` engine trail cosmetic alongside the grand resource cache.
 */
export interface WelcomeBoxReward extends Resources {
  readonly cosmeticId?: CosmeticId;
}

const BOX_REWARDS: readonly [
  WelcomeBoxReward,
  WelcomeBoxReward,
  WelcomeBoxReward,
  WelcomeBoxReward,
  WelcomeBoxReward,
  WelcomeBoxReward,
  WelcomeBoxReward,
] = [
  { alloy: 250, crystal: 150, deuterium: 0 },
  { alloy: 400, crystal: 240, deuterium: 0 },
  { alloy: 600, crystal: 360, deuterium: 0, cosmeticId: 'ring-helios' },
  { alloy: 850, crystal: 500, deuterium: 100 },
  { alloy: 1150, crystal: 680, deuterium: 160 },
  { alloy: 1500, crystal: 900, deuterium: 240 },
  { alloy: 3000, crystal: 1800, deuterium: 500, cosmeticId: 'engine-titan' },
] as const;

export const WELCOME_WEEK = {
  boxes: 7,
  gapHours: 20,
  rewards: BOX_REWARDS,
} as const;

/** Which box opens next and from when (epoch ms); both null once all seven are open. */
export function welcomeNext(opened: number, lastOpenedAtMs: number | null): { box: number | null; readyAtMs: number | null } {
  if (opened >= WELCOME_WEEK.boxes) return { box: null, readyAtMs: null };
  const readyAtMs = lastOpenedAtMs === null ? 0 : lastOpenedAtMs + WELCOME_WEEK.gapHours * 3_600_000;
  return { box: opened + 1, readyAtMs };
}

/** Fixed escalating reward held by box `index` (1–7). */
export function welcomeBox(index: number): WelcomeBoxReward {
  const reward = WELCOME_WEEK.rewards[index - 1];
  if (reward === undefined) throw new Error(`No welcome box ${String(index)}`);
  return { ...reward };
}
