/**
 * ANOTHER COMMANDER'S JUMP, FAR OFF (owner 2026-11-18: no round glow anywhere).
 *
 * VFX brief. In the world: across the galaxy a colony ship lights its engines; it is a speck, so your
 * sensors lock a tracking frame on it, the brackets closing in from wide and holding on the contact
 * while it burns. Asset: `assets/vfx/library/track-frame.webp`, Synty Military Combat HUD
 * `reticle-bracket-medium-01` mirrored into a pair, with its `reticle-dot-small-01` as the contact.
 * Why: a frame locking on says "a ship is moving out there, and we see it", which a star never does.
 *
 * Sizes are a sprite's screen-fixed scale (`sizeAttenuation: false`); `shipOnScreen` is the hull's size
 * in the same units (its length over its distance), so the frame steps aside once the hull shows itself.
 */
export const TRACK_FRAME = 0.05;
export const TRACK_LOCK_SECONDS = 0.35;
/** How much wider than its rest the frame starts as it locks. */
const LOCK_SPREAD = 0.8;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function trackFrame({ burn, vanish, lockedFor, shipOnScreen }: {
  burn: number;
  vanish: number;
  lockedFor: number;
  shipOnScreen: number;
}): { visible: boolean; opacity: number; scale: number } {
  const lock = 1 - (1 - clamp01(lockedFor / TRACK_LOCK_SECONDS)) ** 3;
  const near = clamp01((shipOnScreen - 0.25 * TRACK_FRAME) / (0.75 * TRACK_FRAME));
  const opacity = 0.9 * clamp01(burn * 2) * (1 - clamp01(vanish)) * (1 - near);
  return { visible: burn > 0.01 && vanish < 1 && opacity > 0.01, opacity, scale: TRACK_FRAME * (1 + LOCK_SPREAD * (1 - lock)) };
}
