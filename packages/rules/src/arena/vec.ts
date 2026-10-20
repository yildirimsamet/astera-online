import type { Quaternion, Vec3 } from './types.js';

/** Writes into an existing buffer; no allocations in tick/frame paths. */
export function forwardVector(out: Vec3, q: Quaternion): void {
  out.x = 2 * (q.x * q.z + q.w * q.y);
  out.y = 2 * (q.y * q.z - q.w * q.x);
  out.z = 1 - 2 * (q.x * q.x + q.y * q.y);
}

export function upVector(out: Vec3, q: Quaternion): void {
  out.x = 2 * (q.x * q.y - q.w * q.z);
  out.y = 1 - 2 * (q.x * q.x + q.z * q.z);
  out.z = 2 * (q.y * q.z + q.w * q.x);
}

/** Local +X. Looking along +Z with +Y up, screen-right is local −X. */
export function sideVector(out: Vec3, q: Quaternion): void {
  out.x = 1 - 2 * (q.y * q.y + q.z * q.z);
  out.y = 2 * (q.x * q.y + q.w * q.z);
  out.z = 2 * (q.x * q.z - q.w * q.y);
}

/** World direction (x, y, z) expressed in the frame of q (inverse rotation). */
export function toLocal(out: Vec3, q: Quaternion, x: number, y: number, z: number): void {
  const sx = 1 - 2 * (q.y * q.y + q.z * q.z); const sy = 2 * (q.x * q.y + q.w * q.z); const sz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  out.x = x * sx + y * sy + z * sz;
  out.y = x * ux + y * uy + z * uz;
  out.z = x * fx + y * fy + z * fz;
}

export function normalizeQuaternion(q: Quaternion): void {
  const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (!(length > 0) || !Number.isFinite(length)) { q.x = 0; q.y = 0; q.z = 0; q.w = 1; return; }
  const inverse = 1 / length;
  q.x *= inverse; q.y *= inverse; q.z *= inverse; q.w *= inverse;
}

/** Local angular increment, normalized with IEEE-754 arithmetic only. */
export function rotateLocal(q: Quaternion, pitch: number, yaw: number, roll: number, dt: number): void {
  if (pitch === 0 && yaw === 0 && roll === 0) return;
  const a = pitch * dt * 0.5;
  const b = yaw * dt * 0.5;
  const c = roll * dt * 0.5;
  const x = q.x + q.w * a + q.y * c - q.z * b;
  const y = q.y + q.w * b + q.z * a - q.x * c;
  const z = q.z + q.w * c + q.x * b - q.y * a;
  const w = q.w - q.x * a - q.y * b - q.z * c;
  q.x = x; q.y = y; q.z = z; q.w = w;
  normalizeQuaternion(q);
}

/** Pre-multiplies a small world-axis rotation (axis unit, angle in radians, first order). */
export function rotateWorld(q: Quaternion, ax: number, ay: number, az: number, angle: number): void {
  if (angle === 0) return;
  const h = angle * 0.5;
  const rx = ax * h; const ry = ay * h; const rz = az * h;
  const x = q.x + rx * q.w + ry * q.z - rz * q.y;
  const y = q.y + ry * q.w + rz * q.x - rx * q.z;
  const z = q.z + rz * q.w + rx * q.y - ry * q.x;
  const w = q.w - rx * q.x - ry * q.y - rz * q.z;
  q.x = x; q.y = y; q.z = z; q.w = w;
  normalizeQuaternion(q);
}

/**
 * Turns q a fraction `k` of the way so its local up meets the unit normal n, by
 * normalized-lerp from identity towards the shortest-arc rotation. Arithmetic + sqrt.
 */
export function alignUp(q: Quaternion, nx: number, ny: number, nz: number, k: number): void {
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const d = ux * nx + uy * ny + uz * nz;
  let cx = uy * nz - uz * ny; let cy = uz * nx - ux * nz; let cz = ux * ny - uy * nx;
  let cw = 1 + d;
  if (cw < 1e-6) {
    // Upside down: turn about the ship's own forward axis.
    cx = 2 * (q.x * q.z + q.w * q.y); cy = 2 * (q.y * q.z - q.w * q.x); cz = 1 - 2 * (q.x * q.x + q.y * q.y); cw = 0;
  }
  const length = Math.sqrt(cx * cx + cy * cy + cz * cz + cw * cw);
  if (!(length > 0)) return;
  const f = Math.max(0, Math.min(1, k));
  const rx = cx / length * f; const ry = cy / length * f; const rz = cz / length * f; const rw = 1 - f + cw / length * f;
  const x = rw * q.x + rx * q.w + ry * q.z - rz * q.y;
  const y = rw * q.y + ry * q.w + rz * q.x - rx * q.z;
  const z = rw * q.z + rz * q.w + rx * q.y - ry * q.x;
  const w = rw * q.w - rx * q.x - ry * q.y - rz * q.z;
  q.x = x; q.y = y; q.z = z; q.w = w;
  normalizeQuaternion(q);
}

// Twelve horizontal directions 30° apart, written out: the shared simulation never calls trig.
const S3 = 0.8660254037844386;
export const RING12: readonly (readonly [number, number])[] = [
  [1, 0], [S3, 0.5], [0.5, S3], [0, 1], [-0.5, S3], [-S3, 0.5], [-1, 0], [-S3, -0.5], [-0.5, -S3], [0, -1], [0.5, -S3], [S3, -0.5],
];
