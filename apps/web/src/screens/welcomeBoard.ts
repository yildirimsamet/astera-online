import { WELCOME_WEEK, welcomeBox } from '@astera/rules';

export type WelcomeCellState = 'opened' | 'ready' | 'waiting' | 'later';

export interface WelcomeCell {
  box: number;
  state: WelcomeCellState;
  /** What it holds: the server's own figure for the next box, today's output for those ahead; none once opened. */
  holds: { alloy: number; crystal: number } | null;
  /** The next box only, while it waits. */
  readyInMs: number | null;
  /** The seventh, worth three of the others. */
  big: boolean;
}

interface WelcomeState {
  opened: number;
  box: number | null;
  readyAt: Date | null;
  preview: { alloy: number; crystal: number } | null;
}

/**
 * NEW COMMANDER 7 DAYS AS ONE BOARD (owner 2026-11-18). The server names the next box and what it holds;
 * the boxes ahead are that box's hourly worth times their own hours, so they grow as the capital does.
 */
export function welcomeBoard(state: WelcomeState | null | undefined, nowMs: number): WelcomeCell[] | null {
  if (!state) return null;
  const { box: next, preview, readyAt } = state;
  const nextHours = next === null ? 0 : WELCOME_WEEK.hours[next - 1] ?? 0;
  const perHour = preview && nextHours > 0 ? (preview.alloy + preview.crystal) / nextHours : 0;
  return WELCOME_WEEK.hours.map((hours, index) => {
    const box = index + 1;
    const big = hours > 1;
    if (next === null || box < next) return { box, state: 'opened', holds: null, readyInMs: null, big };
    if (box === next) {
      const wait = readyAt === null ? 0 : readyAt.getTime() - nowMs;
      return { box, state: wait > 0 ? 'waiting' : 'ready', holds: preview, readyInMs: wait > 0 ? wait : null, big };
    }
    return { box, state: 'later', holds: welcomeBox(box, { alloy: perHour, crystal: 0 }), readyInMs: null, big };
  });
}
