/**
 * RESOLUTION GOVERNOR (owner 2026-10-20: smooth on every friend's phone). The arena
 * renders sharp, up to 2×. A device that cannot hold the frame rate steps its pixel
 * ratio down a quarter at a time until it can; one that keeps up is never touched.
 * Down only: climbing back would oscillate on a phone that sits at the edge.
 */
export interface Resolution { ratio: number; warmup: number; elapsed: number; frames: number }

const FLOOR = 1;
const STEP = 0.25;
const MIN_FPS = 48;
const WINDOW_S = 2;
/** Loading, shader compile and the warp-in hitch are not the device's steady pace. */
const WARMUP_S = 3;
/** A frame this long is a hitch or a backgrounded tab, not a slow GPU. */
const HITCH_S = 0.25;

export const createResolution = (ratio: number): Resolution => ({ ratio, warmup: WARMUP_S, elapsed: 0, frames: 0 });

/** Feeds one frame's dt; returns the new pixel ratio when it should change, else null. */
export function stepResolution(r: Resolution, dt: number): number | null {
  if (dt > HITCH_S) { r.elapsed = 0; r.frames = 0; return null; }
  if (r.warmup > 0) { r.warmup -= dt; return null; }
  r.elapsed += dt; r.frames++;
  if (r.elapsed < WINDOW_S) return null;
  const fps = r.frames / r.elapsed;
  r.elapsed = 0; r.frames = 0;
  if (fps >= MIN_FPS || r.ratio <= FLOOR) return null;
  r.ratio = Math.max(FLOOR, r.ratio - STEP);
  return r.ratio;
}
