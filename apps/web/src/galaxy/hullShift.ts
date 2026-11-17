import type { VesselLook } from '@astera/rules';

/**
 * THE HULL'S NEW LOOK, AS A MOMENT (owner 2026-11-18: "gemi birden parlamış cillop gibi olmuş bile").
 * A wave runs along the hull from the tail past the nose; behind it the new hull, ahead of it the old.
 * Model units, the nose along +X and the hull one unit long, so the wave starts and ends just off it.
 */
export const HULL_SHIFT_SECONDS = 1.4;
const FROM = -0.56;
const TO = 0.56;

/** Where along the hull the wave is, `elapsed` seconds in: slow out of the tail, slow into the nose. */
export function hullSweepAt(elapsed: number, seconds: number): number {
  const t = Math.max(0, Math.min(1, elapsed / seconds));
  return FROM + (TO - FROM) * t * t * (3 - 2 * t);
}

/** The look the next repairs lead to: loaded ahead, so the change never waits for a download. */
export function nextLook(look: VesselLook): VesselLook | null {
  if (look === 'WRECKED') return 'PATCHED';
  return look === 'PATCHED' ? 'RENEWED' : null;
}
