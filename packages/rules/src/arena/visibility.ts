import { segmentObstacles } from './collision.js';
import { ARENA_TUNING as T } from './tuning.js';
import type { Pilot, SmokePuff } from './pilot.js';
import type { ArenaDust, ArenaLayout, Vec3 } from './types.js';

/** True when any grown smoke puff blocks the straight line a→b. */
export function hiddenBySmoke(smoke: readonly SmokePuff[], a: Vec3, b: Vec3): boolean {
  const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z; const length = dx * dx + dy * dy + dz * dz;
  if (length === 0) return false;
  for (const puff of smoke) {
    if (!puff.active) continue;
    const projection = Math.max(0, Math.min(1, ((puff.p.x - a.x) * dx + (puff.p.y - a.y) * dy + (puff.p.z - a.z) * dz) / length));
    const x = a.x + dx * projection - puff.p.x; const y = a.y + dy * projection - puff.p.y; const z = a.z + dz * projection - puff.p.z;
    // Grows in, then thins from the edge while it disperses: the drawn cloud and the blocked sight agree.
    const radius = T.smokeRadius * Math.min(1, puff.age / T.smokeGrow, Math.max(0, (T.smokeLife - puff.age) / T.smokeFade));
    if (x * x + y * y + z * z < radius * radius) return true;
  }
  return false;
}

/** True when the line a→b runs more than `dustSight` metres through one dust cloud. */
export function hiddenByDust(layout: ArenaLayout, a: Vec3, b: Vec3): boolean {
  const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z; const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length === 0) return false;
  for (const cloud of layout.dust) {
    // The chord of the line through the sphere, clipped to the segment.
    const along = ((cloud.p.x - a.x) * dx + (cloud.p.y - a.y) * dy + (cloud.p.z - a.z) * dz) / length;
    const x = a.x + dx * along / length - cloud.p.x; const y = a.y + dy * along / length - cloud.p.y; const z = a.z + dz * along / length - cloud.p.z;
    const half = cloud.radius * cloud.radius - (x * x + y * y + z * z);
    if (half <= 0) continue;
    const reach = Math.sqrt(half);
    if (Math.min(length, along + reach) - Math.max(0, along - reach) > T.dustSight) return true;
  }
  return false;
}

/** The dust cloud a point is in, if any. */
export function dustAt(layout: ArenaLayout, p: Vec3): ArenaDust | undefined {
  return layout.dust.find(cloud => {
    const dx = p.x - cloud.p.x; const dy = p.y - cloud.p.y; const dz = p.z - cloud.p.z;
    return dx * dx + dy * dy + dz * dz < cloud.radius * cloud.radius;
  });
}

/** Not dead, not cloaked and not behind smoke or deep dust: the server sends only these. */
export function pilotVisible(world: { layout: ArenaLayout; smoke: readonly SmokePuff[] }, observer: Pilot, target: Pilot): boolean {
  return target.phase !== 'dead' && target.phase !== 'towed' && target.phase !== 'extracted'
    && target.cloak === 0 && !hiddenBySmoke(world.smoke, observer.p, target.p) && !hiddenByDust(world.layout, observer.p, target.p);
}

/**
 * Visible and not behind rock or a structure: what the marker, the lock, the map dot, the gun
 * gimbal and a bot's eyes need. The server still sends a pilot that is only behind stone.
 */
export function pilotInSight(world: { layout: ArenaLayout; smoke: readonly SmokePuff[] }, observer: Pilot, target: Pilot): boolean {
  const a = observer.p; const b = target.p;
  return pilotVisible(world, observer, target) && segmentObstacles(world.layout, a.x, a.y, a.z, b.x, b.y, b.z, 0) > 1;
}
