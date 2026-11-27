import { surfaceGap, type ArenaWorld, type CargoDrop, type Vec3 } from '@astera/rules/arena';

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

/** How near a storm stone must be before the arrow points at it (owner 2026-11-27: "250 mt veya 500 mt"; 500 chosen). */
export const ASTERIUM_REACH = 500;
const ASTERIUM = 3;

/**
 * THE ASTERYUM ARROW (owner 2026-11-27). The storm's stones are few and small in a large heart: the arrow is the
 * last stretch, not a map. It names the nearest live stone inside `reach` and nothing farther, so the pilot still
 * has to fly the middle to find one.
 */
export function nearestAsterium(drops: readonly CargoDrop[], p: Vec3, reach = ASTERIUM_REACH): { index: number; distance: number } | null {
  let found: { index: number; distance: number } | null = null;
  for (const [index, drop] of drops.entries()) {
    if (!drop.active || drop.kind !== ASTERIUM || drop.amount <= 0) continue;
    const distance = Math.hypot(drop.p.x - p.x, drop.p.y - p.y, drop.p.z - p.z);
    if (distance <= reach && (found === null || distance < found.distance)) found = { index, distance };
  }
  return found;
}

/** How near an exit must be before its marker shows (owner 2026-11-27: "bir çıkışa 2km kala gözükür"). */
export const EXIT_REACH = 2000;

/** While the Yarık is closing the way out shows from anywhere: five minutes to fly out need it (owner 2026-11-27). */
export const exitReach = (closing: boolean): number => (closing ? Infinity : EXIT_REACH);

/** The nearest exit within `reach`, or nothing: farther out the map and the radar show the way. */
export function nearestExit(exits: readonly Vec3[], p: Vec3, reach = EXIT_REACH): { exit: Vec3; distance: number } | null {
  let found: { exit: Vec3; distance: number } | null = null;
  for (const exit of exits) {
    const distance = Math.hypot(exit.x - p.x, exit.y - p.y, exit.z - p.z);
    if (distance <= reach && (found === null || distance < found.distance)) found = { exit, distance };
  }
  return found;
}
