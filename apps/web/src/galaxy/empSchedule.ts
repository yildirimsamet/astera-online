import { DEATH_STAR } from '@astera/rules';
import { NUKE_SECONDS } from './nukeLayers.js';

/*
  THE EMP STORM'S CLOCK (owner approved the storm, 2026-11-12). Library art (CREDITS.md): Unique AoE
  Magic's electric line and lightning.
*/
export const EMP_ARC = '/assets/vfx/library/electric-line-4x4.webp';
export const EMP_BOLT = '/assets/vfx/library/lightning-5x5.webp';

/** A stable 0..1 value per integer, the same on every screen. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const QUIET = { active: false, phase: 0, spawn: -1, at: [1, 0, 0] as [number, number, number], spin: 0 };

/**
 * One arc slot of the storm: each slot keeps its own beat (2.1 s, 2.47 s, …) and starts its arc at
 * a seeded moment inside each beat, so the slots never fire together. `at` is the arc's point on
 * the unit sphere and `phase` 0..1 how far through its `length` seconds it is.
 */
export function empSlot(slot: number, seconds: number, length: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return QUIET;
  const period = 2.1 + 0.37 * slot;
  const beat = Math.floor(seconds / period);
  const spawn = slot * 1_000_000 + beat;
  const start = beat * period + hash(spawn * 13 + 5) * Math.max(0, period - length);
  const phase = (seconds - start) / length;
  if (phase < 0 || phase >= 1) return { ...QUIET, spawn };
  const z = hash(spawn * 3 + 1) * 2 - 1;
  const angle = hash(spawn * 3 + 2) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  return { active: true, phase, spawn, at: [Math.cos(angle) * ring, z, Math.sin(angle) * ring] as [number, number, number], spin: hash(spawn * 7) * Math.PI * 2 };
}

/** How dark the world's light drops now, 0..0.45: a burst of two or three short drops every 4.3 s. */
export function empBrownout(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  const period = 4.3;
  const beat = Math.floor(seconds / period);
  const local = seconds - beat * period;
  const burst = 0.5 + hash(beat) * 2.5;
  const drops = hash(beat * 11 + 3) > 0.5 ? 3 : 2;
  for (let j = 0; j < drops; j++) {
    const begin = burst + j * 0.22;
    if (local >= begin && local < begin + 0.1) return (0.25 + 0.2 * hash(beat * 5 + j)) * Math.sin(Math.PI * (local - begin) / 0.1);
  }
  return 0;
}

/** The storm rises in over this long, and dies away over the last `FADE_MS` of the hour. */
const RISE_MS = 1_500;
const FADE_MS = 20_000;
/** Below this many pixels of world radius the ember tells it; the storm is full from `FULL_PX`. */
const NEAR_PX = 12;
const FULL_PX = 20;

/**
 * When a world's storm begins: once the strike that caused it has finished playing. A hit sets the
 * EMP's end to the hit plus `empMinutes` (server `strategic.ts`), so the end names that strike.
 */
export function empStormStart(until: number): number {
  return until - DEATH_STAR.empMinutes * 60_000 + NUKE_SECONDS * 1_000;
}

/** How strongly the storm shows now, 0..1: rising in from `start`, dying away before `until`. */
export function empStormStrength(now: number, start: number, until: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(until)) return 0;
  return Math.min(clamp((now - start) / RISE_MS), clamp((until - now) / FADE_MS));
}

/** How much of the storm a world this many pixels in radius on screen shows, 0..1. */
export function empStormReach(pixels: number): number {
  if (!Number.isFinite(pixels)) return 0;
  return clamp((pixels - NEAR_PX) / (FULL_PX - NEAR_PX));
}
