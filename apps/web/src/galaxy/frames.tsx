import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * WHO ASKS FOR FRAMES, AND HOW OFTEN. D53.
 *
 * The galaxy renders ON DEMAND: nothing is drawn unless something asks for it, so
 * a still disc costs nothing and a phone keeps its battery. That policy is right
 * and it is not what changed here. What changed is the ASKING, which was a
 * `setInterval` at 24fps and was wrong twice over.
 *
 * IT WAS NOT ALIGNED TO THE DISPLAY. 41.67ms against a 16.67ms refresh does not
 * divide: the requests land at 50ms, 33ms, 50ms, 33ms, and every moving thing on
 * the disc inherits that beat. The scene was not running at twenty-four frames a
 * second, it was running at an irregular twenty-four — which is the one artefact
 * that undoes every other bit of care in this directory, because it is visible on
 * everything at once.
 *
 * AND THE BROWSER THROTTLES IT. `tools/engagement.mjs` carries the evidence in its
 * own docblock: under a screenshot loop Chromium considered the page backgrounded,
 * throttled the interval, and the scene rendered about once in ten seconds — a
 * bombardment photographed as a frozen one. Three Chromium flags exist in that
 * harness to work around it. A real phone with a partly occluded tab, in low power
 * mode, or Safari on iOS does the same thing to the same mechanism.
 *
 * `requestAnimationFrame` fixes both: it is issued by the compositor on the
 * display's own cadence, and it stops cleanly when there is nothing to draw
 * instead of degrading to a slideshow.
 */

/**
 * The slowest the ambient scene is allowed to run, in frames a second.
 *
 * A FLOOR, NOT A TARGET — which is the whole reason this is expressed as an
 * interval and then snapped. Twenty-four was chosen when rocks tumbled and dust
 * drifted and nothing else moved on its own, and it is still the right floor for
 * that. It is not a rate a display can actually deliver: at 60Hz the honest
 * choices either side of it are 20 and 30, and 20 is below the floor.
 */
export const AMBIENT_FPS = 24;

const AMBIENT_MS = 1000 / AMBIENT_FPS;

/**
 * HOW MANY DISPLAY FRAMES TO SKIP BETWEEN TWO AMBIENT ONES.
 *
 * The fix for the beat is to stop asking for a rate the display cannot produce and
 * start asking for every Nth frame it CAN. Then every request lands on a vsync
 * boundary and the interval between two of them is constant, which is the property
 * that was missing.
 *
 * `floor`, DELIBERATELY, so the result is never slower than the floor:
 *
 *   ·  60Hz → floor(41.67 / 16.67) = 2 → every 2nd frame → 30fps
 *   ·  90Hz → floor(41.67 / 11.11) = 3 → every 3rd frame → 30fps
 *   · 120Hz → floor(41.67 /  8.33) = 5 → every 5th frame → 24fps
 *   · 144Hz → floor(41.67 /  6.94) = 6 → every 6th frame → 24fps
 *
 * `Math.round` was the obvious choice and is the wrong one — it rounds a half AWAY
 * from zero, so it can only ever land under the floor. Measured: at 90Hz it
 * returns 4, which is 22.5fps against a floor of 24. At 60Hz it happens to survive
 * on a floating-point accident (41.666…/16.666… is 2.4999… rather than 2.5), which
 * is the worst way for a bug like this to behave: correct on the display everybody
 * develops against and wrong on the phones.
 *
 * Capped at six so a pathological measurement (a tab that was hidden, a frame the
 * garbage collector ate) cannot park the scene.
 */
export const frameStride = (refreshMs: number): number => {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) return 1;
  return Math.min(6, Math.max(1, Math.floor(AMBIENT_MS / refreshMs)));
};

/**
 * Smoothing on the measured refresh interval.
 *
 * The display's cadence is a hardware constant, so this is measuring a fixed
 * number through a noisy channel and wants to be slow. A single long frame must
 * not be allowed to halve the ambient rate for the frames after it.
 */
const REFRESH_SMOOTHING = 0.1;

/**
 * Anything longer than this is not a refresh interval — it is a stall, a hidden
 * tab waking up, or a garbage collection. Measuring it would be measuring the
 * wrong thing.
 */
const MAX_PLAUSIBLE_FRAME_MS = 100;

/**
 * HOW MANY FRAMES TO BUY AT A TIME, AND WHY IT IS NOT ALWAYS ONE.
 *
 * R3F unwinds its render loop the instant its pending-frame count reaches zero,
 * and restarting it costs a fresh `requestAnimationFrame` — one display frame. So
 * buying a single frame at a time can never render more often than every OTHER
 * frame, whatever the stride says.
 *
 * At a stride of two or more that is invisible: the latency is constant, so it
 * shifts the whole cadence by a frame and changes no interval. At a stride of ONE
 * it is the entire answer, and a stride of one is what a display at or below the
 * ambient floor gets — which is exactly the case where throttling further is most
 * wrong. A phone already struggling to hold 24fps would have been quietly halved
 * to twelve, and the worse the device the harder it would have been punished.
 *
 * So at a stride of one the ticker buys TWO frames every two frames. The loop
 * always has one left over after rendering, stays chained, and the count never
 * accumulates. Measured against a headless renderer managing 14fps: 0.59 of the
 * display's frames before, 1.0 after.
 */
const creditFor = (stride: number): number => (stride === 1 ? 2 : 1);

/**
 * Ask for the ambient frames: the ones nothing in particular is waiting for.
 *
 * Rocks tumbling, dust turning, a watch beam breathing. Everything with a moment
 * of its own — a bombardment, a meteor, the camera easing onto a subject — asks
 * for its own frames through `FullRate` or through `state.invalidate()`, and gets
 * the display's real rate for exactly as long as it is happening.
 */
export function useAmbientFrames(): void {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let handle = 0;
    let previous = 0;
    /** Assumed until measured. Wrong for one frame on a 120Hz phone, and harmless. */
    let refreshMs = 1000 / 60;
    /** Display frames still to skip before the next ask. */
    let skip = 0;

    const tick = (at: number): void => {
      handle = requestAnimationFrame(tick);

      if (previous !== 0) {
        const delta = at - previous;
        if (delta > 0 && delta < MAX_PLAUSIBLE_FRAME_MS) {
          refreshMs += (delta - refreshMs) * REFRESH_SMOOTHING;
        }
      }
      previous = at;

      if (skip > 0) {
        skip -= 1;
        return;
      }

      const stride = frameStride(refreshMs);
      const credit = creditFor(stride);
      // Frames bought, times frames each one is meant to last: the interval that
      // spends exactly what was bought and nothing more.
      skip = credit * stride - 1;
      invalidate(credit);
    };

    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [invalidate]);
}

/**
 * Draw once after a DOM-backed scene element has committed.
 *
 * Drei's `<Html distanceFactor>` learns its screen scale in a render frame. In a
 * demand canvas, an HTML label that appears because fresh server state arrived
 * can commit after the camera's last frame and keep its unprojected first size
 * until the player touches the controls. Keying this hook to the mounted labels
 * buys exactly the missing post-commit frame and nothing while they stay put.
 */
export function useCommittedDemandFrame(identity: string): void {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [identity, invalidate]);
}

/**
 * EVERY FRAME THE DISPLAY WILL GIVE, FOR AS LONG AS THIS IS MOUNTED.
 *
 * For the moments the ambient floor is far too slow for. The one that matters is
 * the bombardment: a round crosses the gap between a squadron and the world it is
 * hitting in about eight tenths of a second, its blast ring opens in four tenths,
 * and its nozzle flickers at nearly seven hertz. At the ambient floor that is
 * twenty stepped positions, ten steps of a shock wave, and a flicker sampled three
 * and a half times a cycle — which does not read as a flicker, it reads as noise.
 *
 * Those ten seconds are the payoff of a decision made forty minutes ago and the
 * one visible reward the loop has. They are worth the display's real rate, and
 * nothing else on the disc has to pay for it: this asks only while it is mounted,
 * and `Bombardment` is mounted for exactly the engagement window.
 *
 * WHY A COMPONENT AND NOT A CALL IN EVERY `useFrame`. R3F is explicit about
 * `invalidate()` from inside a frame — it sets the pending count to two rather
 * than incrementing it — so forty rounds each asking would in fact be safe. One
 * mount says the intent once and cannot drift from it.
 */
export function FullRate() {
  useFrame((state) => {
    state.invalidate();
  });
  return null;
}
