/**
 * Telling a tap from a drag.
 *
 * The scene selected a world on POINTER DOWN, so every attempt to pan across the
 * galaxy opened whatever happened to be under the thumb when the gesture started —
 * usually an attack panel. On a touch screen, where the same surface is both the
 * map and the buttons, a press is not a click until it ends without having
 * travelled.
 *
 * A module rather than a React context on purpose: there is one pointer and one
 * window, and R3F runs its own reconciler root, so a provider outside the canvas
 * would not reach the scene inside it without a context bridge. This needs neither.
 */

/** A finger that moves further than this was panning, not choosing. */
const MOVE_TOLERANCE = 10;
/** A press held longer than this was a hesitation, or the start of something else. */
const HOLD_LIMIT_MS = 600;

let startedAt = 0;
let originX = 0;
let originY = 0;
let travelled = 0;
let installed = false;

/**
 * Did this gesture actually land on something?
 *
 * THE BUG THIS EXISTS FOR. Selecting a world sometimes opened the focus rail and
 * sometimes did not, at random, and tapping the same world again worked — the
 * camera always flew to it, so the selection was being MADE and then thrown away
 * within the same gesture.
 *
 * The culprit is the canvas's `onPointerMissed`, which clears the selection when a
 * tap hits empty space. R3F decides "missed" from its own click bookkeeping, and
 * an object that registers `onPointerUp` rather than `onClick` is not reliably
 * counted as hit — so the miss handler fired on the same pointerup that had just
 * selected something, and whichever of the two `setState` calls React flushed last
 * won. That is a coin toss, which is exactly what it looked like.
 *
 * A flag the pick handlers set themselves removes the ambiguity entirely: the
 * scene knows perfectly well whether anything was hit, so it says so, and the miss
 * handler believes it rather than R3F's inference.
 */
let hitSomething = false;

/** Idempotent: safe to call from every component that cares. */
export function installTapGuard(): () => void {
  if (installed) return () => undefined;
  installed = true;

  const down = (event: PointerEvent): void => {
    startedAt = performance.now();
    originX = event.clientX;
    originY = event.clientY;
    travelled = 0;
    // A fresh gesture has hit nothing yet.
    hitSomething = false;
  };

  // Peak distance, not final distance — a finger that swings out and comes back
  // was still a drag.
  const move = (event: PointerEvent): void => {
    travelled = Math.max(travelled, Math.hypot(event.clientX - originX, event.clientY - originY));
  };

  window.addEventListener('pointerdown', down, { passive: true });
  window.addEventListener('pointermove', move, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    installed = false;
  };
}

/** True only if the gesture that just ended was a genuine tap. */
export const wasTap = (): boolean =>
  travelled <= MOVE_TOLERANCE && performance.now() - startedAt <= HOLD_LIMIT_MS;

/** Called by every pick handler in the scene the moment it accepts a tap. */
export const markHit = (): void => {
  hitSomething = true;
};

/**
 * True when this gesture really did land on empty space.
 *
 * The only safe basis for clearing a selection. Never trust the canvas's miss
 * event on its own — see `hitSomething`.
 */
export const wasMiss = (): boolean => !hitSomething;
