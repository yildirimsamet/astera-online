/**
 * Touch feedback.
 *
 * The cheapest dopamine in mobile gaming and the one most often skipped on the
 * web: a purchase that only changes a number feels like filing a form, and the
 * same purchase with 12ms of vibration feels like it happened. Ignored silently on
 * desktop and on iOS Safari, which is fine — it is reinforcement, never the signal
 * itself.
 */
type Weight = 'tap' | 'commit' | 'warn';

const PATTERN: Record<Weight, number | number[]> = {
  tap: 10,
  commit: [14, 30, 22],
  warn: [30, 40, 30],
};

export function haptic(weight: Weight = 'tap'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERN[weight]);
  } catch {
    // Some browsers expose vibrate and then refuse it. Not worth a line of UI.
  }
}
