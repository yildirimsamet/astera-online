import { orbitPosition, type OrbitElements } from '@astera/rules';
interface Point { x: number; y: number; z: number }

interface World { id: string; body?: 'VESSEL' | 'OUTPOST' | undefined; position: Point; isSelf?: boolean }

/** Outposts and wrecks are not ships, and neither is your own. */
const otherShip = (world: World, ownId: string): boolean => world.body === 'VESSEL' && world.isSelf !== true && world.id !== ownId;

/** Someone to probe, wherever the ship itself is. */
export const hasOtherShip = (worlds: readonly World[], ownId: string): boolean => worlds.some(world => otherShip(world, ownId));

/** The closest ship that is not yours: where the first probe is pointed. */
export function nearestShip(worlds: readonly World[], ownId: string, from: Point | undefined): string | null {
  if (!from) return null;
  let best: { id: string; d: number } | null = null;
  for (const world of worlds) {
    if (!otherShip(world, ownId)) continue;
    const d = (world.position.x - from.x) ** 2 + (world.position.y - from.y) ** 2 + (world.position.z - from.z) ** 2;
    if (!best || d < best.d) best = { id: world.id, d };
  }
  return best?.id ?? null;
}

/** The next flight goes to the nearest live rock as it moves now, not its birth position. */
export function nearestRock(rocks: readonly (OrbitElements & { id: string; active: boolean; oreRemaining: number })[], from: Point | undefined, minutes: number): string | null {
  if (!from) return null;
  let best: { id: string; distance: number } | null = null;
  for (const rock of rocks) {
    if (!rock.active || rock.oreRemaining <= 0) continue;
    const at = orbitPosition(rock, minutes);
    const distance = Math.hypot(at.x - from.x, at.y - from.y, at.z - from.z);
    if (!best || distance < best.distance) best = { id: rock.id, distance };
  }
  return best?.id ?? null;
}
