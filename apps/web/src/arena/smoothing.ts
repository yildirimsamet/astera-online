import * as THREE from 'three';
import type { FlightState } from '@astera/rules/arena';

/**
 * PREDICTION ERROR SMOOTHING (owner 2026-10-20: "hızlı dönerken titriyor").
 *
 * A server snapshot can disagree with the prediction by a tick of turn and speed — a
 * late input on Wi-Fi makes the server repeat the previous one. Snapping to the
 * reconciled state moved the ship, and the camera riding it, in one frame. Instead the
 * drawn pose keeps exactly where it was: the difference becomes a visual offset that
 * melts away — 95 % gone in ~200 ms (owner) — while the simulation itself is already correct.
 */
export interface Correction { x: number; y: number; z: number; q: THREE.Quaternion }

const TELEPORT_M = 30;
const TELEPORT_RAD = 1;
const TAU_S = 0.2 / 3;
const identity = new THREE.Quaternion();
const qBefore = new THREE.Quaternion(); const qAfter = new THREE.Quaternion(); const qDelta = new THREE.Quaternion();
const qShifted = new THREE.Quaternion();

export const createCorrection = (): Correction => ({ x: 0, y: 0, z: 0, q: new THREE.Quaternion() });

/**
 * Takes a reconcile from `before` (the prediction on screen) to `after` (the server's
 * truth replayed). `previous` — the interpolation start — moves with the correction so
 * the drawn pose is continuous. Returns false for a teleport, which snaps.
 */
export function absorbCorrection(c: Correction, previous: FlightState, before: FlightState, after: FlightState): boolean {
  const dx = after.p.x - before.p.x, dy = after.p.y - before.p.y, dz = after.p.z - before.p.z;
  qBefore.set(before.q.x, before.q.y, before.q.z, before.q.w);
  qAfter.set(after.q.x, after.q.y, after.q.z, after.q.w);
  qDelta.copy(qAfter).multiply(qBefore.invert()); // after = delta · before
  if (dx * dx + dy * dy + dz * dz > TELEPORT_M * TELEPORT_M || qDelta.angleTo(identity) > TELEPORT_RAD) {
    c.x = 0; c.y = 0; c.z = 0; c.q.identity();
    previous.p.x = after.p.x; previous.p.y = after.p.y; previous.p.z = after.p.z;
    previous.q.x = after.q.x; previous.q.y = after.q.y; previous.q.z = after.q.z; previous.q.w = after.q.w;
    return false;
  }
  previous.p.x += dx; previous.p.y += dy; previous.p.z += dz;
  qShifted.set(previous.q.x, previous.q.y, previous.q.z, previous.q.w).premultiply(qDelta).normalize();
  previous.q.x = qShifted.x; previous.q.y = qShifted.y; previous.q.z = qShifted.z; previous.q.w = qShifted.w;
  c.x -= dx; c.y -= dy; c.z -= dz;
  c.q.multiply(qDelta.invert()).normalize();
  return true;
}

export function decayCorrection(c: Correction, dt: number): void {
  const k = Math.exp(-dt / TAU_S);
  c.x *= k; c.y *= k; c.z *= k;
  c.q.slerp(identity, 1 - k);
}

/** The drawn pose: interpolated prediction plus what is left of the correction. */
export function applyCorrection(c: Correction, out: { position: THREE.Vector3; quaternion: THREE.Quaternion }): void {
  out.position.x += c.x; out.position.y += c.y; out.position.z += c.z;
  out.quaternion.premultiply(c.q);
}
