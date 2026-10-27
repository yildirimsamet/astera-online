import type { ArenaLayout } from './types.js';

// 200 m: the 13 km Rift in ~1.4 MB of cells (100 m would take 11.5 MB on every peer).
const CELL = 200;

interface ObstacleGrid {
  minX: number; minY: number; minZ: number;
  cx: number; cy: number; cz: number;
  /** CSR: cell c holds items[start[c] .. start[c + 1]). */
  start: Int32Array; items: Int32Array;
  stamp: Uint32Array; epoch: number;
}

const grids = new WeakMap<ArenaLayout, ObstacleGrid>();

function build(layout: ArenaLayout): ObstacleGrid {
  const reachXZ = layout.radius + CELL;
  const reachY = layout.halfHeight + CELL;
  const cx = Math.ceil(2 * reachXZ / CELL); const cy = Math.ceil(2 * reachY / CELL); const cz = cx;
  const grid: ObstacleGrid = { minX: -reachXZ, minY: -reachY, minZ: -reachXZ, cx, cy, cz,
    start: new Int32Array(cx * cy * cz + 1), items: new Int32Array(0),
    stamp: new Uint32Array(layout.obstacles.length), epoch: 0 };
  const counts = grid.start;
  const visit = (index: number, add: (cell: number) => void): void => {
    const o = layout.obstacles[index];
    if (!o) return;
    const x0 = cell(grid.minX, o.p.x - o.radius, cx); const x1 = cell(grid.minX, o.p.x + o.radius, cx);
    const y0 = cell(grid.minY, o.p.y - o.radius, cy); const y1 = cell(grid.minY, o.p.y + o.radius, cy);
    const z0 = cell(grid.minZ, o.p.z - o.radius, cz); const z1 = cell(grid.minZ, o.p.z + o.radius, cz);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) add((x * cy + y) * cz + z);
  };
  for (let i = 0; i < layout.obstacles.length; i++) visit(i, c => { counts[c + 1] = (counts[c + 1] ?? 0) + 1; });
  for (let c = 0; c < counts.length - 1; c++) counts[c + 1] = (counts[c + 1] ?? 0) + (counts[c] ?? 0);
  const fill = counts.slice();
  grid.items = new Int32Array(counts[counts.length - 1] ?? 0);
  for (let i = 0; i < layout.obstacles.length; i++) visit(i, c => { grid.items[fill[c] ?? 0] = i; fill[c] = (fill[c] ?? 0) + 1; });
  return grid;
}

function cell(min: number, value: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.floor((value - min) / CELL)));
}

function gridFor(layout: ArenaLayout): ObstacleGrid {
  let grid = grids.get(layout);
  if (!grid) { grid = build(layout); grids.set(layout, grid); }
  return grid;
}

/**
 * Writes the indices of obstacles whose bounding cube may overlap the query box into
 * `out` (from index 0) and returns how many. No duplicates, no allocation.
 */
export function queryObstacles(layout: ArenaLayout, minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number, out: number[]): number {
  if (layout.obstacles.length === 0) return 0;
  const grid = gridFor(layout);
  grid.epoch = (grid.epoch + 1) >>> 0;
  if (grid.epoch === 0) { grid.stamp.fill(0); grid.epoch = 1; }
  const x0 = cell(grid.minX, minX, grid.cx); const x1 = cell(grid.minX, maxX, grid.cx);
  const y0 = cell(grid.minY, minY, grid.cy); const y1 = cell(grid.minY, maxY, grid.cy);
  const z0 = cell(grid.minZ, minZ, grid.cz); const z1 = cell(grid.minZ, maxZ, grid.cz);
  let count = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const c = (x * grid.cy + y) * grid.cz + z;
    const end = grid.start[c + 1] ?? 0;
    for (let k = grid.start[c] ?? 0; k < end; k++) {
      const index = grid.items[k] ?? 0;
      if (grid.stamp[index] === grid.epoch) continue;
      grid.stamp[index] = grid.epoch;
      out[count++] = index;
    }
  }
  return count;
}
