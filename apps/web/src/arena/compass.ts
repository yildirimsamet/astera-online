import { surfaceGap, type ArenaWorld, type Vec3 } from '@astera/rules/arena';

/** Below this a deposit is as good as mined out: the compass looks past it. */
const WORTH = 6;

/**
 * The farmer's compass: the live deposit whose real surface (Y2) is nearest, within `reach`
 * metres. The bounding ball rules a deposit out cheaply before its surface is measured.
 */
export function nearestDeposit(world: Pick<ArenaWorld, 'layout' | 'minerals' | 'dry'>, p: Vec3, reach = 760):
  { index: number; distance: number; kind: number } | null {
  let found: { index: number; distance: number; kind: number } | null = null;
  let best = reach;
  for (const [slot, index] of world.layout.deposits.entries()) {
    const o = world.layout.obstacles[index];
    if (!o || world.dry[slot] || (world.minerals[slot] ?? 0) < WORTH) continue;
    if (Math.hypot(o.p.x - p.x, o.p.y - p.y, o.p.z - p.z) - o.radius >= best) continue;
    const distance = surfaceGap(world.layout, index, p, best);
    if (distance < best) { best = distance; found = { index, distance, kind: world.layout.depositKinds[slot] ?? 1 }; }
  }
  return found;
}
