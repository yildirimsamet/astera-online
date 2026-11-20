import type { AsteroidSpec, OrbitElements } from './galaxy.js';
import { mulberry32 } from './rng.js';
import type { Vec3 } from './types.js';

/**
 * KİŞİSEL KAYALAR (plan 2026-11-20 §5.2, Faz 3). A first game's landing puts two rocks beside the capital
 * that only its commander sees and mines: the first thing to send the Prospector at, in the minute after
 * the landing. They are ordinary rocks in every other respect: they ride a closed orbit, the Prospector
 * intercepts them with the shared solver, and the ore is claimed with the shared rule.
 */
export const PERSONAL_ROCKS = {
  /** Distances from the capital's centre, game units: a Prospector flight of well under a minute. */
  distances: [300, 420],
  /** Bearings from the line toward the galaxy's centre, radians: one ahead, one behind. */
  bearings: [0.75, -1.15],
  oreMin: 800,
  oreMax: 1200,
  /** The starter galaxy's rock: a third crystal, no deuterium. */
  crystalShare: 0.35,
  lifeMinutes: 6 * 60,
  /** Game units per minute: the rocks drift beside the world rather than cross the disc. */
  speed: 3,
} as const;

/**
 * THE CLOSED ORBIT THROUGH ONE POINT AT ONE MINUTE. Its plane holds the point and the horizontal
 * direction square to it, so the rock drifts sideways, not up or down. At `minutes` it is at `point`.
 */
export function orbitThrough(point: Vec3, minutes: number, speed: number): OrbitElements {
  const radius = Math.hypot(point.x, point.y, point.z);
  if (!(radius > 0) || !(speed > 0)) throw new RangeError('an orbit needs a point off the centre and a speed');
  const u = { x: point.x / radius, y: point.y / radius, z: point.z / radius };
  const period = (2 * Math.PI * radius) / speed;
  return {
    radius,
    period,
    // At angle π/2 the orbit stands on its second basis vector, which is the point's own direction.
    phase: Math.PI / 2 - (2 * Math.PI * minutes) / period,
    inclination: Math.asin(Math.max(-1, Math.min(1, u.y))),
    ascendingNode: Math.atan2(-u.x, u.z),
    speed,
  };
}

/**
 * THE TWO ROCKS OF ONE LANDING, without their index (the server numbers them). `seed` fixes the ore; the
 * capital's position and the minute of the landing fix where they are.
 */
export function personalRockSpecs(capital: Vec3, landedMinutes: number, seed: number): Omit<AsteroidSpec, 'index'>[] {
  const rng = mulberry32(seed);
  const toCentre = Math.atan2(-capital.z, -capital.x);
  return PERSONAL_ROCKS.distances.map((reach, i) => {
    const bearing = toCentre + PERSONAL_ROCKS.bearings[i]!;
    const at = { x: capital.x + reach * Math.cos(bearing), y: capital.y, z: capital.z + reach * Math.sin(bearing) };
    const ore = Math.round(PERSONAL_ROCKS.oreMin + rng() * (PERSONAL_ROCKS.oreMax - PERSONAL_ROCKS.oreMin));
    return {
      ...orbitThrough(at, landedMinutes, PERSONAL_ROCKS.speed),
      level: 1,
      ore,
      crystalShare: PERSONAL_ROCKS.crystalShare,
      deuteriumShare: 0,
      isotopeRich: false,
      appearsAt: landedMinutes,
      expiresAt: landedMinutes + PERSONAL_ROCKS.lifeMinutes,
    };
  });
}
