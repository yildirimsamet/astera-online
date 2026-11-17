/**
 * A SHIP LEAVING ON ITS JUMP (owner 2026-11-18: no round flash anywhere).
 *
 * VFX brief. In the world: the colony ship lights its jump drive; space ahead of it pulls the hull
 * forward into a thin line of light along its heading, and the line snaps out. Asset: a hard-cored
 * streak drawn by its own shader (no texture). Why: a jump is a stretch and a snap, not an explosion.
 *
 * `vanish` runs 0 → 1 over the ship's going; length and width are in hull lengths.
 */
export function warpStreak(vanish: number): { length: number; width: number; fade: number } {
  const v = Math.max(0, Math.min(1, vanish));
  return {
    length: 1 + 11 * v ** 1.6,
    width: 0.11 * (1 - v),
    fade: Math.sin(Math.PI * Math.min(1, v * 1.1)) * (v >= 1 ? 0 : 1),
  };
}
