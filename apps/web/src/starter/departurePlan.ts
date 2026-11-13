import { STARTER } from '@astera/rules';

const DAY_MS = 86_400_000;

export type JumpOutlook =
  | { kind: 'noFrontier' }
  | { kind: 'seasonClosed'; daysLeft: number };

/**
 * WHAT THE JUMP WILL MEET, SAID BEFORE THE PRESS (plan F7, moment 16). The server refuses the same
 * things at the press (`departureBlock`); this reads them from the target the panel already has.
 */
export function jumpOutlook(target: { seasonEndsAt: Date } | null, nowMs: number): JumpOutlook | null {
  if (!target) return { kind: 'noFrontier' };
  const endsAt = target.seasonEndsAt.getTime();
  const closesAt = endsAt - STARTER.migrationCutoffDays * DAY_MS;
  if (nowMs >= closesAt) return { kind: 'seasonClosed', daysLeft: Math.ceil((endsAt - nowMs) / DAY_MS) };
  return null;
}
