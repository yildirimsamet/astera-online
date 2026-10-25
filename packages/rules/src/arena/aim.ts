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
