import { WELCOME_WEEK, welcomeBox, type CosmeticId } from '@astera/rules';

export type WelcomeCellState = 'opened' | 'ready' | 'waiting' | 'later';

export interface WelcomeHolds {
  alloy: number;
  crystal: number;
  deuterium: number;
  cosmeticId?: CosmeticId;
}

export interface WelcomeCell {
  box: number;
  state: WelcomeCellState;
  /** Fixed escalating reward held by this box; null once opened. */
  holds: WelcomeHolds | null;
  /** Cosmetic skin granted by this box (day 3 `ring-helios`, day 7 `engine-titan`). */
  cosmeticId?: CosmeticId;
  /** The next box only, while it waits. */
  readyInMs: number | null;
  /** The seventh, the grand finale box. */
  big: boolean;
}

interface WelcomeState {
  opened: number;
  box: number | null;
  readyAt: Date | null;
  preview: { alloy: number; crystal: number; deuterium?: number; cosmeticId?: string } | null;
}

/**
 * NEW COMMANDER 7 DAYS AS ONE BOARD (owner 2026-11-18; updated 2026-11-23).
 * Each box 1–7 holds a fixed escalating resource cache (plus deuterium on days 4–7,
 * `ring-helios` on day 3, and `engine-titan` on day 7).
 */
export function welcomeBoard(state: WelcomeState | null | undefined, nowMs: number): WelcomeCell[] | null {
  if (!state) return null;
  const { box: next, preview, readyAt } = state;
  return WELCOME_WEEK.rewards.map((_, index) => {
    const box = index + 1;
    const big = box === WELCOME_WEEK.boxes;
    const fixed = welcomeBox(box);
    const cosmeticProp = fixed.cosmeticId ? { cosmeticId: fixed.cosmeticId } : {};
    if (next === null || box < next) {
      return { box, state: 'opened', holds: null, ...cosmeticProp, readyInMs: null, big };
    }
    if (box === next) {
      const wait = readyAt === null ? 0 : readyAt.getTime() - nowMs;
      const holds: WelcomeHolds = preview
        ? {
            alloy: preview.alloy,
            crystal: preview.crystal,
            deuterium: preview.deuterium ?? fixed.deuterium,
            ...(fixed.cosmeticId ? { cosmeticId: fixed.cosmeticId } : {}),
          }
        : fixed;
      return {
        box,
        state: wait > 0 ? 'waiting' : 'ready',
        holds,
        ...cosmeticProp,
        readyInMs: wait > 0 ? wait : null,
        big,
      };
    }
    return { box, state: 'later', holds: fixed, ...cosmeticProp, readyInMs: null, big };
  });
}
