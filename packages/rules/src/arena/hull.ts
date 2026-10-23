import type { FlightTuning } from './tuning.js';
import type { Quaternion, Vec3 } from './types.js';

/** A segment a→b swept by radius r. */
export interface Capsule { ax: number; ay: number; az: number; bx: number; by: number; bz: number; r: number }

/** Capsule k of the hull (`tuning.capsules`) turned by q, as offsets from the ship's centre along world axes. */
export function hullCapsule(q: Quaternion, k: number, tuning: FlightTuning, out: Capsule): void {
  const c = tuning.capsules[k];
  if (!c) throw new RangeError(`hull has no capsule ${String(k)}`);
  // Columns of q's rotation: local +X (side), +Y (up), +Z (forward).
  const sx = 1 - 2 * (q.y * q.y + q.z * q.z); const sy = 2 * (q.x * q.y + q.w * q.z); const sz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  out.ax = sx * c.ax + ux * c.ay + fx * c.az; out.ay = sy * c.ax + uy * c.ay + fy * c.az; out.az = sz * c.ax + uz * c.ay + fz * c.az;
  out.bx = sx * c.bx + ux * c.by + fx * c.bz; out.by = sy * c.bx + uy * c.by + fy * c.bz; out.bz = sz * c.bx + uz * c.by + fz * c.bz;
  out.r = c.r;
}

/** Farthest any part of the hull reaches from the ship's centre. */
export function hullReach(tuning: FlightTuning): number {
  let reach = 0;
  for (const c of tuning.capsules) {
    reach = Math.max(reach, Math.sqrt(c.ax * c.ax + c.ay * c.ay + c.az * c.az) + c.r, Math.sqrt(c.bx * c.bx + c.by * c.by + c.bz * c.bz) + c.r);
  }
  return reach;
}

/** Radius of the hull's thinnest capsule. */
export function hullThinnest(tuning: FlightTuning): number {
  let thinnest = Infinity;
  for (const c of tuning.capsules) thinnest = Math.min(thinnest, c.r);
  return thinnest;
}

/**
 * First fraction t∈[0,1] of segment o→o+d inside capsule a→b (radius r); 0 when it starts
 * inside, 2 when it never enters. The capsule is a cylinder plus two end spheres, so the
 * first entry is the earliest of entering the curved wall within the ends and entering a ball.
 */
export function segmentCapsule(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): number {
  const bax = bx - ax; const bay = by - ay; const baz = bz - az;
  const oax = ox - ax; const oay = oy - ay; const oaz = oz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const baoa = bax * oax + bay * oay + baz * oaz;
  // Starts inside: the nearest axis point is within r.
  const k = baba > 0 ? Math.max(0, Math.min(1, baoa / baba)) : 0;
  const ex = oax - bax * k; const ey = oay - bay * k; const ez = oaz - baz * k;
  if (ex * ex + ey * ey + ez * ez <= r * r) return 0;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(length > 0)) return 2;
  const rx = dx / length; const ry = dy / length; const rz = dz / length;
  let best = Infinity;
  const bard = bax * rx + bay * ry + baz * rz;
  const a = baba - bard * bard;
  if (baba > 0 && a > 1e-12 * baba) {
    const rdoa = rx * oax + ry * oay + rz * oaz; const oaoa = oax * oax + oay * oay + oaz * oaz;
    const b = baba * rdoa - baoa * bard; const c = baba * oaoa - baoa * baoa - r * r * baba;
    const h = b * b - a * c;
    if (h >= 0) {
      const t = (-b - Math.sqrt(h)) / a; const y = baoa + t * bard;
      if (t >= 0 && y >= 0 && y <= baba) best = t;
    }
  }
  for (let end = 0; end < 2; end++) {
    const cx = ox - (end === 0 ? ax : bx); const cy = oy - (end === 0 ? ay : by); const cz = oz - (end === 0 ? az : bz);
    const b = rx * cx + ry * cy + rz * cz; const c = cx * cx + cy * cy + cz * cz - r * r;
    const h = b * b - c;
    if (h < 0) continue;
    const t = -b - Math.sqrt(h);
    if (t >= 0 && t < best) best = t;
  }
  return best <= length ? best / length : 2;
}


/**
 * Where a shot's path this tick first enters a ship's hull (padded by hitPad), as a fraction
 * of the path; 2 for a miss. Motion is relative, so a fast target cannot be tunnelled; the
 * hull is taken in the target's current frame.
 */
export function sweptHull(shot: { previous: Vec3; p: Vec3 }, target: { p: Vec3; q: Quaternion }, previous: Vec3,
  tuning: FlightTuning): number {
  const q = target.q;
  const sx = 1 - 2 * (q.y * q.y + q.z * q.z); const sy = 2 * (q.x * q.y + q.w * q.z); const sz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  // Start and end of the shot relative to the target, then into its frame.
  const wx = shot.previous.x - previous.x; const wy = shot.previous.y - previous.y; const wz = shot.previous.z - previous.z;
  const vx = shot.p.x - target.p.x; const vy = shot.p.y - target.p.y; const vz = shot.p.z - target.p.z;
  const ox = wx * sx + wy * sy + wz * sz; const oy = wx * ux + wy * uy + wz * uz; const oz = wx * fx + wy * fy + wz * fz;
  const dx = vx * sx + vy * sy + vz * sz - ox; const dy = vx * ux + vy * uy + vz * uz - oy; const dz = vx * fx + vy * fy + vz * fz - oz;
  // Most shots pass far from most ships: one sphere round the whole hull settles those.
  const dd = dx * dx + dy * dy + dz * dz;
  const along = dd > 0 ? Math.max(0, Math.min(1, -(ox * dx + oy * dy + oz * dz) / dd)) : 0;
  const cx = ox + dx * along; const cy = oy + dy * along; const cz = oz + dz * along;
  const bound = hullReach(tuning) + tuning.hitPad;
  if (cx * cx + cy * cy + cz * cz > bound * bound) return 2;
  let first = 2;
  for (const c of tuning.capsules) {
    const t = segmentCapsule(ox, oy, oz, dx, dy, dz, c.ax, c.ay, c.az, c.bx, c.by, c.bz, c.r + tuning.hitPad);
    if (t < first) first = t;
  }
  return first;
}
