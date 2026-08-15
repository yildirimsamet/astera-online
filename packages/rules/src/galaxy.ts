import { GALAXY } from './constants.js';
import { mulberry32 } from './rng.js';
import { distance } from './travel.js';
import type { Vec3 } from './types.js';

export interface PlanetSlot extends Vec3 {
  index: number;
}

export interface AsteroidSpec {
  index: number;
  /** Orbital radius in galaxy units. */
  radius: number;
  /** Orbital period in minutes. */
  period: number;
  /** Starting angle in radians. */
  phase: number;
  /** Height above the disc plane — constant for the orbit. */
  y: number;
  mass: number;
}

export interface GalaxySpec {
  seed: number;
  slots: PlanetSlot[];
  asteroids: AsteroidSpec[];
}

/**
 * Deterministic galaxy generation. The same seed produces the same galaxy on the
 * server, in the simulator and on the client — so the client regenerates the
 * static layout locally instead of downloading it.
 *
 * Designed skeleton (thin disc), randomised placement (Poisson-disc rejection).
 */
export function generateGalaxy(
  seed: number,
  slotCount: number = GALAXY.defaultSlots,
): GalaxySpec {
  const rng = mulberry32(seed);
  const slots: PlanetSlot[] = [];

  for (let i = 0; i < slotCount; i++) {
    let best: Vec3 | null = null;
    let bestNearest = -1;

    // Try a few candidates and keep the one furthest from everything placed so
    // far. Cheaper and more even than strict rejection sampling, and it never
    // fails to place a slot as the disc fills up.
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = Math.sqrt(rng()) * GALAXY.radius;
      const th = rng() * Math.PI * 2;
      const candidate: Vec3 = {
        x: r * Math.cos(th),
        y: (rng() * 2 - 1) * GALAXY.thickness,
        z: r * Math.sin(th),
      };

      let nearest = Infinity;
      for (const s of slots) nearest = Math.min(nearest, distance(candidate, s));
      if (slots.length === 0) nearest = Infinity;

      if (nearest > bestNearest) {
        bestNearest = nearest;
        best = candidate;
      }
      if (nearest >= GALAXY.minSeparation) break;
    }

    const p = best ?? { x: 0, y: 0, z: 0 };
    slots.push({ index: i, x: p.x, y: p.y, z: p.z });
  }

  const count =
    GALAXY.asteroidMin +
    Math.floor(rng() * (GALAXY.asteroidMax - GALAXY.asteroidMin + 1));
  const asteroids: AsteroidSpec[] = [];
  for (let i = 0; i < count; i++) {
    asteroids.push({
      index: i,
      radius: 180 + rng() * (GALAXY.radius - 220),
      period:
        GALAXY.asteroidPeriodMin +
        rng() * (GALAXY.asteroidPeriodMax - GALAXY.asteroidPeriodMin),
      phase: rng() * Math.PI * 2,
      y: (rng() * 2 - 1) * GALAXY.thickness * 0.5,
      mass:
        GALAXY.asteroidMassMin + rng() * (GALAXY.asteroidMassMax - GALAXY.asteroidMassMin),
    });
  }

  return { seed, slots, asteroids };
}

/**
 * Asteroid position is a pure function of the clock — never stored, never
 * simulated. This is what makes a living galaxy cost zero server work and zero
 * realtime bandwidth.
 */
export function asteroidPosition(a: AsteroidSpec, minutes: number): Vec3 {
  const theta = a.phase + (2 * Math.PI * minutes) / a.period;
  return {
    x: a.radius * Math.cos(theta),
    y: a.y,
    z: a.radius * Math.sin(theta),
  };
}

export const asteroidImpactDamage = (a: AsteroidSpec): number =>
  Math.round(a.mass * GALAXY.asteroidDamagePerMass);

/**
 * A joining player takes the free slot furthest from everyone already placed, so
 * the galaxy fills outward evenly rather than clustering by join order.
 */
export function pickSpawnSlot(
  slots: readonly PlanetSlot[],
  occupied: ReadonlySet<number>,
): PlanetSlot | null {
  let best: PlanetSlot | null = null;
  let bestScore = -1;

  for (const slot of slots) {
    if (occupied.has(slot.index)) continue;
    if (occupied.size === 0) return slot;

    let nearest = Infinity;
    for (const other of slots) {
      if (!occupied.has(other.index)) continue;
      nearest = Math.min(nearest, distance(slot, other));
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best = slot;
    }
  }
  return best;
}

/** Slots within `minutes` of `from`, at a given fleet speed. Someone's practical world. */
export function neighboursWithin(
  from: PlanetSlot,
  slots: readonly PlanetSlot[],
  maxDistance: number,
): PlanetSlot[] {
  return slots
    .filter((s) => s.index !== from.index && distance(from, s) <= maxDistance)
    .sort((a, b) => distance(from, a) - distance(from, b));
}
