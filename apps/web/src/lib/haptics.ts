/**
 * Touch feedback.
 *
 * The cheapest dopamine in mobile gaming and the one most often skipped on the
 * web: a purchase that only changes a number feels like filing a form, and the
 * same purchase with 12ms of vibration feels like it happened. Ignored silently on
 * desktop and on iOS Safari, which is fine — it is reinforcement, never the signal
 * itself.
 */
export type Weight = 'tap' | 'commit' | 'warn' | 'thunk' | 'rumble' | 'warp';

const PATTERN: Record<Weight, number | number[]> = {
  tap: 10,
  commit: [14, 30, 22],
  warn: [30, 40, 30],
  /** A breaker landing home: one hard knock and the latch behind it. */
  thunk: [38, 28, 14],
  /** A furnace catching. */
  rumble: [18, 24, 26, 20, 34, 18, 48],
  /** Spooling up, then the drop out of the jump. */
  warp: [8, 30, 10, 26, 12, 20, 16, 14, 90],
};

export function haptic(weight: Weight = 'tap'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERN[weight]);
  } catch {
    // Some browsers expose vibrate and then refuse it. Not worth a line of UI.
  }
}
