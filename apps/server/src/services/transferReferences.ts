import type { eventKind, eventStatus } from '../db/schema.js';

type EventKind = typeof eventKind.enumValues[number];
type EventStatus = typeof eventStatus.enumValues[number];
type Policy = 'PERSONAL' | 'BLOCKER' | 'GLOBAL' | 'NEUTRAL';
export type TransferEventDisposition = 'MOVE' | 'KEEP' | 'DEFER' | 'RECONCILE';

/** Every new persisted kind must decide its transfer semantics before compilation. */
export const TRANSFER_EVENT_POLICIES = {
  mission_arrival: 'BLOCKER',
  radar_warning: 'BLOCKER',
  asteroid_impact: 'BLOCKER',
  season_end: 'GLOBAL',
  season_rollover: 'GLOBAL',
  mining_arrival: 'BLOCKER',
  mining_return: 'BLOCKER',
  season_act: 'GLOBAL',
  neutral_reinforce: 'NEUTRAL',
  death_star_ready: 'PERSONAL',
  recovery_end: 'BLOCKER',
  occupation_end: 'BLOCKER',
  build_complete: 'PERSONAL',
  strategic_intercept: 'BLOCKER',
  strategic_intercept_impact: 'BLOCKER',
  research_complete: 'PERSONAL',
  galaxy_event_start: 'GLOBAL',
  galaxy_event_end: 'GLOBAL',
  pirate_arrival: 'BLOCKER',
  pirate_return: 'BLOCKER',
  trade_arrival: 'BLOCKER',
  trade_return: 'BLOCKER',
  convoy_arrival: 'BLOCKER',
  convoy_return: 'BLOCKER',
} as const satisfies Record<EventKind, Policy>;

/**
 * Only call after typed ref ownership is established. A policy never proves that
 * an arbitrary event belongs to a commander. In particular, GLOBAL stays put and
 * NEUTRAL needs an ownership guard; neither may become a personal completion.
 * The transfer transaction must reread and lock active personal events before
 * using this answer so a concurrent worker claim cannot make it stale.
 */
export function transferEventDisposition(
  kind: string,
  status: EventStatus,
  resolveAt: number,
  now: number,
): TransferEventDisposition {
  if (status === 'done') return 'KEEP';
  const policies: Readonly<Record<string, Policy | undefined>> = TRANSFER_EVENT_POLICIES;
  const policy = policies[kind];
  if (policy === 'GLOBAL') return 'KEEP';
  if (status !== 'pending') return 'DEFER';
  if (policy === 'PERSONAL') return resolveAt > now ? 'MOVE' : 'DEFER';
  if (policy === 'NEUTRAL') return 'RECONCILE';
  return 'DEFER';
}
