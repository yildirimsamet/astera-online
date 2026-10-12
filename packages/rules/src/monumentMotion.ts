import { travelExact, distance } from './travel.js';
import type { Vec3 } from './types.js';
/** Immutable motion snapshot. Time and velocity use milliseconds. */
export interface MonumentMotion {
  origin: Vec3;
  epochMs: number;
  periodYMs: number;
  periodXMs: number;
  stopAtMs?: number;
}
export const MONUMENT_MOTION_RULESET = 17;
export const monumentMotion = (origin: Vec3, epochMs: number): MonumentMotion => ({ origin: { ...origin }, epochMs, periodYMs: 8 * 3600000, periodXMs: 16 * 3600000 });
export function assertMotion(motion: MonumentMotion): void {
  if (![motion.origin.x, motion.origin.y, motion.origin.z, motion.epochMs, motion.periodYMs, motion.periodXMs].every(Number.isFinite)
    || motion.periodYMs <= 0 || motion.periodXMs <= 0
    || (motion.stopAtMs !== undefined && !Number.isFinite(motion.stopAtMs)))
    throw new RangeError('Invalid monument motion');
}
export function motionPositionAt(m: MonumentMotion, atMs: number): Vec3 {
  atMs = Math.min(atMs, m.stopAtMs ?? Infinity);
  const y = ((atMs - m.epochMs) % m.periodYMs) * 2 * Math.PI / m.periodYMs;
  const x = ((atMs - m.epochMs) % m.periodXMs) * 2 * Math.PI / m.periodXMs;
  const cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
  const a = m.origin.y * cx - m.origin.z * sx, b = m.origin.y * sx + m.origin.z * cx;
  return { x: m.origin.x * cy + b * sy, y: a, z: -m.origin.x * sy + b * cy };
}
export function motionVelocityAt(m: MonumentMotion, atMs: number): Vec3 {
  if (m.stopAtMs !== undefined && atMs >= m.stopAtMs)
    return { x: 0, y: 0, z: 0 };
  const p = motionPositionAt(m, atMs), y = (atMs - m.epochMs) * 2 * Math.PI / m.periodYMs;
  const x = (atMs - m.epochMs) * 2 * Math.PI / m.periodXMs;
  const wy = 2 * Math.PI / m.periodYMs, wx = 2 * Math.PI / m.periodXMs;
  const b = m.origin.y * Math.sin(x) + m.origin.z * Math.cos(x);
  return { x: wy * p.z + wx * p.y * Math.sin(y), y: -wx * b, z: -wy * p.x + wx * p.y * Math.cos(y) };
}
export const motionAngularSpeed = (m: MonumentMotion): number => Math.hypot(2 * Math.PI / m.periodYMs, 2 * Math.PI / m.periodXMs);
export const motionSpeedBound = (m: MonumentMotion): number => motionAngularSpeed(m) * Math.hypot(m.origin.x, m.origin.y, m.origin.z);
export const sameMotionFrame = (a: MonumentMotion, b: MonumentMotion): boolean => a.epochMs === b.epochMs && a.periodYMs === b.periodYMs && a.periodXMs === b.periodXMs && a.stopAtMs === b.stopAtMs;
/** First reachable instant. A certified Lipschitz bound rejects empty intervals;
* left-first subdivision preserves the earliest root for slower craft. */
export function interceptMotion(from: Vec3, speed: number, m: MonumentMotion, departAt: number, expiresAt: number): {
  at: Vec3;
  arriveAt: number;
  flightMinutes: number;
} | null {
  assertMotion(m);
  if (![from.x, from.y, from.z, speed, departAt, expiresAt].every(Number.isFinite) || speed <= 0 || expiresAt <= departAt)
    return null;
  const v = 1 / (travelExact(1, speed) * 60000);
  const r = Math.hypot(from.x, from.y, from.z);
  const upper = Math.min(expiresAt - departAt, (r + Math.hypot(m.origin.x, m.origin.y, m.origin.z)) / v * (1 + 1e-12));
  const f = (t: number): number => distance(from, motionPositionAt(m, departAt + t)) - v * t;
  const radial = motionAngularSpeed(m) * r;
  const refine = (lo: number, hi: number): number => {
    for (let i = 0; i < 52; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0)
        lo = mid;
      else
        hi = mid;
    }
    return hi;
  };
  let delta: number | null = null;
  if (f(0) === 0)
    delta = 0;
  else if (v > radial) {
    if (f(upper) <= 0)
      delta = refine(0, upper);
  }
  else {
    let budget = 200000;
    const lipschitz = radial + v;
    const search = (lo: number, hi: number): number | null => {
      if (--budget < 0)
        throw new RangeError('Monument interception precision budget exceeded');
      const mid = (lo + hi) / 2, fm = f(mid);
      if (fm - lipschitz * (hi - lo) / 2 > 1e-9)
        return null;
      if (hi - lo <= 0.001) {
        if (f(lo) <= 0)
          return lo;
        if (f(hi) <= 0)
          return refine(lo, hi);
        // A tangent is reachable without a sign change.
        let a = lo, b = hi;
        for (let i = 0; i < 24; i++) {
          const u = a + (b - a) / 3, w = b - (b - a) / 3;
          if (f(u) < f(w))
            b = w;
          else
            a = u;
        }
        const t = (a + b) / 2;
        return f(t) <= 1e-9 ? t : null;
      }
      return search(lo, mid) ?? search(mid, hi);
    };
    delta = search(0, upper);
  }
  if (delta === null || departAt + delta >= expiresAt)
    return null;
  return { at: motionPositionAt(m, departAt + delta), arriveAt: departAt + delta, flightMinutes: delta / 60000 };
}
