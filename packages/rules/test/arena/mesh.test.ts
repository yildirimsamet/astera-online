import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createMesh, meshClosestPoint, meshRay, meshSegmentClosest, type ArenaMesh } from '../../src/arena/index.js';
import { lumpyMesh } from './helpers.js';

/** Exhaustive closest point over every triangle (sampled barycentrically + exact vertices/edges via fine grid). */
function bruteClosest(mesh: ArenaMesh, px: number, py: number, pz: number): number {
  let best = Infinity;
  const p = mesh.positions;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = (mesh.indices[t] ?? 0) * 3; const b = (mesh.indices[t + 1] ?? 0) * 3; const c = (mesh.indices[t + 2] ?? 0) * 3;
    const steps = 24;
    for (let i = 0; i <= steps; i++) for (let j = 0; i + j <= steps; j++) {
      const u = i / steps; const v = j / steps; const w = 1 - u - v;
      const x = (p[a] ?? 0) * w + (p[b] ?? 0) * u + (p[c] ?? 0) * v;
      const y = (p[a + 1] ?? 0) * w + (p[b + 1] ?? 0) * u + (p[c + 1] ?? 0) * v;
      const z = (p[a + 2] ?? 0) * w + (p[b + 2] ?? 0) * u + (p[c + 2] ?? 0) * v;
      best = Math.min(best, (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2);
    }
  }
  return Math.sqrt(best);
}

/** First hit of a→b against every triangle, by brute force (Möller–Trumbore). */
function bruteRay(mesh: ArenaMesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const p = mesh.positions; let first = 2;
  const dx = bx - ax; const dy = by - ay; const dz = bz - az;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const i0 = (mesh.indices[t] ?? 0) * 3; const i1 = (mesh.indices[t + 1] ?? 0) * 3; const i2 = (mesh.indices[t + 2] ?? 0) * 3;
    const e1x = (p[i1] ?? 0) - (p[i0] ?? 0); const e1y = (p[i1 + 1] ?? 0) - (p[i0 + 1] ?? 0); const e1z = (p[i1 + 2] ?? 0) - (p[i0 + 2] ?? 0);
    const e2x = (p[i2] ?? 0) - (p[i0] ?? 0); const e2y = (p[i2 + 1] ?? 0) - (p[i0 + 1] ?? 0); const e2z = (p[i2 + 2] ?? 0) - (p[i0 + 2] ?? 0);
    const px = dy * e2z - dz * e2y; const py = dz * e2x - dx * e2z; const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det === 0) continue;
    const tx = ax - (p[i0] ?? 0); const ty = ay - (p[i0 + 1] ?? 0); const tz = az - (p[i0 + 2] ?? 0);
    const u = (tx * px + ty * py + tz * pz) / det; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y; const qy = tz * e1x - tx * e1z; const qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) / det; if (v < 0 || u + v > 1) continue;
    const s = (e2x * qx + e2y * qy + e2z * qz) / det;
    if (s >= 0 && s <= 1 && s < first) first = s;
  }
  return first;
}

const coord = fc.double({ min: -1.6, max: 1.6, noNaN: true });

describe('triangle-mesh collider (Y2: a ship touches the surface it sees)', () => {
  const mesh = lumpyMesh();

  it('is built the same way every time, so every peer holds the same tree', () => {
    const again = lumpyMesh();
    expect(Array.from(again.order)).toEqual(Array.from(mesh.order));
    expect(Array.from(again.bounds)).toEqual(Array.from(mesh.bounds));
    expect(mesh.radius).toBeGreaterThan(0.9);
    expect(mesh.mean).toBeGreaterThan(0.5);
    expect(mesh.mean).toBeLessThan(mesh.radius);
  });

  it('finds the true closest surface point anywhere around the mesh', () => {
    const out = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    fc.assert(fc.property(coord, coord, coord, (x, y, z) => {
      const found = meshClosestPoint(mesh, x, y, z, 10, out);
      expect(found).toBe(true);
      // The brute force samples the surface, so it can only be a little farther than the truth.
      const brute = bruteClosest(mesh, x, y, z);
      expect(out.d).toBeLessThanOrEqual(brute + 1e-9);
      expect(out.d).toBeGreaterThan(brute - 0.02);
      expect(Math.hypot(out.x - x, out.y - y, out.z - z)).toBeCloseTo(out.d, 9);
      expect(Math.hypot(out.nx, out.ny, out.nz)).toBeCloseTo(1, 9);
    }), { numRuns: 60 });
  });

  it('reports nothing beyond the search distance', () => {
    const out = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    expect(meshClosestPoint(mesh, 0, 0, 3, 1, out)).toBe(false);
    expect(meshClosestPoint(mesh, 0, 0, 3, 2.5, out)).toBe(true);
  });

  it('is wound outwards (the fixture itself)', () => {
    let volume = 0; const p = mesh.positions;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const a = (mesh.indices[t] ?? 0) * 3; const b = (mesh.indices[t + 1] ?? 0) * 3; const c = (mesh.indices[t + 2] ?? 0) * 3;
      volume += (p[a] ?? 0) * ((p[b + 1] ?? 0) * (p[c + 2] ?? 0) - (p[b + 2] ?? 0) * (p[c + 1] ?? 0))
        - (p[a + 1] ?? 0) * ((p[b] ?? 0) * (p[c + 2] ?? 0) - (p[b + 2] ?? 0) * (p[c] ?? 0))
        + (p[a + 2] ?? 0) * ((p[b] ?? 0) * (p[c + 1] ?? 0) - (p[b + 1] ?? 0) * (p[c] ?? 0));
    }
    expect(volume).toBeGreaterThan(0);
  });

  it('gives the way out: outside it points back at the query point, inside it points out through the nearest face', () => {
    const out = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    meshClosestPoint(mesh, 0, 0, 2, 5, out);
    expect(out.inside).toBe(false);
    expect(out.nz).toBeGreaterThan(0.5);
    meshClosestPoint(mesh, 0, -2, 0, 5, out);
    expect(out.ny).toBeLessThan(-0.5);
    meshClosestPoint(mesh, 0, 0, 0.6, 5, out);
    expect(out.inside).toBe(true);
    expect(out.nz).toBeGreaterThan(0.5);
    expect(out.z).toBeGreaterThan(0.6);
  });

  it('finds the first surface a segment crosses, exactly as a brute force does', () => {
    fc.assert(fc.property(coord, coord, coord, coord, coord, coord, (ax, ay, az, bx, by, bz) => {
      const t = meshRay(mesh, ax * 2, ay * 2, az * 2, bx * 2, by * 2, bz * 2);
      const brute = bruteRay(mesh, ax * 2, ay * 2, az * 2, bx * 2, by * 2, bz * 2);
      if (brute > 1) expect(t).toBeGreaterThan(1);
      else expect(t).toBeCloseTo(brute, 9);
    }), { numRuns: 300 });
  });

  it('measures the gap between a segment and the surface (capsule axis) like sampling the segment does', () => {
    const out = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    const point = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    fc.assert(fc.property(coord, coord, coord, coord, coord, coord, (ax, ay, az, bx, by, bz) => {
      const found = meshSegmentClosest(mesh, ax, ay, az, bx, by, bz, 10, out);
      expect(found).toBe(true);
      let sampled = Infinity;
      for (let i = 0; i <= 40; i++) {
        const k = i / 40;
        meshClosestPoint(mesh, ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k, 10, point);
        sampled = Math.min(sampled, point.d);
      }
      expect(out.d).toBeLessThanOrEqual(sampled + 1e-9);
      const pair = Math.hypot(out.sx - out.x, out.sy - out.y, out.sz - out.z);
      expect(pair).toBeCloseTo(out.d, 9);
      // The point on the segment really is on the segment.
      const length = Math.hypot(bx - ax, by - ay, bz - az);
      const along = Math.hypot(out.sx - ax, out.sy - ay, out.sz - az) + Math.hypot(out.sx - bx, out.sy - by, out.sz - bz);
      expect(along).toBeCloseTo(length, 6);
    }), { numRuns: 120 });
  });

  it('reports zero gap when the segment pierces the surface', () => {
    const out = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    expect(meshSegmentClosest(mesh, 0, 0, 0.2, 0, 0, 3, 1, out)).toBe(true);
    expect(out.d).toBe(0);
  });

  it('tells inside from outside at a sharp edge, where the nearest face\'s normal alone gets it wrong', () => {
    // A knife: a wedge 0.4 thick at its back tapering to an edge 4 m away; its two long faces
    // point almost opposite ways, so beyond the edge each sees the other side as "behind".
    const knife = createMesh([4, 0, 0, 0, -0.2, 0, 0, 0.2, 0, 4, 0, 2, 0, -0.2, 2, 0, 0.2, 2],
      [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2]);
    const out = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    for (const [x, y] of [[4.5, 0.3], [4.5, -0.3], [4.2, 0.05], [4.2, -0.05]] as const) {
      expect(meshClosestPoint(knife, x, y, 1, 10, out)).toBe(true);
      expect(out.inside).toBe(false);
      expect(out.nx).toBeGreaterThan(0);
    }
    expect(meshClosestPoint(knife, 1, 0, 1, 10, out)).toBe(true);
    expect(out.inside).toBe(true);
    const pair = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    expect(meshSegmentClosest(knife, 4.5, 0.3, 1, 4.6, -0.3, 1, 10, pair)).toBe(true);
    expect(pair.inside).toBe(false);
  });

  it('drops degenerate triangles instead of producing NaN', () => {
    const flat = createMesh([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0], [0, 1, 2, 0, 1, 3]);
    expect(flat.indices.length).toBe(3);
    const out = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0 };
    expect(meshClosestPoint(flat, 0.2, 0.2, 1, 5, out)).toBe(true);
    expect(Number.isFinite(out.d)).toBe(true);
  });
});
