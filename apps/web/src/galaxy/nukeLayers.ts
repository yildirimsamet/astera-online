import { DEATH_STAR } from '@astera/rules';
import type { Vec3Tuple } from './scene.js';

/*
  THE DEATH STAR HIT AS A NUCLEAR STRIKE SEEN FROM ORBIT (owner, 2026-11-12: "atom bombası, hidrojen
  bombası gibi bir patlama"). One clock drives every layer: the flash, the fireball, the shock front
  racing over the world, the condensation disc, the column, the cap and the crater still burning when
  the EMP hour takes over.
*/

/** The strike lasts exactly as long as the Death Star impact itself. */
export const NUKE_SECONDS = DEATH_STAR.impactSeconds;

/** How far round the world the shock front runs, in radians from the strike point (~77°). */
const RING_REACH = 1.35;

const ramp = (seconds: number, start: number, span: number): number => Math.max(0, Math.min(1, (seconds - start) / span));
const easeOut = (t: number, power: number): number => 1 - (1 - t) ** power;

/**
 * Every layer of the strike from one absolute age in seconds. Intensities are 0..1; `ringAngle`
 * is the front's angle from the strike point, `columnHeight` and the progress values 0..1.
 */
export function nukeLayers(seconds: number) {
  const t = Number.isFinite(seconds) ? seconds : -1;
  const on = t >= 0 && t < NUKE_SECONDS ? 1 : 0;
  const fire = ramp(t, 0, 2.6);
  const front = ramp(t, 0.05, 2.6);
  const disc = ramp(t, 0.35, 2.25);
  const rise = ramp(t, 0.15, 3.85);
  const spread = ramp(t, 0.6, 6.4);
  return {
    flash: on * Math.max(0, 1 - t / 0.6) ** 2,
    fireball: on * ramp(t, 0, 0.08) * (1 - ramp(t, 1.6, 1.8)) ** 0.8,
    fireProgress: on * fire,
    ring: on * ramp(t, 0.05, 0.08) * (1 - front) ** 1.1,
    ringAngle: on * RING_REACH * easeOut(front, 2.2),
    disc: on * Math.sin(Math.PI * disc),
    discProgress: on * disc,
    column: on * ramp(t, 0.15, 0.4) * (1 - ramp(t, 5.4, 2.6)),
    columnHeight: on * easeOut(rise, 2),
    cap: on * ramp(t, 0.6, 1.2) * (1 - ramp(t, 5.8, 2.2)) ** 1.3,
    capProgress: on * spread,
    ember: on * ramp(t, 0.1, 0.3) * (1 - 0.6 * ramp(t, 1, 7)),
    heat: on * (1 - ramp(t, 0.3, 7.7)),
    ash: on * 0.4 * easeOut(front, 1.6),
    light: on * (Math.max(0, 1 - t / 1.4) ** 2 + 0.12 * (1 - ramp(t, 1, 7))),
  };
}

/** How far from the viewer's line of sight the strike lands: far enough round that the column stands in profile. */
const STRIKE_FROM_VIEW = Math.PI / 3;
/** How far it leans from straight up the screen, so the cloud never climbs into the world's name above. */
const LEAN_MIN = 0.7;
const LEAN_MAX = 1.15;

const finite = (v: Vec3Tuple): boolean => v.every(Number.isFinite);
const dot = (a: Vec3Tuple, b: Vec3Tuple): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vec3Tuple, k: number): Vec3Tuple => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3Tuple): Vec3Tuple | null => {
  const length = Math.sqrt(dot(a, a));
  return finite(a) && length > 1e-6 ? scale(a, 1 / length) : null;
};
/** The part of `a` square to the unit `n`, made unit; null when `a` runs along `n`. */
const square = (a: Vec3Tuple, n: Vec3Tuple): Vec3Tuple | null => unit(add(a, scale(n, -dot(a, n))));
/** A stable 0..1 from a strike's id, so one strike always lands on the same side. */
const fraction = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  // FNV leaves near ids near each other in the high bits; a final mix spreads them.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * WHERE ON THE WORLD IT LANDS, as a unit direction from the world's centre. No viewer is told where
 * the weapon came from (a defender never is: that is what Radar L5 sells), so it lands where this
 * viewer sees it best: on the face toward them, 60° round from their line of sight so the column
 * stands in profile, rising up the screen and leaning left or right (by the strike's id).
 */
export function nukeStrikeAxis(toCamera: Vec3Tuple, screenUp: Vec3Tuple, id: string): Vec3Tuple {
  const view = unit(toCamera) ?? [0, 0, 1];
  const up = square(screenUp, view) ?? square([0, 1, 0], view) ?? square([1, 0, 0], view) ?? [0, 1, 0];
  const right = cross(up, view);
  const pick = fraction(id);
  const lean = (pick < 0.5 ? -1 : 1) * (LEAN_MIN + (LEAN_MAX - LEAN_MIN) * ((pick * 2) % 1));
  const side = add(scale(up, Math.cos(lean)), scale(right, Math.sin(lean)));
  return unit(add(scale(view, Math.cos(STRIKE_FROM_VIEW)), scale(side, Math.sin(STRIKE_FROM_VIEW)))) ?? [0, 0, 1];
}
