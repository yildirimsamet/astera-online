import { GALAXY, asteroidPosition, generateGalaxy, type AsteroidSpec } from '@blindspace/rules';
import type { GalaxyPlanet } from '../api/schemas.js';

/**
 * The galaxy, as the 3D surface needs it.
 *
 * WORLD UNITS. The design's coordinates run to radius 1000 with a ±120 disc
 * thickness. Three.js is happiest with a camera near the single-digit range, so
 * everything is divided by `SCALE` on the way in and nothing downstream ever
 * thinks about game units again.
 *
 * Nothing here fetches. `generateGalaxy` and `asteroidPosition` are pure functions
 * in the rules package, so the client rebuilds the static layout and every
 * asteroid orbit from the season seed rather than downloading them — which is
 * exactly what A5 meant and why the seed is now on `/api/season`.
 */

export const SCALE = 100;

export const DISC_RADIUS = GALAXY.radius / SCALE;
export const DISC_THICKNESS = GALAXY.thickness / SCALE;

export type Vec3Tuple = [number, number, number];

export const toWorld = (p: { x: number; y: number; z: number }): Vec3Tuple => [
  p.x / SCALE,
  p.y / SCALE,
  p.z / SCALE,
];

/**
 * What the player is allowed to know about a planet, as one word.
 *
 * The fog becomes the art: an unwatched world is a dark sphere, a watched one is
 * lit, and one whose fleet is away is the only thing on screen wearing the
 * opportunity colour. This is the telescope reading, rendered spatially.
 */
export type Stance = 'self' | 'window' | 'watched' | 'veiled' | 'dark';

export function stanceOf(planet: GalaxyPlanet): Stance {
  if (planet.isSelf) return 'self';
  if (!planet.fleet) return 'dark';
  if (planet.fleet.status === 'AWAY') return 'window';
  if (planet.fleet.status === 'UNKNOWN') return 'veiled';
  return 'watched';
}

export interface PlanetNode {
  id: string;
  name: string;
  owner: string;
  position: Vec3Tuple;
  /** Bigger worlds for more developed players — the only free public signal. */
  radius: number;
  stance: Stance;
}

export function planetNodes(planets: readonly GalaxyPlanet[]): PlanetNode[] {
  return planets.map((planet) => ({
    id: planet.id,
    name: planet.name,
    owner: planet.owner,
    position: toWorld(planet.position),
    // Map markers, not scale models. A planet at true scale in a disc 2000 units
    // across would be invisible, so these are sized to be READ — with core tier
    // driving the size, so one glance at the disc tells you who has been building.
    radius: 0.62 + Math.min(4, planet.coreTier) * 0.12,
    stance: stanceOf(planet),
  }));
}

/* ── asteroids ──────────────────────────────────────────────── */

const cache = new Map<number, AsteroidSpec[]>();

/** Regenerated locally from the seed, never downloaded. */
export function asteroidsOf(seed: number, slots = GALAXY.defaultSlots): AsteroidSpec[] {
  let found = cache.get(seed);
  if (!found) {
    found = generateGalaxy(seed, slots).asteroids;
    cache.set(seed, found);
  }
  return found;
}

/**
 * Where every asteroid is at this instant.
 *
 * A pure function of the clock — the server stores no positions and streams
 * nothing. This is the cheapest life the scene can have: a dozen bodies moving on
 * exact orbits for zero bytes and zero server work.
 */
export function asteroidPositions(
  asteroids: readonly AsteroidSpec[],
  seasonStart: Date,
  now: number,
): Vec3Tuple[] {
  const minutes = (now - seasonStart.getTime()) / 60_000;
  return asteroids.map((a) => toWorld(asteroidPosition(a, minutes)));
}

/* ── colour, by what you know ───────────────────────────────── */

export const STANCE_COLOUR: Record<Stance, string> = {
  self: '#8fd6ea',
  window: '#5ad39b',
  watched: '#aecbe6',
  veiled: '#7c8ca3',
  dark: '#39404f',
};

/** How brightly a world is rendered. Ignorance is literally dark. */
export const STANCE_LIGHT: Record<Stance, number> = {
  self: 1,
  window: 1,
  watched: 0.92,
  veiled: 0.62,
  dark: 0.42,
};
