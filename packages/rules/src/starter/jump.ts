import { GALAXY } from '../constants.js';
import type { Vec3 } from '../types.js';

/**
 * THE JUMP'S ONE CLOCK, in seconds from the press (owner, 2026-11-09). The pilot's scene and every
 * watcher read the same seconds: two false catches of the drive, a held burn, slow-fast-slow across the
 * gap, a stop at the end of the way, and the ship gone.
 */
export const JUMP_FLIGHT = {
  ignite: 1.2,
  /** The drive holds from here. */
  lit: 4.2,
  depart: 4.2,
  arrive: 18,
  /** The ship gives itself up between these two. */
  vanish: 18.6,
  gone: 19.4,
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smoother = (u: number): number => u * u * u * (u * (u * 6 - 15) + 10);
/** A short rise and a slower fall: a flame that catches and dies back. */
const flicker = (s: number, at: number, peak: number): number => {
  if (s < at || s > at + 0.55) return 0;
  return s < at + 0.12 ? peak * ((s - at) / 0.12) : peak * (1 - (s - at - 0.12) / 0.43) ** 2;
};

/** The drive's flame, 0…1. */
export function jumpThrottle(s: number): number {
  const { ignite, lit, arrive } = JUMP_FLIGHT;
  if (s < ignite || s >= arrive) return 0;
  if (s >= lit) {
    // Eased off while the ship brakes for its stop.
    const brake = clamp01((s - (arrive - 3.5)) / 3.5);
    return brake <= 0 ? 1 : 1 - 0.85 * smoother(brake);
  }
  const caught = smoother(clamp01((s - (lit - 1.3)) / 1.3));
  return Math.max(flicker(s, ignite, 0.55), flicker(s, ignite + 0.85, 0.75), caught);
}

/** How far along its way the ship is: 0 at the berth, 1 at the stop. Slow, fast, slow. */
export function jumpTravel(s: number): number {
  const { depart, arrive } = JUMP_FLIGHT;
  return smoother(clamp01((s - depart) / (arrive - depart)));
}

export function jumpPosition(from: Vec3, to: Vec3, s: number): Vec3 {
  const k = jumpTravel(s);
  if (k <= 0) return { ...from };
  if (k >= 1) return { ...to };
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
}

/**
 * Where a watcher sees the ship stop: where its way to the main galaxy's centre crosses the rim. Its
 * world stays hidden until someone finds it (CLAUDE.md §1), so nobody else sees the ship reach it.
 * `from` is in the main galaxy's coordinates.
 */
export function watchedStop(from: Vec3): Vec3 {
  const out = Math.hypot(from.x, from.y, from.z);
  if (out <= GALAXY.radius) return { ...from };
  const k = GALAXY.radius / out;
  return { x: from.x * k, y: from.y * k, z: from.z * k };
}
