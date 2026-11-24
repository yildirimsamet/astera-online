import { DAILY_QUESTS } from '@astera/rules';
import type { DailyQuests } from '../api/schemas.js';
import type { RewardGate } from './rewardGates.js';

/**
 * WHERE EACH DAILY QUEST IS DONE (owner, 2026-11-24): the same places the reward goals send a player —
 * the map for a probe, the pirates, the rocks — and the commander ship for the Yarık. A quest this build
 * has never heard of has no place, and the panel simply offers no way there.
 */
const GATES: Readonly<Record<string, RewardGate>> = {
  PROBES: { kind: 'probe' },
  RIFT: { kind: 'hangar' },
  PIRATE: { kind: 'pirate' },
  ASTEROID: { kind: 'mine' },
};

export const dailyQuestGate = (id: string): RewardGate | null => GATES[id] ?? null;

/**
 * WHAT THE DAILY KEY ON THE GALAXY SAYS (owner, 2026-11-24). It stands while any quest of today is not yet
 * taken, counts the finished ones that wait (its red count), and is gone once the last purse is in. Only the
 * quests this build knows count, so one it has never heard of can neither keep the key up nor pad its total.
 * `null` is "no key": no panel from the server, or nothing left today.
 */
export function dailyQuestsKey(view: DailyQuests | undefined): { claimable: number; taken: number; total: number } | null {
  if (!view) return null;
  const known = view.quests.filter((quest) => DAILY_QUESTS.some((row) => row.id === quest.id));
  const taken = known.filter((quest) => quest.state === 'claimed').length;
  if (known.length === 0 || taken === known.length) return null;
  return { claimable: known.filter((quest) => quest.state === 'claimable').length, taken, total: known.length };
}

/**
 * WHEN TO READ THE LIST AGAIN: just past the reset, so the next day's quests are on the screen when it starts
 * without a reload. A reset already behind it (a late answer, a slow clock) is retried in five seconds, never at
 * once; with nothing read there is no timer.
 */
export const dailyRefetchDelay = (resetsAt: Date | undefined, now: number): number | false =>
  resetsAt === undefined ? false : Math.max(5_000, resetsAt.getTime() - now + 2_000);
