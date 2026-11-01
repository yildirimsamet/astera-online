import { worldRadius, toWorld, sensorReach, type Vec3 } from '@astera/rules';
import type { SchoolWorld } from './world.js';

export const SCHOOL_REVEAL_MS = 2800;
export const schoolWorldRadius = (level: number, known = true): number => known ? worldRadius(level) * 10 : worldRadius(0) * 6;
export interface SchoolFrame {
  at: number;
  from: number;
  to: number;
  center: { x: number; y: number; z: number };
  duration: number;
  magnify?: boolean;
}
export interface SchoolTransit { from: Vec3; to: Vec3; at: number; duration: number }

/** The camera reveals the next neighbourhood first; the sensor follows later. */
export function schoolTelescopeFrame(w: SchoolWorld): SchoolFrame | undefined {
  if (w.scene !== 'sight' && w.scene !== 'range') return undefined;
  const center = { x: 180, y: 0, z: 0 }, level = w.previewLevel ?? w.instruments.TELESCOPE;
  const radius = (n: number) => sensorReach(n) / 50 * 1.06;
  if (w.scene === 'sight') return { center, at: w.sceneAt + 2000, from: 2050 / 50,
    to: radius(level), duration: SCHOOL_REVEAL_MS, magnify: true };
  return { center, at: w.reach ? w.reach.at - 2000 : w.sceneAt,
    from: w.reach ? w.reach.from / 50 * 1.06 : radius(level), to: radius(level), duration: 900, magnify: true };
}

/** Fit a complete sphere in the part of the phone left by the coach and dock. */
export function schoolCameraFit(radius: number, view: { width: number; height: number; top: number; bottom: number; fov: number }) {
  const room = Math.max(40, Math.min(view.width - 32, view.height - view.top - view.bottom - 32));
  const angle = Math.atan(Math.tan(view.fov * Math.PI / 360) * room / view.height);
  return { distance: radius / Math.sin(angle), offsetY: (view.bottom - view.top) / 2 };
}
export function schoolTransitPose(path: { from: Vec3; to: Vec3 }, progress: number) {
  const from = toWorld(path.from), to = toWorld(path.to);
  const t = Math.max(0, Math.min(1, progress));
  const dx = to[0] - from[0], dz = to[2] - from[2], length = Math.max(.001, Math.hypot(dx, dz));
  const turn = Math.max(0, Math.min(1, (t - .12) / .76));
  const angle = Math.PI * turn * turn * (3 - 2 * turn);
  const target: [number, number, number] = [from[0] + dx * t, from[1] + (to[1] - from[1]) * t, from[2] + dz * t];
  const position: [number, number, number] = [target[0] + 6 * (dx * Math.cos(angle) - dz * Math.sin(angle)) / length,
    target[1] + 2.2, target[2] + 6 * (dz * Math.cos(angle) + dx * Math.sin(angle)) / length];
  return { target, position };
}
export const schoolFrameRange = (frame: SchoolFrame, now: number): number => {
  const t = Math.max(0, Math.min(1, (now - frame.at) / frame.duration));
  return frame.from + (frame.to - frame.from) * t * t * (3 - 2 * t);
};
