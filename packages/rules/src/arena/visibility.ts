import { ARENA_TUNING as T } from './tuning.js';
import type { Pilot, SmokePuff } from './pilot.js';
import type { Vec3 } from './types.js';

/** True when any grown smoke puff blocks the straight line a→b. */
export function hiddenBySmoke(smoke: readonly SmokePuff[], a: Vec3, b: Vec3): boolean {
  const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z; const length = dx * dx + dy * dy + dz * dz;
  if (length === 0) return false;
  for (const puff of smoke) {
    if (!puff.active) continue;
    const projection = Math.max(0, Math.min(1, ((puff.p.x - a.x) * dx + (puff.p.y - a.y) * dy + (puff.p.z - a.z) * dz) / length));
    const x = a.x + dx * projection - puff.p.x; const y = a.y + dy * projection - puff.p.y; const z = a.z + dz * projection - puff.p.z;
    const radius = T.smokeRadius * Math.min(1, puff.age / T.smokeGrow);
    if (x * x + y * y + z * z < radius * radius) return true;
  }
  return false;
}

export function pilotVisible(world: { smoke: readonly SmokePuff[] }, observer: Pilot, target: Pilot): boolean {
  return target.phase !== 'dead' && target.phase !== 'towed' && target.phase !== 'extracted'
    && target.cloak === 0 && !hiddenBySmoke(world.smoke, observer.p, target.p);
}
