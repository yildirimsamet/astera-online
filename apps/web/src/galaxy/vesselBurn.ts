import type { VesselSystem } from '@astera/rules';
import type { DamageSpot } from './mainSky.js';

/*
  HOW THE WRECKED SHIP BURNS (owner approved the lab's smoke and flames, 2026-11-12). Every bay still
  burns by its own repairs (plan F8, `damageSpots`); this says how much smoke, flame, glow and sparks
  each shows, eases a mended one out, and keeps the flame and the smoke column from ever looking
  like a loop.
*/

export interface BurnLook {
  /** 0..1 the smoke column. */
  smoke: number;
  /** 0..1 the flame. */
  flame: number;
  /** 0..1 the glow on the hull. */
  glow: number;
  /** 0..1 the spark bursts. */
  sparks: number;
}

/** How long a mended bay takes to settle most of the way out. */
export const BURN_FADE_SECONDS = 0.7;

const OUT: BurnLook = { smoke: 0, flame: 0, glow: 0, sparks: 0 };

/** What each bay shows: a wrecked machine burns, one under repair smoulders, wiring sparks. */
export function burnTargets(damage: readonly DamageSpot[]): Record<VesselSystem, BurnLook> {
  const looks: Record<VesselSystem, BurnLook> = { REFINERY: { ...OUT }, SURVEY: { ...OUT }, DEFENCE: { ...OUT }, CARGO: { ...OUT }, DRIVE: { ...OUT } };
  for (const { at, kind, strength: s } of damage) {
    looks[at] = kind === 'fire' ? { smoke: s, flame: s, glow: s, sparks: 0.5 * s }
      : kind === 'ember' ? { smoke: 0.55 * s, flame: 0, glow: 0.8 * s, sparks: 0 }
        : { smoke: 0.2 * s, flame: 0, glow: 0.3 * s, sparks: s };
  }
  return looks;
}

/** Moves `now` toward `target` over `seconds`, in place: never a jump, settled within a few seconds. */
export function easeBurn(now: BurnLook, target: BurnLook, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const k = 1 - Math.exp(-seconds / BURN_FADE_SECONDS);
  for (const key of ['smoke', 'flame', 'glow', 'sparks'] as const) {
    const next = now[key] + (target[key] - now[key]) * k;
    now[key] = Math.abs(next - target[key]) < 0.02 ? target[key] : next;
  }
}

const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (edge0: number, edge1: number, x: number): number => {
  const k = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
};

/**
 * A flipbook loop with no visible seam: two copies half a cycle apart, each fading to nothing as it
 * wraps from its last frame to its first, their weights always summing to one.
 */
export function loopLayers(seconds: number, fps: number, frames: number, offset: number): [{ frame: number; weight: number }, { frame: number; weight: number }] {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const cycle = (t * fps) / frames + offset;
  const layer = (shift: number) => {
    const p = (((cycle + shift) % 1) + 1) % 1;
    return { frame: p * frames, weight: 1 - Math.abs(2 * p - 1) };
  };
  return [layer(0), layer(0.5)];
}

/** Smoke puffs per bay: enough to keep one unbroken column. */
export const SMOKE_PUFFS = 7;

/**
 * One smoke puff of a bay. A bay's puffs share its life (2.6–3.4 s) and sit evenly spaced along the
 * column (a little jitter, never a hole), so they are reborn one at a time; each rebirth (`cycle`)
 * takes a new sideways drift, size and starting frame, so no two passes of the column look alike.
 */
export function puffState(bay: number, puff: number, seconds: number) {
  const life = 2.6 + 0.8 * hash(bay * 31 + 1);
  if (!Number.isFinite(seconds) || seconds < 0) return { life, age: 0, cycle: -1, alpha: 0, drift: 0, size: 1, frame: 8 };
  const slot = (puff + 0.25 * (hash(bay * 13 + puff * 5 + 3) - 0.5)) / SMOKE_PUFFS;
  const x = seconds / life + slot + hash(bay * 7 + 2);
  const cycle = Math.floor(x);
  const age = x - cycle;
  const seed = bay * 1000 + puff * 100 + cycle;
  return {
    life, age, cycle,
    alpha: smooth(0, 0.15, age) * (1 - smooth(0.55, 1, age)),
    drift: hash(seed * 3 + 1) * 2 - 1,
    size: 0.8 + 0.5 * hash(seed * 3 + 2),
    frame: 8 + 20 * hash(seed * 3 + 5),
  };
}
