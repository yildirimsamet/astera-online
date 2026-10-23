/**
 * TRIANGLE-MESH COLLIDERS (Y2). A rock was a sphere: a ship struck empty space where the
 * sphere bulged past the rock and sank into the rock where it bulged past the sphere. A
 * mesh collider is the drawn surface itself (or a simplification measured against it), so
 * a ship touches exactly what the pilot sees.
 *
 * Meshes live in their own space; an obstacle places one with a rotation and a uniform
 * scale. Each mesh carries an AABB tree over its triangles, built in a fixed order, so
 * every peer holds the same tree and walks it the same way. Queries use + − × ÷ and sqrt
 * only (KG-T11) and allocate nothing.
 */
export interface ArenaMesh {
  /** Vertex positions, x y z interleaved. */
  readonly positions: Float64Array;
  /** Three vertex indices per triangle, wound counter-clockwise seen from outside. */
  readonly indices: Uint32Array;
  /** Largest vertex distance from the origin. */
  readonly radius: number;
  /** Average vertex distance from the origin: rocks are sized by it. */
  readonly mean: number;
  /** Tree node n: bounds at 6n (min x y z, max x y z). */
  readonly bounds: Float64Array;
  /** Leaf: first slot in `order`; inner node: left child (the right child is `right[n]`). */
  readonly start: Int32Array;
  /** Leaf: number of triangles (> 0); inner node: 0. */
  readonly count: Int32Array;
  readonly right: Int32Array;
  /** Triangle numbers in tree order. */
  readonly order: Uint32Array;
}

/** Closest surface point, the unit direction that leads out of the surface, and the distance. */
export interface SurfacePoint { x: number; y: number; z: number; nx: number; ny: number; nz: number; d: number; inside?: boolean }
/** As SurfacePoint, plus the point on the query segment (s) the surface point is closest to. */
export interface SegmentPoint extends SurfacePoint { sx: number; sy: number; sz: number }

const LEAF = 4;

export function createMesh(positions: ArrayLike<number>, indices: ArrayLike<number>): ArenaMesh {
  const p = Float64Array.from(positions);
  const kept: number[] = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = (indices[t] ?? 0) * 3; const b = (indices[t + 1] ?? 0) * 3; const c = (indices[t + 2] ?? 0) * 3;
    const e1x = (p[b] ?? 0) - (p[a] ?? 0); const e1y = (p[b + 1] ?? 0) - (p[a + 1] ?? 0); const e1z = (p[b + 2] ?? 0) - (p[a + 2] ?? 0);
    const e2x = (p[c] ?? 0) - (p[a] ?? 0); const e2y = (p[c + 1] ?? 0) - (p[a + 1] ?? 0); const e2z = (p[c + 2] ?? 0) - (p[a + 2] ?? 0);
    const nx = e1y * e2z - e1z * e2y; const ny = e1z * e2x - e1x * e2z; const nz = e1x * e2y - e1y * e2x;
    // A triangle with no area has no outside; it would only divide by zero.
    if (nx * nx + ny * ny + nz * nz > 1e-24) kept.push(indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0);
  }
  const index = Uint32Array.from(kept);
  const triangles = index.length / 3;
  const centroid = new Float64Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      centroid[t * 3 + k] = ((p[(index[t * 3] ?? 0) * 3 + k] ?? 0) + (p[(index[t * 3 + 1] ?? 0) * 3 + k] ?? 0)
        + (p[(index[t * 3 + 2] ?? 0) * 3 + k] ?? 0)) / 3;
    }
  }
  const order = Array.from({ length: triangles }, (_, t) => t);
  const bounds: number[] = []; const start: number[] = []; const count: number[] = []; const right: number[] = [];
  const node = (from: number, to: number): number => {
    const id = start.length;
    start.push(0); count.push(0); right.push(-1);
    let minX = Infinity; let minY = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
    let cMinX = Infinity; let cMinY = Infinity; let cMinZ = Infinity; let cMaxX = -Infinity; let cMaxY = -Infinity; let cMaxZ = -Infinity;
    for (let k = from; k < to; k++) {
      const t = order[k] ?? 0;
      for (let v = 0; v < 3; v++) {
        const i = (index[t * 3 + v] ?? 0) * 3;
        const x = p[i] ?? 0; const y = p[i + 1] ?? 0; const z = p[i + 2] ?? 0;
        if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
      }
      const cx = centroid[t * 3] ?? 0; const cy = centroid[t * 3 + 1] ?? 0; const cz = centroid[t * 3 + 2] ?? 0;
      if (cx < cMinX) cMinX = cx; if (cy < cMinY) cMinY = cy; if (cz < cMinZ) cMinZ = cz;
      if (cx > cMaxX) cMaxX = cx; if (cy > cMaxY) cMaxY = cy; if (cz > cMaxZ) cMaxZ = cz;
    }
    bounds.push(minX, minY, minZ, maxX, maxY, maxZ);
    const ex = cMaxX - cMinX; const ey = cMaxY - cMinY; const ez = cMaxZ - cMinZ;
    if (to - from <= LEAF || (ex <= 0 && ey <= 0 && ez <= 0)) { start[id] = from; count[id] = to - from; return id; }
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const slice = order.slice(from, to).sort((a, b) => ((centroid[a * 3 + axis] ?? 0) - (centroid[b * 3 + axis] ?? 0)) || a - b);
    for (let k = from; k < to; k++) order[k] = slice[k - from] ?? 0;
    const mid = (from + to) >> 1;
    start[id] = node(from, mid);
    right[id] = node(mid, to);
    return id;
  };
  if (triangles > 0) node(0, triangles);
  let radius = 0; let sum = 0; const vertices = p.length / 3;
  for (let i = 0; i < p.length; i += 3) {
    const d = Math.sqrt((p[i] ?? 0) * (p[i] ?? 0) + (p[i + 1] ?? 0) * (p[i + 1] ?? 0) + (p[i + 2] ?? 0) * (p[i + 2] ?? 0));
    if (d > radius) radius = d;
    sum += d;
  }
  return {
    positions: p, indices: index, radius, mean: vertices > 0 ? sum / vertices : 0,
    bounds: Float64Array.from(bounds), start: Int32Array.from(start), count: Int32Array.from(count),
    right: Int32Array.from(right), order: Uint32Array.from(order),
  };
}

// --- Primitive tests -----------------------------------------------------------------------

const tri = { x: 0, y: 0, z: 0, face: false };

/**
 * Closest point of triangle abc to p (Ericson 5.1.5) into `tri`; returns the squared distance.
 * `tri.face` is true when it lies inside the face rather than on an edge or a corner.
 */
function closestOnTriangle(px: number, py: number, pz: number, ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const abx = bx - ax; const aby = by - ay; const abz = bz - az;
  const acx = cx - ax; const acy = cy - ay; const acz = cz - az;
  const apx = px - ax; const apy = py - ay; const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz; const d2 = acx * apx + acy * apy + acz * apz;
  tri.face = false;
  if (d1 <= 0 && d2 <= 0) { tri.x = ax; tri.y = ay; tri.z = az; }
  else {
    const bpx = px - bx; const bpy = py - by; const bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz; const d4 = acx * bpx + acy * bpy + acz * bpz;
    const vc = d1 * d4 - d3 * d2;
    if (d3 >= 0 && d4 <= d3) { tri.x = bx; tri.y = by; tri.z = bz; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3); tri.x = ax + abx * v; tri.y = ay + aby * v; tri.z = az + abz * v;
    } else {
      const cpx = px - cx; const cpy = py - cy; const cpz = pz - cz;
      const d5 = abx * cpx + aby * cpy + abz * cpz; const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vb = d5 * d2 - d1 * d6;
      if (d6 >= 0 && d5 <= d6) { tri.x = cx; tri.y = cy; tri.z = cz; }
      else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6); tri.x = ax + acx * w; tri.y = ay + acy * w; tri.z = az + acz * w;
      } else {
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
          const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
          tri.x = bx + (cx - bx) * w; tri.y = by + (cy - by) * w; tri.z = bz + (cz - bz) * w;
        } else {
          const denominator = 1 / (va + vb + vc);
          const v = vb * denominator; const w = vc * denominator;
          tri.x = ax + abx * v + acx * w; tri.y = ay + aby * v + acy * w; tri.z = az + abz * v + acz * w;
          tri.face = true;
        }
      }
    }
  }
  const dx = px - tri.x; const dy = py - tri.y; const dz = pz - tri.z;
  return dx * dx + dy * dy + dz * dz;
}

const seg = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0 };

/** Closest points of segments p1q1 and p2q2 (Ericson 5.1.9) into `seg`; returns the squared distance. */
function closestSegments(p1x: number, p1y: number, p1z: number, q1x: number, q1y: number, q1z: number,
  p2x: number, p2y: number, p2z: number, q2x: number, q2y: number, q2z: number): number {
  const d1x = q1x - p1x; const d1y = q1y - p1y; const d1z = q1z - p1z;
  const d2x = q2x - p2x; const d2y = q2y - p2y; const d2z = q2z - p2z;
  const rx = p1x - p2x; const ry = p1y - p2y; const rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z; const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s: number; let t: number;
  if (a <= 1e-18 && e <= 1e-18) { s = 0; t = 0; }
  else if (a <= 1e-18) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-18) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denominator = a * e - b * b;
      s = denominator > 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denominator)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  seg.sx = p1x + d1x * s; seg.sy = p1y + d1y * s; seg.sz = p1z + d1z * s;
  seg.x = p2x + d2x * t; seg.y = p2y + d2y * t; seg.z = p2z + d2z * t;
  const dx = seg.sx - seg.x; const dy = seg.sy - seg.y; const dz = seg.sz - seg.z;
  return dx * dx + dy * dy + dz * dz;
}

/** Fraction along a→a+d where it crosses triangle v0v1v2 (either side), or 2 (Möller–Trumbore). */
function rayTriangle(ax: number, ay: number, az: number, dx: number, dy: number, dz: number,
  v0x: number, v0y: number, v0z: number, v1x: number, v1y: number, v1z: number, v2x: number, v2y: number, v2z: number): number {
  const e1x = v1x - v0x; const e1y = v1y - v0y; const e1z = v1z - v0z;
  const e2x = v2x - v0x; const e2y = v2y - v0y; const e2z = v2z - v0z;
  const px = dy * e2z - dz * e2y; const py = dz * e2x - dx * e2z; const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det === 0) return 2;
  const tx = ax - v0x; const ty = ay - v0y; const tz = az - v0z;
  const u = (tx * px + ty * py + tz * pz) / det;
  if (u < 0 || u > 1) return 2;
  const qx = ty * e1z - tz * e1y; const qy = tz * e1x - tx * e1z; const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) / det;
  if (v < 0 || u + v > 1) return 2;
  const t = (e2x * qx + e2y * qy + e2z * qz) / det;
  return t >= 0 && t <= 1 ? t : 2;
}

// --- Tree walks ----------------------------------------------------------------------------

const stack = new Int32Array(128);

/** Squared distance from p to node n's box. */
function boxDistance2(mesh: ArenaMesh, n: number, px: number, py: number, pz: number): number {
  const b = mesh.bounds; const o = n * 6;
  const dx = Math.max((b[o] ?? 0) - px, 0, px - (b[o + 3] ?? 0));
  const dy = Math.max((b[o + 1] ?? 0) - py, 0, py - (b[o + 4] ?? 0));
  const dz = Math.max((b[o + 2] ?? 0) - pz, 0, pz - (b[o + 5] ?? 0));
  return dx * dx + dy * dy + dz * dz;
}

const span = { enter: 0, leave: 0 };

/** Narrows `span` to where start + delta·t lies within [min, max]; false once it is empty. */
function slabAxis(start: number, delta: number, min: number, max: number): boolean {
  if (delta === 0) return start >= min && start <= max;
  let t0 = (min - start) / delta; let t1 = (max - start) / delta;
  if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
  if (t0 > span.enter) span.enter = t0;
  if (t1 < span.leave) span.leave = t1;
  return span.enter <= span.leave;
}

/** Does a→a+d (t from 0 to `until`) pass through the box at `o`? */
function slab(b: Float64Array, o: number, ax: number, ay: number, az: number, dx: number, dy: number, dz: number, until: number): boolean {
  span.enter = 0; span.leave = until;
  return slabAxis(ax, dx, b[o] ?? 0, b[o + 3] ?? 0) && slabAxis(ay, dy, b[o + 1] ?? 0, b[o + 4] ?? 0)
    && slabAxis(az, dz, b[o + 2] ?? 0, b[o + 5] ?? 0);
}

// An odd direction, so a parity ray never runs exactly along an edge of a built mesh.
const PARITY_X = 0.5432; const PARITY_Y = 0.7105; const PARITY_Z = 0.4471;

/**
 * Is p inside the closed mesh? Counts the surfaces a ray from p crosses on its way out.
 * Used where the nearest point is an edge or a corner: there the nearest face's normal
 * alone misreads a sharp edge (a blade's two faces point almost opposite ways).
 */
export function meshInside(mesh: ArenaMesh, px: number, py: number, pz: number): boolean {
  const reach = Math.sqrt(px * px + py * py + pz * pz) + 2 * mesh.radius + 1;
  const dx = PARITY_X * reach; const dy = PARITY_Y * reach; const dz = PARITY_Z * reach;
  const p = mesh.positions; const idx = mesh.indices;
  let crossings = 0;
  let top = 0; stack[top++] = 0;
  while (top > 0) {
    const n = stack[--top] ?? 0;
    if (!slab(mesh.bounds, n * 6, px, py, pz, dx, dy, dz, 1)) continue;
    const count = mesh.count[n] ?? 0;
    if (count === 0) { stack[top++] = mesh.right[n] ?? 0; stack[top++] = mesh.start[n] ?? 0; continue; }
    const first = mesh.start[n] ?? 0;
    for (let k = first; k < first + count; k++) {
      const t = mesh.order[k] ?? 0;
      const a = (idx[t * 3] ?? 0) * 3; const b = (idx[t * 3 + 1] ?? 0) * 3; const c = (idx[t * 3 + 2] ?? 0) * 3;
      if (rayTriangle(px, py, pz, dx, dy, dz, p[a] ?? 0, p[a + 1] ?? 0, p[a + 2] ?? 0, p[b] ?? 0, p[b + 1] ?? 0, p[b + 2] ?? 0,
        p[c] ?? 0, p[c + 1] ?? 0, p[c + 2] ?? 0) <= 1) crossings++;
    }
  }
  return crossings % 2 === 1;
}

/**
 * Writes the way out at the found point: away from p outside, back through the surface
 * inside. `face`: the point lies inside triangle t, where its normal decides exactly.
 */
function direction(mesh: ArenaMesh, t: number, face: boolean, px: number, py: number, pz: number, out: SurfacePoint): void {
  const p = mesh.positions;
  const a = (mesh.indices[t * 3] ?? 0) * 3; const b = (mesh.indices[t * 3 + 1] ?? 0) * 3; const c = (mesh.indices[t * 3 + 2] ?? 0) * 3;
  const e1x = (p[b] ?? 0) - (p[a] ?? 0); const e1y = (p[b + 1] ?? 0) - (p[a + 1] ?? 0); const e1z = (p[b + 2] ?? 0) - (p[a + 2] ?? 0);
  const e2x = (p[c] ?? 0) - (p[a] ?? 0); const e2y = (p[c + 1] ?? 0) - (p[a + 1] ?? 0); const e2z = (p[c + 2] ?? 0) - (p[a + 2] ?? 0);
  let fx = e1y * e2z - e1z * e2y; let fy = e1z * e2x - e1x * e2z; let fz = e1x * e2y - e1y * e2x;
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;
  const gx = px - out.x; const gy = py - out.y; const gz = pz - out.z;
  if (out.d > 0) {
    const inside = face ? gx * fx + gy * fy + gz * fz < 0 : meshInside(mesh, px, py, pz);
    const k = (inside ? -1 : 1) / out.d;
    out.nx = gx * k; out.ny = gy * k; out.nz = gz * k; out.inside = inside;
  } else { out.nx = fx; out.ny = fy; out.nz = fz; out.inside = false; }
}

/** Nearest surface point to p within `reach`; false when nothing is that close. */
export function meshClosestPoint(mesh: ArenaMesh, px: number, py: number, pz: number, reach: number, out: SurfacePoint): boolean {
  if (mesh.order.length === 0) return false;
  const p = mesh.positions; const idx = mesh.indices;
  let best = reach * reach; let found = -1; let face = false;
  let top = 0; stack[top++] = 0;
  while (top > 0) {
    const n = stack[--top] ?? 0;
    if (boxDistance2(mesh, n, px, py, pz) > best) continue;
    const count = mesh.count[n] ?? 0;
    if (count === 0) {
      const left = mesh.start[n] ?? 0; const right = mesh.right[n] ?? 0;
      // Nearer child last, so it is walked first and tightens `best` sooner.
      if (boxDistance2(mesh, left, px, py, pz) < boxDistance2(mesh, right, px, py, pz)) { stack[top++] = right; stack[top++] = left; }
      else { stack[top++] = left; stack[top++] = right; }
      continue;
    }
    const first = mesh.start[n] ?? 0;
    for (let k = first; k < first + count; k++) {
      const t = mesh.order[k] ?? 0;
      const a = (idx[t * 3] ?? 0) * 3; const b = (idx[t * 3 + 1] ?? 0) * 3; const c = (idx[t * 3 + 2] ?? 0) * 3;
      const d2 = closestOnTriangle(px, py, pz, p[a] ?? 0, p[a + 1] ?? 0, p[a + 2] ?? 0, p[b] ?? 0, p[b + 1] ?? 0, p[b + 2] ?? 0,
        p[c] ?? 0, p[c + 1] ?? 0, p[c + 2] ?? 0);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = tri.face; out.x = tri.x; out.y = tri.y; out.z = tri.z; }
    }
  }
  if (found < 0) return false;
  out.d = Math.sqrt(best);
  direction(mesh, found, face, px, py, pz, out);
  return true;
}

/**
 * Nearest pair between segment a→b (a capsule's axis) and the surface within `reach`.
 * A segment that pierces the surface reports d = 0 at the crossing.
 */
export function meshSegmentClosest(mesh: ArenaMesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  reach: number, out: SegmentPoint): boolean {
  if (mesh.order.length === 0) return false;
  const p = mesh.positions; const idx = mesh.indices;
  const minX = Math.min(ax, bx) - reach; const minY = Math.min(ay, by) - reach; const minZ = Math.min(az, bz) - reach;
  const maxX = Math.max(ax, bx) + reach; const maxY = Math.max(ay, by) + reach; const maxZ = Math.max(az, bz) + reach;
  const dx = bx - ax; const dy = by - ay; const dz = bz - az;
  let best = reach * reach; let found = -1; let face = false;
  let top = 0; stack[top++] = 0;
  while (top > 0 && best > 0) {
    const n = stack[--top] ?? 0; const o = n * 6; const bb = mesh.bounds;
    if ((bb[o] ?? 0) > maxX || (bb[o + 3] ?? 0) < minX || (bb[o + 1] ?? 0) > maxY || (bb[o + 4] ?? 0) < minY
      || (bb[o + 2] ?? 0) > maxZ || (bb[o + 5] ?? 0) < minZ) continue;
    const count = mesh.count[n] ?? 0;
    if (count === 0) { stack[top++] = mesh.right[n] ?? 0; stack[top++] = mesh.start[n] ?? 0; continue; }
    const first = mesh.start[n] ?? 0;
    for (let k = first; k < first + count && best > 0; k++) {
      const t = mesh.order[k] ?? 0;
      const a = (idx[t * 3] ?? 0) * 3; const b = (idx[t * 3 + 1] ?? 0) * 3; const c = (idx[t * 3 + 2] ?? 0) * 3;
      const v0x = p[a] ?? 0; const v0y = p[a + 1] ?? 0; const v0z = p[a + 2] ?? 0;
      const v1x = p[b] ?? 0; const v1y = p[b + 1] ?? 0; const v1z = p[b + 2] ?? 0;
      const v2x = p[c] ?? 0; const v2y = p[c + 1] ?? 0; const v2z = p[c + 2] ?? 0;
      const cross = rayTriangle(ax, ay, az, dx, dy, dz, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
      if (cross <= 1) {
        best = 0; found = t; face = true;
        out.sx = ax + dx * cross; out.sy = ay + dy * cross; out.sz = az + dz * cross; out.x = out.sx; out.y = out.sy; out.z = out.sz;
        break;
      }
      // Not crossing: the nearest pair holds an end of the segment or an edge of the triangle.
      let d2 = closestOnTriangle(ax, ay, az, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = tri.face; out.sx = ax; out.sy = ay; out.sz = az; out.x = tri.x; out.y = tri.y; out.z = tri.z; }
      d2 = closestOnTriangle(bx, by, bz, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = tri.face; out.sx = bx; out.sy = by; out.sz = bz; out.x = tri.x; out.y = tri.y; out.z = tri.z; }
      d2 = closestSegments(ax, ay, az, bx, by, bz, v0x, v0y, v0z, v1x, v1y, v1z);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = false; out.sx = seg.sx; out.sy = seg.sy; out.sz = seg.sz; out.x = seg.x; out.y = seg.y; out.z = seg.z; }
      d2 = closestSegments(ax, ay, az, bx, by, bz, v1x, v1y, v1z, v2x, v2y, v2z);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = false; out.sx = seg.sx; out.sy = seg.sy; out.sz = seg.sz; out.x = seg.x; out.y = seg.y; out.z = seg.z; }
      d2 = closestSegments(ax, ay, az, bx, by, bz, v2x, v2y, v2z, v0x, v0y, v0z);
      if (d2 < best || (found < 0 && d2 <= best)) { best = d2; found = t; face = false; out.sx = seg.sx; out.sy = seg.sy; out.sz = seg.sz; out.x = seg.x; out.y = seg.y; out.z = seg.z; }
    }
  }
  if (found < 0) return false;
  out.d = Math.sqrt(best);
  direction(mesh, found, face, out.sx, out.sy, out.sz, out);
  return true;
}

/** First fraction t∈[0,1] at which segment a→b crosses the surface, or 2 when it never does. */
export function meshRay(mesh: ArenaMesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  if (mesh.order.length === 0) return 2;
  const p = mesh.positions; const idx = mesh.indices;
  const dx = bx - ax; const dy = by - ay; const dz = bz - az;
  let first = 2;
  let top = 0; stack[top++] = 0;
  while (top > 0) {
    const n = stack[--top] ?? 0;
    if (!slab(mesh.bounds, n * 6, ax, ay, az, dx, dy, dz, Math.min(1, first))) continue;
    const count = mesh.count[n] ?? 0;
    if (count === 0) { stack[top++] = mesh.right[n] ?? 0; stack[top++] = mesh.start[n] ?? 0; continue; }
    const start = mesh.start[n] ?? 0;
    for (let k = start; k < start + count; k++) {
      const t = mesh.order[k] ?? 0;
      const a = (idx[t * 3] ?? 0) * 3; const b = (idx[t * 3 + 1] ?? 0) * 3; const c = (idx[t * 3 + 2] ?? 0) * 3;
      const hit = rayTriangle(ax, ay, az, dx, dy, dz, p[a] ?? 0, p[a + 1] ?? 0, p[a + 2] ?? 0,
        p[b] ?? 0, p[b + 1] ?? 0, p[b + 2] ?? 0, p[c] ?? 0, p[c + 1] ?? 0, p[c + 2] ?? 0);
      if (hit < first) first = hit;
    }
  }
  return first;
}
