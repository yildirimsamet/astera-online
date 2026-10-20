import type { ArenaLayout, ArenaObstacle, BoxObstacle, SphereObstacle, Vec3 } from '../../src/arena/index.js';

/** A layout with only the given colliders; crystal obstacles become crystal deposits. */
export function layoutWith(obstacles: readonly ArenaObstacle[] = [], radius = 3000, halfHeight = 3000,
  farmSpots: readonly Vec3[] = []): ArenaLayout {
  return {
    version: 0, radius, halfHeight, entries: [], exits: [], structures: [], fields: [], farmSpots,
    obstacles, deposits: obstacles.flatMap((o, i) => o.kind === 'crystal' ? [i] : []),
    depositKinds: obstacles.flatMap(o => o.kind === 'crystal' ? [1] : []),
  };
}

export const sphere = (id: number, x: number, y: number, z: number, radius: number,
  kind: SphereObstacle['kind'] = 'rock'): SphereObstacle => ({ id, kind, shape: 'sphere', p: { x, y, z }, radius });

export function box(id: number, x: number, y: number, z: number, hx: number, hy: number, hz: number,
  ux = 1, uz = 0): BoxObstacle {
  return { id, kind: 'structure', shape: 'box', p: { x, y, z }, hx, hy, hz, ux, uz,
    radius: Math.sqrt(hx * hx + hy * hy + hz * hz) };
}
