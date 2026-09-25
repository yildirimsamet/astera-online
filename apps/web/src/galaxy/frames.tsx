import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

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
export const frameStride = (refreshMs: number): number => strideFor(AMBIENT_FPS, refreshMs);

/**
 * The same arithmetic for any rate: every Nth display frame, never slower than
 * `fps`. `floor` for the reason above; capped at six for the reason above.
 */
export const strideFor = (fps: number, refreshMs: number): number => {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) return 1;
  return Math.min(6, Math.max(1, Math.floor(1000 / fps / refreshMs + STRIDE_TOLERANCE)));
};

/**
 * A MEASURED DISPLAY IS NEVER EXACTLY ITS NOMINAL RATE. The refresh estimate is a
 * smoothed rAF delta, and at 120Hz it settles at 8.35ms as readily as 8.33 — which
 * put `floor(16.67 / 8.35)` at ONE and drew a sixty-frame moment at a hundred and
 * twenty. Five hundredths of a stride absorbs the jitter; it can cost at most a
 * display a couple of percent off its nominal rate a frame or two a second.
 */
const STRIDE_TOLERANCE = 0.05;

/**
 * THE RATES A MOMENT MAY RAISE THE DISC TO. 2026-09-19.
 *
 * `FullRate` used to call `invalidate()` from inside every frame — the display's
 * own rate, so a 120Hz phone drew a bombardment, bloom and all, a hundred and
 * twenty times a second. A meteor did the same for the second it crossed the sky,
 * three slots at once, which measured to about a third of all the time the disc
 * is open (two thirds in a shower). The payoff moments now go through the one
 * ticker below, on vsync, and only raise the rate it strides at; a meteor raises
 * nothing and steps at `METEOR_FPS`.
 *
 * Sixty is the display rate a payoff moment was designed at. Thirty for a streak
 * is the owner's: a one-second meteor is a smooth line at thirty.
 */
export const FULL_RATE_FPS = 60;
/** Anything crossing the disc — a drill, a probe, a fleet. Owner, 2026-09-19. */
export const FLIGHT_FPS = 30;

/**
 * A METEOR MOVES ON EVERY FRAME THE DISC DRAWS, AND RAISES NOTHING.
 *
 * Owner, 2026-09-19: a meteor must not ask the disc for frames — so it stepped
 * twelve times a second. Owner, 2026-09-25: *"Laglı gibi kayıyorlar… fps'ini
 * arttır."* Twelve WAS the lag, and it bought nothing: stepping a streak costs
 * nothing, asking for frames is what cost. So it keeps up with whatever the disc
 * already draws, to sixty, and still asks for none of its own.
 */
export const METEOR_FPS = 60;

/**
 * How far to move a meteor this frame, and the clock it steps on.
 *
 * `phase` keeps the rhythm at `METEOR_FPS`, carrying what is left over past each
 * step, so a display drawing faster than that still steps at that rate. `since` is the time since the last step, all of which the step spends,
 * so the streak keeps its speed and only moves less often. A long frame is one
 * step, never several.
 */
export interface MeteorClock {
  readonly phase: number;
  readonly since: number;
}

export const METEOR_CLOCK: MeteorClock = { phase: 0, since: 0 };

export function meteorStep(clock: MeteorClock, delta: number): { advance: number; clock: MeteorClock } {
  const step = 1 / METEOR_FPS;
  const dt = Math.max(0, delta);
  const phase = clock.phase + dt;
  const since = clock.since + dt;
  if (phase < step) return { advance: 0, clock: { phase, since } };
  return { advance: since, clock: { phase: (phase - step) % step, since: 0 } };
}

/** Rates held for as long as something is mounted. */
const holds = new Map<symbol, number>();

/** Raise the disc to `fps` until the returned function is called. Idempotent to release. */
export function holdRate(fps: number): () => void {
  const key = Symbol('rate');
  holds.set(key, fps);
  return () => {
    holds.delete(key);
  };
}

/** The fastest rate anybody is asking for right now, and never under the floor. */
export const currentFps = (): number => wantedFps();

function wantedFps(): number {
  let fps = AMBIENT_FPS;
  for (const held of holds.values()) fps = Math.max(fps, held);
  return fps;
}

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

      // A rate raised since the last ask must not wait out the old stride.
      const stride = strideFor(wantedFps(), refreshMs);
      if (skip > 0 && skip < stride * creditFor(stride)) {
        skip -= 1;
        return;
      }
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
 * THE FULL RATE, FOR AS LONG AS THIS IS MOUNTED.
 *
 * For the moments the ambient floor is far too slow for. The one that matters is
 * the bombardment: a round crosses the gap between a squadron and the world it is
 * hitting in about eight tenths of a second, its blast ring opens in four tenths,
 * and its nozzle flickers at nearly seven hertz. At the ambient floor that is
 * twenty stepped positions, ten steps of a shock wave, and a flicker sampled three
 * and a half times a cycle — which does not read as a flicker, it reads as noise.
 *
 * Those ten seconds are the payoff of a decision made forty minutes ago and the
 * one visible reward the loop has. They are worth sixty frames a second, and
 * nothing else on the disc has to pay for it: this holds the rate only while it
 * is mounted, and `Bombardment` is mounted for exactly the engagement window.
 *
 * SIXTY, NOT THE DISPLAY'S RATE. It asked from inside every frame until
 * 2026-09-19, which on a 120Hz phone was twice the frames the moment was designed
 * at, bloom included. The ticker strides it onto vsync like every other rate.
 */
export function FullRate() {
  useEffect(() => holdRate(FULL_RATE_FPS), []);
  return null;
}

/** Hold `fps` for as long as `active` is true and this is mounted. */
export function HoldRate({ fps, active }: { fps: number; active: boolean }) {
  useEffect(() => (active ? holdRate(fps) : undefined), [active, fps]);
  return null;
}
