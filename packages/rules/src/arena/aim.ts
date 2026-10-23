import { ARENA_TUNING, type FlightTuning } from './tuning.js';
import type { FlightState, Vec3 } from './types.js';

/**
 * Smallest positive time at which a shot leaving the origin at `speed` meets a target at
 * relative position p moving with relative velocity v; −1 when it cannot catch it.
 */
export function leadTime(px: number, py: number, pz: number, vx: number, vy: number, vz: number, speed: number): number {
  const a = vx * vx + vy * vy + vz * vz - speed * speed;
  const b = 2 * (px * vx + py * vy + pz * vz);
  const c = px * px + py * py + pz * pz;
  if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : -1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a); const t2 = (-b + root) / (2 * a);
  const low = Math.min(t1, t2); const high = Math.max(t1, t2);
  if (low > 0) return low;
  return high > 0 ? high : -1;
}

const lead = { x: 0, y: 0, z: 0 };

/**
 * Lead point of `targetP`/`targetV` as seen from `shooter`, whose shots inherit its own
 * velocity. Writes the point relative to the shooter into `out`; false when unsolvable.
 */
export function leadPoint(out: Vec3, shooter: FlightState, targetP: Vec3, targetV: Vec3, tuning: FlightTuning = ARENA_TUNING): boolean {
  const q = shooter.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const px = targetP.x - shooter.p.x; const py = targetP.y - shooter.p.y; const pz = targetP.z - shooter.p.z;
  const vx = targetV.x - fx * shooter.s; const vy = targetV.y - fy * shooter.s; const vz = targetV.z - fz * shooter.s;
  const t = leadTime(px, py, pz, vx, vy, vz, tuning.muzzleSpeed);
  if (t < 0 || t > tuning.projectileLife) return false;
  out.x = px + vx * t; out.y = py + vy * t; out.z = pz + vz * t;
  return true;
}

/**
 * Gun gimbal: when the lead point of a (visible) target sits within `gimbalCos` of the
 * nose and inside `gimbalRange`, writes the unit direction to it and returns true.
 */
export function gimbalAim(out: Vec3, shooter: FlightState, targetP: Vec3, targetV: Vec3, tuning: FlightTuning = ARENA_TUNING): boolean {
  if (!leadPoint(lead, shooter, targetP, targetV, tuning)) return false;
  const length = Math.sqrt(lead.x * lead.x + lead.y * lead.y + lead.z * lead.z);
  if (!(length > 0) || length > tuning.gimbalRange) return false;
  const q = shooter.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  if ((lead.x * fx + lead.y * fy + lead.z * fz) / length < tuning.gimbalCos) return false;
  out.x = lead.x / length; out.y = lead.y / length; out.z = lead.z / length;
  return true;
}

/**
 * Steering magnet for the pilot's own input (Metalstorm-style, mild). While firing at a
 * target whose lead point is inside the assist cone, writes a turn command towards it
 * in stick units (x right, y down = nose up); it fades as the pilot steers deliberately.
 */
export function assistSteer(out: { x: number; y: number }, pilot: FlightState, targetP: Vec3, targetV: Vec3,
  stickX: number, stickY: number, firing: boolean, tuning: FlightTuning = ARENA_TUNING): void {
  out.x = 0; out.y = 0;
  if (!firing || !leadPoint(lead, pilot, targetP, targetV, tuning)) return;
  const q = pilot.q;
  const sx = 1 - 2 * (q.y * q.y + q.z * q.z); const sy = 2 * (q.x * q.y + q.w * q.z); const sz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const lz = lead.x * fx + lead.y * fy + lead.z * fz;
  const length = Math.sqrt(lead.x * lead.x + lead.y * lead.y + lead.z * lead.z);
  if (!(length > 0) || length > tuning.assistRange || lz / length < tuning.assistCos) return;
  // Small-angle error in radians: right is local −X, up is local +Y.
  const right = -(lead.x * sx + lead.y * sy + lead.z * sz) / lz;
  const up = (lead.x * ux + lead.y * uy + lead.z * uz) / lz;
  // Turn rate that would close the error in ~0.25 s, as a fraction of the max rate.
  const scale = 1 / (0.25 * tuning.turnRateMax);
  const stick = Math.min(1, Math.sqrt(stickX * stickX + stickY * stickY));
  const yield_ = 1 - 0.75 * stick;
  let x = right * scale * yield_; let y = -up * scale * yield_;
  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude > tuning.assistMax) { x *= tuning.assistMax / magnitude; y *= tuning.assistMax / magnitude; }
  out.x = x; out.y = y;
}

/** The aim circle's cone: the eye it is seen from (world), its unit axis and the cosine of its half-angle. */
export interface AimCone { ex: number; ey: number; ez: number; ax: number; ay: number; az: number; cos: number }

/**
 * The aim circle as the pilot sees it (owner 2026-10-21). The circle is drawn round the nose
 * at convergeDist and seen from the chase camera behind and above the ship; a cone from the
 * nose itself put a close target that sat inside the drawn circle outside it. This is the
 * cone from the camera's eye (`aimEyeBack`, `aimEyeUp`) through the drawn circle.
 */
export function aimCone(out: AimCone, shooter: FlightState, tuning: FlightTuning = ARENA_TUNING): void {
  const q = shooter.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  out.ex = shooter.p.x + ux * tuning.aimEyeUp - fx * tuning.aimEyeBack;
  out.ey = shooter.p.y + uy * tuning.aimEyeUp - fy * tuning.aimEyeBack;
  out.ez = shooter.p.z + uz * tuning.aimEyeUp - fz * tuning.aimEyeBack;
  const ax = shooter.p.x + fx * tuning.convergeDist - out.ex; const ay = shooter.p.y + fy * tuning.convergeDist - out.ey;
  const az = shooter.p.z + fz * tuning.convergeDist - out.ez;
  const length = Math.sqrt(ax * ax + ay * ay + az * az);
  out.ax = ax / length; out.ay = ay / length; out.az = az / length;
  const rim = tuning.convergeDist * Math.sqrt(1 - tuning.aimCircleCos * tuning.aimCircleCos) / tuning.aimCircleCos;
  out.cos = length / Math.sqrt(length * length + rim * rim);
}

const cone: AimCone = { ex: 0, ey: 0, ez: 0, ax: 0, ay: 0, az: 0, cos: 1 };

/** Cosine between the cone's axis and the eye → world point direction; −1 at the eye itself. */
function coneCos(x: number, y: number, z: number): number {
  const dx = x - cone.ex; const dy = y - cone.ey; const dz = z - cone.ez;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return d > 0 ? (dx * cone.ax + dy * cone.ay + dz * cone.az) / d : -1;
}

/**
 * The player's aim circle (owner 2026-10-21, Subdivision-style). The heading stays the
 * pilot's own; inside the circle (`aimCone`) only the guns follow. While the target's hull
 * or its lead point is inside and ahead of the guns, writes the gun direction (unit, world)
 * and returns 1 when it lies on the lead point, 2 when the lead is beyond the rim and the
 * guns stop at the rim towards it. Returns 0, guns straight, once both have left the circle.
 */
export function circleAim(out: Vec3, shooter: FlightState, targetP: Vec3, targetV: Vec3, tuning: FlightTuning = ARENA_TUNING): 0 | 1 | 2 {
  const q = shooter.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const hx = targetP.x - shooter.p.x; const hy = targetP.y - shooter.p.y; const hz = targetP.z - shooter.p.z;
  const distance = Math.sqrt(hx * hx + hy * hy + hz * hz);
  if (!(distance > 0) || distance > tuning.aimRange) return 0;
  aimCone(cone, shooter, tuning);
  const hull = hx * fx + hy * fy + hz * fz > 0 && coneCos(targetP.x, targetP.y, targetP.z) >= cone.cos;
  if (!leadPoint(lead, shooter, targetP, targetV, tuning)) {
    if (!hull) return 0;
    lead.x = hx; lead.y = hy; lead.z = hz;
  }
  const length = Math.sqrt(lead.x * lead.x + lead.y * lead.y + lead.z * lead.z);
  if (!(length > 0)) return 0;
  const lx = shooter.p.x + lead.x; const ly = shooter.p.y + lead.y; const lz = shooter.p.z + lead.z;
  if (lead.x * fx + lead.y * fy + lead.z * fz > 0 && coneCos(lx, ly, lz) >= cone.cos) {
    out.x = lead.x / length; out.y = lead.y / length; out.z = lead.z / length;
    return 1;
  }
  if (!hull) return 0;
  // On the rim towards the lead, as far from the eye as the lead is; no trigonometry.
  const dx = lx - cone.ex; const dy = ly - cone.ey; const dz = lz - cone.ez;
  const reach = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const along = dx * cone.ax + dy * cone.ay + dz * cone.az;
  const px = dx - cone.ax * along; const py = dy - cone.ay * along; const pz = dz - cone.az * along;
  const side = Math.sqrt(px * px + py * py + pz * pz);
  const sin = Math.sqrt(1 - cone.cos * cone.cos);
  let gx = cone.ex + cone.ax * cone.cos * reach - shooter.p.x;
  let gy = cone.ey + cone.ay * cone.cos * reach - shooter.p.y;
  let gz = cone.ez + cone.az * cone.cos * reach - shooter.p.z;
  if (side > 0) { gx += px / side * sin * reach; gy += py / side * sin * reach; gz += pz / side * sin * reach; }
  const g = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (!(g > 0) || gx * fx + gy * fy + gz * fz <= 0) return 0;
  out.x = gx / g; out.y = gy / g; out.z = gz / g;
  return 2;
}
