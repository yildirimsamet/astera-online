import { JUMP_FLIGHT, jumpTravel } from '@astera/rules';
import { initialHomeCameraPosition } from './follow.js';

export type Point = readonly [number, number, number];

/** The jump's way in world units: the berth, the new world and its size, and the ship's length. */
export interface JumpPath { from: Point; planet: Point; radius: number; ship: number }

export interface JumpPose { position: Point; target: Point; up: Point; fov: number }

/** The main game's own field, so the last frame is the main game's first. */
export const JUMP_FOV = 45;
/** How much wider the field opens at the top speed of the crossing. */
const SPEED_FOV = 9;

const LEVEL: Point = [0, 1, 0];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = (a: Point): Point => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a: Point, b: Point, k: number): Point => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const smooth = (from: number, to: number, value: number): number => {
  const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
};

/** Where the ship stops: on its own way in, at the foot of its world. */
export function jumpStop({ from, planet, radius, ship }: JumpPath): Point {
  return add(planet, unit(sub(from, planet)), radius * 1.5 + ship * 0.6);
}

/** The ship's own frame on the way: ahead, across and up. */
function axes(from: Point, stop: Point): { ahead: Point; across: Point; up: Point } {
  const ahead = unit(sub(stop, from));
  const level = Math.abs(ahead[1]) > 0.98 ? [1, 0, 0] as const : [0, 1, 0] as const;
  const across = unit(cross(ahead, level));
  return { ahead, across, up: cross(across, ahead) };
}

/** 0 at rest, 1 at the fastest of the crossing. */
const speedShare = (s: number): number => {
  const span = JUMP_FLIGHT.arrive - JUMP_FLIGHT.depart;
  const peak = 1.875 / span;
  return Math.min(1, ((jumpTravel(s + 0.02) - jumpTravel(s)) / 0.02) / peak);
};

/**
 * THE CAMERA OF THE JUMP, one pose per second of the scene's clock. Four shots blended on the same clock
 * the ship flies by: beside the hull while the drive catches; on its tail across the gap, the field
 * opening with the speed; behind it as it stops with its world filling the sky; and at last the main
 * game's opening pose on that world.
 */
export function jumpCamera(path: JumpPath, s: number): JumpPose {
  const { from, planet, radius, ship } = path;
  const stop = jumpStop(path);
  const { ahead, across, up } = axes(from, stop);
  const at = lerp(from, stop, jumpTravel(s));

  // High behind a shoulder: on a phone held upright the hull stands up the screen towards where it is
  // going, whole, and the nozzles light towards the eye. It drifts onto the tail as the drive catches.
  const drift = smooth(0, JUMP_FLIGHT.lit, s);
  let position = add(add(add(from, ahead, -ship * (3 + 0.4 * drift)), across, ship * (0.55 - 0.35 * drift)), up, ship * (1.15 - 0.1 * drift));
  let target = add(from, ahead, ship * 0.6);

  const speed = speedShare(s);
  const chase = smooth(JUMP_FLIGHT.depart + 0.4, JUMP_FLIGHT.depart + 3, s);
  position = lerp(position, add(add(add(at, ahead, -ship * (3.2 + 1.8 * speed)), up, ship * 0.85), across, ship * 0.15), chase);
  target = lerp(target, add(add(at, ahead, ship * 6), up, ship * 0.2), chase);

  const arrive = smooth(JUMP_FLIGHT.arrive - 3.8, JUMP_FLIGHT.arrive - 1.2, s);
  // Held on the ship, not on its stop: a camera waiting at the stop was overtaken by the hull (preview 2026-11-09).
  position = lerp(position, add(add(at, ahead, -(ship * 3 + radius * 1.2)), up, ship + radius * 0.55), arrive);
  target = lerp(target, add(at, ahead, radius * 0.9), arrive);

  const home = smooth(JUMP_FLIGHT.gone, 23.4, s);
  position = lerp(position, initialHomeCameraPosition(...planet), home);
  target = lerp(target, planet, home);

  // The frame rolls with the way, so a steep one still stands the ship up the screen; level again at home.
  return { position, target, up: home >= 1 ? LEVEL : unit(lerp(up, LEVEL, home)), fov: JUMP_FOV + SPEED_FOV * speed * (1 - arrive) };
}
