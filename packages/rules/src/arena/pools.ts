import { FIELD_GROUP_SIZE } from './farms.js';
import type { Impact, SmokePuff } from './pilot.js';
import { ARENA_TUNING as T } from './tuning.js';

/** Fixed pool sizes; the snapshot protocol bounds its rows by them. */
export const ARENA_POOLS = {
  bullets: 512, ghosts: 64, smoke: 96, impacts: 48, missiles: 32, cargo: T.fieldGroups * FIELD_GROUP_SIZE + T.wreckDrops,
} as const;

/** One tick of smoke and impact ageing: the room's and the client's, so the two never drift. */
export function ageEffects(world: { smoke: SmokePuff[]; impacts: Impact[] }): void {
  for (const puff of world.smoke) { if (puff.active) { puff.age += 1 / T.tickRate; if (puff.age >= T.smokeLife) puff.active = false; } }
  for (const hit of world.impacts) {
    if (hit.active) { hit.age += 1 / T.tickRate; if (hit.age >= (hit.kind === 'explosion' ? 1.35 : 0.35)) hit.active = false; }
  }
}
