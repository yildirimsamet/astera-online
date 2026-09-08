import { GALAXY, MULTI_WORLD } from './constants.js';
import type { PlanetSlot } from './galaxy.js';
import { seededFrom } from './rng.js';
import { distance } from './travel.js';
import { colonyCapacity } from './strategic.js';

export const WAITING_PLACEMENT_VERSION = 1;

/**
 * WAITING-only address generation; no worlds or resources are created here.
 * Reserve all capital addresses and existing worlds before calling. Existing
 * worlds never move. A bounded failed search returns a partial pool: the caller
 * must require enough slots for the WHOLE commander or try another shard.
 * Keep this stream independent of MAIN geometry and public event schedules.
 */
export function waitingColonySlots(
  seed: number,
  obstacles: readonly PlanetSlot[],
  count: number,
): PlanetSlot[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > MULTI_WORLD.capitalSlots * colonyCapacity(Infinity)) {
    throw new RangeError('Invalid waiting colony address count');
  }
  const rng = seededFrom('waiting-placement', WAITING_PLACEMENT_VERSION, seed);
  const occupied = new Set(obstacles.map((slot) => slot.index));
  const slots: PlanetSlot[] = [];
  let index = MULTI_WORLD.neutralSlotPool;
  for (let attempt = 0; slots.length < count && attempt < count * 512; attempt++) {
    const radius = Math.cbrt(rng()) * GALAXY.radius;
    const angle = rng() * 2 * Math.PI;
    const vertical = rng() * 2 - 1;
    const planar = Math.sqrt(1 - vertical * vertical);
    const candidate = {
      x: radius * planar * Math.cos(angle),
      y: radius * vertical,
      z: radius * planar * Math.sin(angle),
    };
    if (obstacles.some((other) => distance(candidate, other) < GALAXY.minSeparation)
      || slots.some((other) => distance(candidate, other) < GALAXY.minSeparation)) continue;
    while (occupied.has(index)) index++;
    slots.push({ ...candidate, index });
    index++;
  }
  return slots;
}
