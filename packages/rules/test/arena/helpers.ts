import { createMesh, type ArenaLayout, type ArenaMesh, type ArenaObstacle, type BoxObstacle, type SphereObstacle, type Vec3 } from '../../src/arena/index.js';

/** A layout with only the given colliders; crystal obstacles become crystal deposits. */
export function layoutWith(obstacles: readonly ArenaObstacle[] = [], radius = 3000, halfHeight = 3000,
  farmSpots: readonly Vec3[] = []): ArenaLayout {
  return {
    version: 0, radius, halfHeight, entries: [], exits: [], structures: [], fields: [], dust: [], farmSpots, meshes: [],
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

/** A lumpy closed sphere (outward winding) with a dent: convex and concave regions both. */
export function lumpyMesh(seed = 1, rings = 10, segments = 14): ArenaMesh {
  const positions: number[] = []; const indices: number[] = [];
  let state = seed;
  const random = (): number => { state = (state * 16807) % 2147483647; return state / 2147483647; };
  positions.push(0, 1, 0);
  for (let i = 1; i < rings; i++) {
    const phi = Math.PI * i / rings;
    for (let j = 0; j < segments; j++) {
      const theta = 2 * Math.PI * j / segments;
      let r = 0.75 + random() * 0.25;
      // A dent on the +X side: a bowl a ship can fly into.
      if (Math.cos(theta) * Math.sin(phi) > 0.8) r *= 0.55;
      positions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
  }
  positions.push(0, -1, 0);
  const bottom = 1 + (rings - 1) * segments;
  const at = (i: number, j: number): number => 1 + (i - 1) * segments + (j % segments);
  for (let j = 0; j < segments; j++) indices.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      indices.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  for (let j = 0; j < segments; j++) indices.push(bottom, at(rings - 1, j), at(rings - 1, j + 1));
  return createMesh(positions, indices);
}
