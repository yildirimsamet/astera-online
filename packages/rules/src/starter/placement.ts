import type { PlanetSlot } from '../galaxy.js';
import { mulberry32 } from '../rng.js';
import { distance } from '../travel.js';
import type { Rng, Vec3 } from '../types.js';
import { STARTER } from './constants.js';

/** A thick disc rather than a ball, so that the galaxy reads as a place and not as a cloud. */
const FLATTENING = 0.7;
const MOST_ATTEMPTS = 200_000;

/** A uniform point in the flattened galaxy. */
export function starterPoint(random: Rng): Vec3 {
  const radius = STARTER.radius * Math.cbrt(random());
  const angle = random() * Math.PI * 2;
  const height = random() * 2 - 1;
  const flat = Math.sqrt(1 - height * height);
  return {
    x: radius * flat * Math.cos(angle),
    y: radius * height * FLATTENING,
    z: radius * flat * Math.sin(angle),
  };
}

/**
 * THIS GALAXY'S OWN BERTHS. `generateGalaxy` reads the main galaxy's constants, so it cannot be
 * asked. Darts, thrown until the galaxy is full: 300 berths use well under the room a 250-unit
 * spacing leaves, so this finishes long before the guard does.
 */
export function starterSlots(seed: number): PlanetSlot[] {
  const random = mulberry32(seed);
  const slots: PlanetSlot[] = [];
  for (let attempt = 0; attempt < MOST_ATTEMPTS && slots.length < STARTER.capacity; attempt++) {
    const point = starterPoint(random);
    if (slots.every(slot => distance(slot, point) >= STARTER.minSeparation)) slots.push({ index: slots.length, ...point });
  }
  if (slots.length < STARTER.capacity) throw new RangeError(`only ${String(slots.length)} berths fit`);
  return slots;
}

/**
 * THE OPPOSITE OF `pickSpawnSlot`. The main galaxy spreads newcomers out; here a newcomer needs a
 * neighbour to probe, so the free berth nearest any active ship is taken. The first ship of all
 * goes nearest the centre, where the next arrivals have room around it.
 */
export function pickVesselSlot(
  slots: readonly PlanetSlot[],
  occupied: ReadonlySet<number>,
  activeNeighbours: readonly Vec3[],
): PlanetSlot | null {
  const centre: readonly Vec3[] = [{ x: 0, y: 0, z: 0 }];
  const near = activeNeighbours.length > 0 ? activeNeighbours : centre;
  let best: PlanetSlot | null = null;
  let bestDistance = Infinity;
  for (const slot of slots) {
    if (occupied.has(slot.index)) continue;
    const nearest = Math.min(...near.map(point => distance(slot, point)));
    if (nearest < bestDistance) {
      best = slot;
      bestDistance = nearest;
    }
  }
  return best;
}
