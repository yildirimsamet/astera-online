import type { AttentionSpec } from './queue.js';

/**
 * Every surface that opens by itself, and which goes first when several want the screen
 * (plan 2026-11-20 §5.5). The id is also the `surface` its measurement is written under.
 */
export const SURFACES = {
  arrival_card: { priority: 100, blocking: true },
  landing_rewards: { priority: 90, blocking: true },
  legacy_reveal: { priority: 60, blocking: true },
  brand_quiz: { priority: 50, blocking: true },
  landing_tip: { priority: 30, blocking: false },
  return_card: { priority: 20, blocking: false },
} as const satisfies Record<string, AttentionSpec>;
